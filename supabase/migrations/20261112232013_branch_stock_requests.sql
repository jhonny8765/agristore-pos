-- Inert request foundations: no entitlement, branch, stock or financial data.
alter table app_private.branch_network_configuration add column manager_request_approval boolean not null default false;
create table app_private.branch_stock_requests(
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 destination_branch_id uuid not null,
 version integer not null check(version>0),
 status text not null check(status in('draft','submitted','approved','partly_dispatched','fully_dispatched','closed_partial','cancelled')),
 note text not null default '' check(length(note)<=2000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),approved_by uuid references auth.users(id),approved_at timestamptz,
 unique(organization_id,id),
 foreign key(organization_id,destination_branch_id) references public.branches(organization_id,id)
);
create index branch_request_destination on app_private.branch_stock_requests(organization_id,destination_branch_id,id);
create table app_private.branch_stock_request_lines(
 id uuid primary key,organization_id uuid not null,stock_request_id uuid not null,
 product_id uuid not null,unit_id uuid not null,
 product_name text not null,unit_name text not null,
 requested_quantity numeric not null check(requested_quantity>0 and requested_quantity<1000000000000),
 active boolean not null default true,
 approved_quantity numeric check(approved_quantity>=0 and approved_quantity<1000000000000),
 approved_factor numeric,approved_base_unit text,approved_base_quantity numeric,
 dispatched_base_quantity numeric not null default 0 check(dispatched_base_quantity>=0),
 cancelled_base_quantity numeric not null default 0 check(cancelled_base_quantity>=0),
 unique(organization_id,stock_request_id,id),
 foreign key(organization_id,stock_request_id) references app_private.branch_stock_requests(organization_id,id),
 foreign key(organization_id,product_id) references public.products(organization_id,id),
 foreign key(organization_id,unit_id) references public.product_units(organization_id,id),
 check(approved_quantity is null or (approved_factor>0 and approved_base_unit is not null and approved_base_quantity=approved_quantity*approved_factor)),
 check(dispatched_base_quantity+cancelled_base_quantity<=coalesce(approved_base_quantity,0))
);
create index branch_request_lines_document on app_private.branch_stock_request_lines(organization_id,stock_request_id,id);
create table app_private.branch_stock_request_events(
 id uuid primary key,organization_id uuid not null,stock_request_id uuid not null,
 action text not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 payload jsonb not null,result jsonb not null,
 foreign key(organization_id,stock_request_id) references app_private.branch_stock_requests(organization_id,id)
);
create function app_private.immutable_branch_request_event() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Request evidence is immutable';end$$;
create trigger immutable_request_event before update or delete on app_private.branch_stock_request_events for each row execute function app_private.immutable_branch_request_event();
do $$declare t text;begin foreach t in array array['branch_stock_requests','branch_stock_request_lines','branch_stock_request_events'] loop
 execute format('alter table app_private.%I enable row level security',t);
 execute format('revoke all on app_private.%I from public,anon,authenticated',t);
 execute format('create policy private_only on app_private.%I as restrictive for all to anon,authenticated using(false) with check(false)',t);
end loop;end$$;

create function app_private.request_can_approve(org uuid,working_branch uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.network_enabled(org) and app_private.can_access(org,working_branch)
 and exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and
 (m.role='owner' or (m.role='manager' and m.branch_id=working_branch and working_branch=app_private.network_hub(org)
 and exists(select 1 from app_private.branch_network_configuration c where c.organization_id=org and c.manager_request_approval)
 and exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=working_branch and n.can_dispatch))))
$$;
create function app_private.request_can_write(org uuid,working_branch uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.network_enabled(org) and app_private.can_access(org,working_branch)
 and working_branch<>app_private.network_hub(org)
 and exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=working_branch and n.can_request)
 and exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active
 and (m.role='owner' or (m.branch_id=working_branch and m.role in('manager','stock_staff'))))
$$;
create function app_private.branch_request_json(org uuid,document uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'organizationId',r.organization_id,'destinationBranchId',r.destination_branch_id,'version',r.version,'status',r.status,'note',r.note,
 'destinationBranchName',(select b.name from public.branches b where b.organization_id=org and b.id=r.destination_branch_id),
 'createdBy',r.created_by,'createdAt',r.created_at,'updatedAt',r.updated_at,'approvedBy',r.approved_by,'approvedAt',r.approved_at,
 'lines',coalesce((select jsonb_agg(jsonb_build_object('lineId',l.id,'productId',l.product_id,'unitId',l.unit_id,'productName',l.product_name,'unitName',l.unit_name,
 'requestedQuantity',trim_scale(l.requested_quantity)::text,'approvedQuantity',trim_scale(l.approved_quantity)::text,
 'approvedFactor',trim_scale(l.approved_factor)::text,'approvedBaseUnit',l.approved_base_unit,'approvedBaseQuantity',trim_scale(l.approved_base_quantity)::text,
 'dispatchedBaseQuantity',trim_scale(l.dispatched_base_quantity)::text,'cancelledBaseQuantity',trim_scale(l.cancelled_base_quantity)::text,'active',l.active) order by l.id)
 from app_private.branch_stock_request_lines l where l.organization_id=org and l.stock_request_id=r.id),'[]'::jsonb))
 from app_private.branch_stock_requests r where r.organization_id=org and r.id=document
$$;

create function app_private.branch_request_command(action text,data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;working_branch uuid:=(data->>'branchId')::uuid;document uuid:=(data->>'stockRequestId')::uuid;
 mutation uuid:=(data->>'requestId')::uuid;expected integer;can_approve boolean;can_write boolean;wide boolean;
 r app_private.branch_stock_requests;l app_private.branch_stock_request_lines;e app_private.branch_stock_request_events;
 entry jsonb;u public.product_units;p public.products;q numeric;base_q numeric;ids uuid[]:='{}';line_id uuid;result jsonb;items jsonb;next_id uuid;
begin
 -- This explicit gate also covers unconfigured generic installs. Do not rely on
 -- compatibility display enabled=true or the legacy transfer-name classifier.
 if not app_private.network_enabled(org) or working_branch is null or not app_private.can_access(org,working_branch) then
  raise exception 'Branch stock network is not enabled for this working branch' using errcode='42501';end if;
 can_approve:=app_private.request_can_approve(org,working_branch);can_write:=app_private.request_can_write(org,working_branch);
 wide:=can_approve and working_branch=app_private.network_hub(org);
 if not can_write and not can_approve then raise exception 'Stock request permission denied' using errcode='42501';end if;

 if action='list_branch_requests' then
  if data ? 'cursor' and data->'cursor'<>'null'::jsonb then
   if data->'cursor'->>'organizationId' is distinct from org::text or data->'cursor'->>'branchId' is distinct from working_branch::text
    or data->'cursor'->>'scope' is distinct from 'branch_requests' then raise exception 'Refresh requests for the working branch' using errcode='22023';end if;
   next_id:=(data->'cursor'->>'id')::uuid;if next_id is null then raise exception 'Invalid request cursor' using errcode='22023';end if;
  end if;
  with page as materialized (select x.id from app_private.branch_stock_requests x
   where x.organization_id=org and (wide or x.destination_branch_id=working_branch)
   and app_private.network_branch_allowed(org,x.destination_branch_id)
   and exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=x.destination_branch_id and n.can_request)
   and (next_id is null or x.id>next_id) order by x.id limit 51),visible as(select id from page order by id limit 50)
  select jsonb_build_object('items',coalesce((select jsonb_agg(app_private.branch_request_json(org,v.id) order by v.id) from visible v),'[]'::jsonb),
   'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope','branch_requests','organizationId',org,'branchId',working_branch,'id',id) from visible order by id desc limit 1) else null end,
   'canRequest',can_write,'canApprove',can_approve,'checkedAt',clock_timestamp()) into result;
  return result;
 end if;
 if document is null then raise exception 'A permanent request document ID is required' using errcode='22023';end if;
 if action='branch_request' then
  select * into r from app_private.branch_stock_requests x where x.id=document and x.organization_id=org;
 else
  if mutation is null or mutation=document then raise exception 'Use separate document and mutation IDs' using errcode='22023';end if;
  if jsonb_typeof(data->'expectedVersion') is distinct from 'number' or (data->>'expectedVersion')!~'^[0-9]+$' then raise exception 'Expected document version is required' using errcode='22023';end if;
  expected:=(data->>'expectedVersion')::integer;
  perform pg_advisory_xact_lock(hashtextextended(mutation::text,8301));
  select * into e from app_private.branch_stock_request_events x where x.id=mutation;
  if found then
   if e.organization_id<>org or e.actor_id<>auth.uid() or e.action<>action or e.payload<>data then raise exception 'Mutation reference has a different payload or actor' using errcode='22023';end if;
   return e.result||'{"duplicate":true}'::jsonb;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(document::text,8302));
  select * into r from app_private.branch_stock_requests x where x.id=document for update;
 end if;
 if r.id is not null and (r.organization_id<>org or (not wide and r.destination_branch_id<>working_branch)
  or not app_private.network_branch_allowed(org,r.destination_branch_id)
  or not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=r.destination_branch_id and n.can_request)) then
  raise exception 'Stock request is outside permitted scope' using errcode='42501';end if;
 if action='branch_request' then
  if r.id is null then raise exception 'Stock request unavailable' using errcode='42501';end if;
  return app_private.branch_request_json(org,document);
 end if;
 if coalesce(r.version,0)<>expected then raise exception 'Request changed. Refresh and review the latest version' using errcode='40001';end if;
 if length(coalesce(data->>'note',''))>2000 then raise exception 'Request note is too long' using errcode='22023';end if;
 if action='save_branch_request' then
  if not can_write or (r.id is not null and r.destination_branch_id<>working_branch) then raise exception 'Save requests from the requesting working branch' using errcode='42501';end if;
  if r.id is not null and r.status<>'draft' then raise exception 'Only a draft request can be edited' using errcode='22023';end if;
  if jsonb_typeof(data->'lines') is distinct from 'array' or jsonb_array_length(data->'lines') not between 1 and 100 then raise exception 'Add 1 to 100 request lines' using errcode='22023';end if;
  if r.id is null then
   insert into app_private.branch_stock_requests(id,organization_id,destination_branch_id,version,status,note,created_by) values(document,org,working_branch,1,'draft',coalesce(data->>'note',''),auth.uid());
  end if;
  for entry in select value from jsonb_array_elements(data->'lines') loop
   line_id:=(entry->>'lineId')::uuid;
   if line_id is null or line_id=any(ids) then raise exception 'Request lines require distinct permanent IDs' using errcode='22023';end if;ids:=array_append(ids,line_id);
   select * into u from public.product_units x where x.id=(entry->>'unitId')::uuid and x.organization_id=org and x.product_id=(entry->>'productId')::uuid for share;
   select * into p from public.products x where x.id=u.product_id and x.organization_id=org and x.active and not x.setup_pending for share;
   if p.id is null then raise exception 'Choose an active shared product and its exact unit' using errcode='22023';end if;
   q:=(entry->>'quantity')::numeric;base_q:=q*u.factor;
   if q is null or q in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or q<=0 or q>=1000000000000 or scale(trim_scale(q))>6
    or base_q>=1000000000000 or scale(trim_scale(base_q))>6 or (p.base_unit='piece' and base_q<>trunc(base_q)) then raise exception 'Invalid exact requested quantity' using errcode='22023';end if;
   select * into l from app_private.branch_stock_request_lines x where x.id=line_id;
   if l.id is not null and (l.stock_request_id<>document or l.organization_id<>org or l.product_id<>p.id or l.unit_id<>u.id) then raise exception 'Substitutions require a new explicit line ID' using errcode='22023';end if;
   insert into app_private.branch_stock_request_lines(id,organization_id,stock_request_id,product_id,unit_id,product_name,unit_name,requested_quantity)
   values(line_id,org,document,p.id,u.id,p.name,u.name,q)
   on conflict(id) do update set requested_quantity=excluded.requested_quantity,active=true,product_name=excluded.product_name,unit_name=excluded.unit_name
   where branch_stock_request_lines.organization_id=excluded.organization_id and branch_stock_request_lines.stock_request_id=excluded.stock_request_id
    and branch_stock_request_lines.product_id=excluded.product_id and branch_stock_request_lines.unit_id=excluded.unit_id;
   if not found then raise exception 'Line identity already belongs to another request or product' using errcode='22023';end if;
  end loop;
  update app_private.branch_stock_request_lines set active=false where organization_id=org and stock_request_id=document and not(id=any(ids));
 elsif action='submit_branch_request' then
  if not can_write or r.destination_branch_id is distinct from working_branch then raise exception 'Submit from the requesting working branch' using errcode='42501';end if;
  if r.status is distinct from 'draft' then raise exception 'Only a saved draft can be submitted' using errcode='22023';end if;
  update app_private.branch_stock_requests set status='submitted' where id=document;
 elsif action='approve_branch_request' then
  if not can_approve then raise exception 'Request approval has not been delegated to this working branch' using errcode='42501';end if;
  if r.status is null or r.status not in('submitted','approved') then raise exception 'Submit the request before approval' using errcode='22023';end if;
  if jsonb_typeof(data->'approvedLines') is distinct from 'array' or jsonb_array_length(data->'approvedLines')<>(select count(*) from app_private.branch_stock_request_lines x where x.stock_request_id=document and x.active) then raise exception 'Explicitly review every active request line' using errcode='22023';end if;
  for entry in select value from jsonb_array_elements(data->'approvedLines') loop
   line_id:=(entry->>'lineId')::uuid;
   if line_id is null or line_id=any(ids) then raise exception 'Review distinct request lines' using errcode='22023';end if;ids:=array_append(ids,line_id);
   select * into l from app_private.branch_stock_request_lines x where x.id=line_id and x.stock_request_id=document and x.active for update;
   if l.id is null then raise exception 'Approval cannot substitute or add products' using errcode='22023';end if;
   select * into u from public.product_units x where x.id=l.unit_id and x.organization_id=org and x.product_id=l.product_id for share;
   select * into p from public.products x where x.id=l.product_id and x.organization_id=org and x.active and not x.setup_pending for share;
   if p.id is null or u.id is null then raise exception 'Review the current shared product and unit' using errcode='22023';end if;
   q:=(entry->>'quantity')::numeric;base_q:=q*u.factor;
   if q is null or q in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or q<0 or q>l.requested_quantity or scale(trim_scale(q))>6
    or base_q>=1000000000000 or scale(trim_scale(base_q))>6 or (p.base_unit='piece' and base_q<>trunc(base_q)) or l.dispatched_base_quantity>0 then raise exception 'Invalid approval quantity; posted dispatch evidence cannot be changed' using errcode='22023';end if;
   update app_private.branch_stock_request_lines set approved_quantity=q,approved_factor=u.factor,approved_base_unit=p.base_unit,approved_base_quantity=base_q,unit_name=u.name,product_name=p.name where id=line_id;
  end loop;
  if not exists(select 1 from app_private.branch_stock_request_lines x where x.stock_request_id=document and x.active and x.approved_quantity>0) then raise exception 'Approve a positive quantity or cancel the request' using errcode='22023';end if;
  update app_private.branch_stock_requests set status='approved',approved_by=auth.uid(),approved_at=clock_timestamp() where id=document;
 elsif action='cancel_branch_request' then
  if not can_approve and (not can_write or r.destination_branch_id is distinct from working_branch) then raise exception 'Cancellation permission denied' using errcode='42501';end if;
  if r.status is null or r.status not in('draft','submitted','approved','partly_dispatched') then raise exception 'Only an open request remainder can be cancelled' using errcode='22023';end if;
  if length(btrim(coalesce(data->>'note','')))<3 then raise exception 'Record why this request remainder is closed' using errcode='22023';end if;
  update app_private.branch_stock_request_lines set cancelled_base_quantity=coalesce(approved_base_quantity,0)-dispatched_base_quantity where stock_request_id=document and active;
  update app_private.branch_stock_requests set status=case when exists(select 1 from app_private.branch_stock_request_lines x where x.stock_request_id=document and x.dispatched_base_quantity>0) then 'closed_partial' else 'cancelled' end where id=document;
 else raise exception 'Unsupported request command' using errcode='22023';
 end if;
 update app_private.branch_stock_requests set version=expected+1,updated_at=clock_timestamp(),note=coalesce(data->>'note',note) where id=document;
 result:=app_private.branch_request_json(org,document)||'{"duplicate":false}'::jsonb;
 insert into app_private.branch_stock_request_events(id,organization_id,stock_request_id,action,actor_id,payload,result) values(mutation,org,document,action,auth.uid(),data,result);
 return result;
end $$;
revoke all on function app_private.immutable_branch_request_event(),app_private.request_can_approve(uuid,uuid),app_private.request_can_write(uuid,uuid),app_private.branch_request_json(uuid,uuid),app_private.branch_request_command(text,jsonb) from public,anon,authenticated;
-- Original acknowledgments remain read-only after suspension, even when the
-- original branch is no longer operationally enabled. No general history opens.
do $ack$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.network_original_ack(text,jsonb)'::regprocedure);
 anchor:='if action in(''record_sale'',''record_online_sale'')';
 if strpos(src,anchor)=0 then raise exception 'Review original acknowledgment gateway';end if;
 execute replace(src,anchor,$insert$if action in('save_branch_request','submit_branch_request','approve_branch_request','cancel_branch_request') and app_private.membership_access(org,branch) then
  return (select r.result||'{"duplicate":true}'::jsonb from app_private.branch_stock_request_events r
   where r.id=(data->>'requestId')::uuid and r.organization_id=org and r.actor_id=auth.uid() and r.action=action and r.payload=data);
 end if;
 if action in('record_sale','record_online_sale')$insert$);
end $ack$;
alter function app_private.command(text,jsonb) rename to command_before_branch_requests;
-- Function-name qualification is an implicit PL/pgSQL parameter scope. Preserve
-- the existing pricing retry predicate when its dispatcher is renamed.
do $scope$ declare src text;anchor text:='e.action=command.action';begin
 src:=pg_get_functiondef('app_private.command_before_branch_requests(text,jsonb)'::regprocedure);
 if strpos(src,anchor)=0 then raise exception 'Review renamed pricing command parameter scope';end if;
 execute replace(src,anchor,'e.action=command_before_branch_requests.action');
end $scope$;
revoke all on function app_private.command_before_branch_requests(text,jsonb) from public,anon,authenticated;
create function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare ack jsonb;begin
 perform app_private.require_enabled_branch(action,data);
 ack:=app_private.network_original_ack(action,data);if ack is not null then return ack;end if;
 if action in('list_branch_requests','branch_request','save_branch_request','submit_branch_request','approve_branch_request','cancel_branch_request') then return app_private.branch_request_command(action,data);end if;
 return app_private.command_before_branch_requests(action,data);
end$$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;
do $route$ declare src text;anchor text;begin
 -- Dedicated signal is false on generic/unconfigured compatibility installs.
 src:=pg_get_functiondef('app_private.branch_network(uuid)'::regprocedure);
 anchor:='''hubBranchId'',case when';
 if strpos(src,anchor)=0 then raise exception 'Review request workspace signal';end if;
 execute replace(src,anchor,'''requestNetworkEnabled'',enabled,''hubBranchId'',case when');
end $route$;
