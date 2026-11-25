-- Maintainer evidence is deliberately absent until every legacy PC and outbox has been reconciled.
create table app_private.branch_dispatch_readiness(
 organization_id uuid not null,branch_id uuid not null,reviewed_at timestamptz not null,
 evidence_reference text not null check(length(btrim(evidence_reference)) between 3 and 1000),invalidated_at timestamptz,
 primary key(organization_id,branch_id),foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
alter table app_private.branch_dispatch_readiness enable row level security;
revoke all on app_private.branch_dispatch_readiness from public,anon,authenticated;
create function app_private.invalidate_dispatch_readiness() returns trigger language plpgsql set search_path='' as $$begin
 if new.multi_pc is distinct from old.multi_pc then update app_private.branch_dispatch_readiness set invalidated_at=clock_timestamp() where organization_id=new.organization_id and branch_id=new.id and invalidated_at is null;end if;
 return new;
end$$;
create trigger invalidate_dispatch_readiness after update of multi_pc on public.branches for each row execute function app_private.invalidate_dispatch_readiness();
create function app_private.branch_dispatch_source_ready(org uuid,branch uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.branch_dispatch_readiness r join public.branches b on b.organization_id=r.organization_id and b.id=r.branch_id
 join app_private.branch_network_branches n on n.organization_id=r.organization_id and n.branch_id=r.branch_id
 where r.organization_id=org and r.branch_id=branch and r.invalidated_at is null and b.active and b.multi_pc and n.can_dispatch
 and not exists(select 1 from public.cashier_shifts s join public.shift_authorizations a on a.organization_id=s.organization_id and a.shift_id=s.id
 where s.organization_id=org and s.branch_id=branch and a.issued_at<r.reviewed_at and a.expires_at>now()))
$$;
create table app_private.branch_shipments(
 id uuid primary key,organization_id uuid not null,branch_id uuid not null,destination_branch_id uuid not null,stock_request_id uuid,request_version integer,
 source_name text not null,destination_name text not null,actor_id uuid not null references auth.users(id),session_id uuid not null,created_at timestamptz not null default now(),payload jsonb not null,result jsonb not null,
 unique(organization_id,id),foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,destination_branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,stock_request_id) references app_private.branch_stock_requests(organization_id,id)
);
create table app_private.branch_shipment_lines(
 id uuid primary key,organization_id uuid not null,shipment_id uuid not null,request_line_id uuid,product_id uuid not null,unit_id uuid not null,batch_id uuid,
 product_name text not null,unit_name text not null,batch_lot text,batch_expires_on date,quantity numeric not null,factor numeric not null,base_unit text not null,base_quantity numeric not null,
 foreign key(organization_id,shipment_id) references app_private.branch_shipments(organization_id,id),
 foreign key(organization_id,product_id) references public.products(organization_id,id),foreign key(organization_id,unit_id) references public.product_units(organization_id,id),
 foreign key(organization_id,batch_id) references public.product_batches(organization_id,id)
);
alter table public.stock_transfers add column shipment_id uuid;
alter table public.stock_transfers add constraint stock_transfer_shipment_fk foreign key(organization_id,shipment_id) references app_private.branch_shipments(organization_id,id);
alter table app_private.branch_shipments enable row level security;
alter table app_private.branch_shipment_lines enable row level security;
revoke all on app_private.branch_shipments,app_private.branch_shipment_lines from public,anon,authenticated;
revoke all on function app_private.invalidate_dispatch_readiness(),app_private.branch_dispatch_source_ready(uuid,uuid) from public,anon,authenticated;
create function app_private.dispatch_branch_shipment(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;src uuid:=(data->>'branchId')::uuid;dst uuid:=(data->>'destinationBranchId')::uuid;
 ident uuid:=(data->>'requestId')::uuid;doc uuid:=nullif(data->>'stockRequestId','')::uuid;uid uuid:=auth.uid();entry jsonb;link jsonb;
 p public.products;u public.product_units;r app_private.branch_stock_requests;l app_private.branch_stock_request_lines;existing app_private.branch_shipments;
 line uuid;request_line uuid;batch uuid;lock_branch uuid;arrival date;q numeric;base_q numeric;available numeric;ids uuid[]:='{}';request_ids uuid[]:='{}';out_lines jsonb:='[]'::jsonb;result jsonb;
begin
 if ident is null or org is null or src is null or dst is null or src=dst then raise exception 'Review shipment identity and branches' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,8301));
 select * into existing from app_private.branch_shipments s where s.id=ident;
 if found then
  if existing.organization_id=org and existing.branch_id=src and existing.actor_id=uid and app_private.membership_access(org,src) and existing.payload=data then return existing.result||'{"duplicate":true}'::jsonb;end if;
  raise exception 'Shipment reference already has different details' using errcode='22023';
 end if;
 if not app_private.network_enabled(org) or not app_private.can_access(org,src) or src<>app_private.network_hub(org)
 or not app_private.network_branch_allowed(org,dst)
 or not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=dst and n.can_receive)
 or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=uid and m.active and (m.role='owner' or (m.role='manager' and m.branch_id=src))) then
  raise exception 'Shipment permission denied' using errcode='42501';end if;
 -- The same branch lock as confirmed sales and PC mode changes, in stable order.
 for lock_branch in select x from unnest(array[src,dst]) x order by x loop
  perform pg_advisory_xact_lock(hashtextextended(org::text||lock_branch::text,1));
 end loop;
 if not app_private.network_enabled(org) or not app_private.can_access(org,src) or src<>app_private.network_hub(org) or not app_private.network_branch_allowed(org,dst) or not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=dst and n.can_receive) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=uid and m.active and (m.role='owner' or (m.role='manager' and m.branch_id=src))) then raise exception 'Shipment permission changed; refresh before dispatch' using errcode='42501';end if;
 if not app_private.branch_dispatch_source_ready(org,src) then raise exception 'Source checkout and legacy PC reconciliation require provider review' using errcode='42501';end if;
 if (data ? 'driver' and data->'driver'<>'null'::jsonb and (jsonb_typeof(data->'driver')<>'string' or length(data->>'driver')>200)) or (data ? 'vehicle' and data->'vehicle'<>'null'::jsonb and (jsonb_typeof(data->'vehicle')<>'string' or length(data->>'vehicle')>200)) then raise exception 'Review handover details' using errcode='22023';end if;
 if data ? 'expectedArrival' and data->'expectedArrival'<>'null'::jsonb and data->>'expectedArrival'<>'' then
  if jsonb_typeof(data->'expectedArrival')<>'string' or data->>'expectedArrival' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Review expected arrival date' using errcode='22023';end if;
  begin arrival:=(data->>'expectedArrival')::date;exception when others then raise exception 'Review expected arrival date' using errcode='22023';end;
 end if;
 if jsonb_typeof(data->'lines') is distinct from 'array' or jsonb_array_length(data->'lines') not between 1 and 100 or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000 then raise exception 'Review shipment lines and reason' using errcode='22023';end if;
 if doc is not null then
  perform pg_advisory_xact_lock(hashtextextended(doc::text,8302));
  select * into r from app_private.branch_stock_requests x where x.id=doc and x.organization_id=org for update;
  if r.id is null or r.destination_branch_id<>dst or r.status not in('approved','partly_dispatched') then raise exception 'Review approved request and destination' using errcode='22023';end if;
  if jsonb_typeof(data->'requestLineLinks') is distinct from 'array' or jsonb_array_length(data->'requestLineLinks')<>jsonb_array_length(data->'lines') then raise exception 'Link each line to one approved request line' using errcode='22023';end if;
 elsif data ? 'requestLineLinks' and data->'requestLineLinks'<>'[]'::jsonb and data->'requestLineLinks'<>'null'::jsonb then raise exception 'Request links require a request document' using errcode='22023';end if;
 insert into app_private.branch_shipments(id,organization_id,branch_id,destination_branch_id,stock_request_id,request_version,source_name,destination_name,actor_id,session_id,payload,result) values(ident,org,src,dst,doc,case when doc is null then null else r.version+1 end,(select name from public.branches where organization_id=org and id=src),(select name from public.branches where organization_id=org and id=dst),uid,(auth.jwt()->>'session_id')::uuid,data,'{}');
 for entry in select x from jsonb_array_elements(data->'lines') x order by x->>'productId',coalesce(x->>'batchId',''),x->>'lineId' loop
  line:=(entry->>'lineId')::uuid;batch:=nullif(entry->>'batchId','')::uuid;
  if line is null or line=any(ids) then raise exception 'Review distinct shipment line IDs' using errcode='22023';end if;ids:=array_append(ids,line);
  select * into p from public.products x where x.organization_id=org and x.id=(entry->>'productId')::uuid and x.active and not x.setup_pending for share;
  select * into u from public.product_units x where x.organization_id=org and x.id=(entry->>'unitId')::uuid and x.product_id=p.id for share;
  if p.id is null or u.id is null then raise exception 'Review product physical setup and unit' using errcode='22023';end if;
  q:=(entry->>'quantity')::numeric;base_q:=q*u.factor;
  if q is null or q in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or q<=0 or q>=1000000000000 or scale(trim_scale(q))>6 or base_q>=1000000000000 or scale(trim_scale(base_q))>6 or (p.base_unit='piece' and base_q<>trunc(base_q)) then raise exception 'Review shipment quantity' using errcode='22023';end if;
  if (p.tracks_expiry and batch is null) or (batch is not null and not exists(select 1 from public.product_batches b where b.id=batch and b.organization_id=org and b.product_id=p.id and (not p.tracks_expiry or b.expires_on is not null) and (b.expires_on is null or b.expires_on >= (now() at time zone 'Asia/Manila')::date))) then raise exception 'Review shipment batch and expiry' using errcode='22023';end if;
  request_line:=null;
  if doc is not null then
   if (select count(*) from jsonb_array_elements(data->'requestLineLinks') x where x->>'lineId'=line::text)<>1 then raise exception 'Each shipment line requires one request link' using errcode='22023';end if;
   select (x->>'requestLineId')::uuid into request_line from jsonb_array_elements(data->'requestLineLinks') x where x->>'lineId'=line::text;
   if request_line is null or request_line=any(request_ids) then raise exception 'Each request line may be allocated once' using errcode='22023';end if;request_ids:=array_append(request_ids,request_line);
   select * into l from app_private.branch_stock_request_lines x where x.id=request_line and x.organization_id=org and x.stock_request_id=doc and x.active for update;
   if l.id is null or l.product_id<>p.id or l.unit_id<>u.id or l.approved_factor is distinct from u.factor or l.approved_base_unit is distinct from p.base_unit or base_q>l.approved_base_quantity-l.dispatched_base_quantity-l.cancelled_base_quantity then raise exception 'Review approved quantity and conversion before dispatch' using errcode='22023';end if;
  end if;
  select i.quantity into available from public.branch_inventory i where i.organization_id=org and i.branch_id=src and i.product_id=p.id and i.batch_id is not distinct from batch for update;
  if coalesce(available,0)<base_q then raise exception 'Insufficient confirmed source stock' using errcode='22023';end if;
  insert into app_private.branch_shipment_lines(id,organization_id,shipment_id,request_line_id,product_id,unit_id,batch_id,product_name,unit_name,batch_lot,batch_expires_on,quantity,factor,base_unit,base_quantity) values(line,org,ident,request_line,p.id,u.id,batch,p.name,u.name,(select lot from public.product_batches where organization_id=org and id=batch),(select expires_on from public.product_batches where organization_id=org and id=batch),q,u.factor,p.base_unit,base_q);
  insert into public.stock_transfers(id,organization_id,branch_id,destination_branch_id,product_id,batch_id,quantity,dispatched_by,shipment_id) values(line,org,src,dst,p.id,batch,base_q,uid,ident);
  insert into public.inventory_movements(organization_id,branch_id,product_id,batch_id,quantity,kind,source_id,created_by) values(org,src,p.id,batch,-base_q,'transfer_out',line,uid);
  if request_line is not null then update app_private.branch_stock_request_lines set dispatched_base_quantity=dispatched_base_quantity+base_q where id=request_line;end if;
  out_lines:=out_lines||jsonb_build_array(jsonb_build_object('lineId',line,'productId',p.id,'productName',p.name,'unitId',u.id,'unitName',u.name,'batchId',batch,'batchLot',(select lot from public.product_batches where organization_id=org and id=batch),'batchExpiresOn',(select expires_on from public.product_batches where organization_id=org and id=batch),'quantity',trim_scale(q)::text,'factor',trim_scale(u.factor)::text,'baseUnit',p.base_unit,'baseQuantity',trim_scale(base_q)::text,'requestLineId',request_line));
 end loop;
 if doc is not null then update app_private.branch_stock_requests set version=version+1,updated_at=clock_timestamp(),status=case when exists(select 1 from app_private.branch_stock_request_lines x where x.stock_request_id=doc and x.active and x.approved_base_quantity>x.dispatched_base_quantity+x.cancelled_base_quantity) then 'partly_dispatched' else 'fully_dispatched' end where id=doc;end if;
 result:=jsonb_build_object('shipmentId',ident,'reference',ident::text,'duplicate',false,'status','in_transit','lines',out_lines);
 update app_private.branch_shipments set result=result where id=ident;
 return result;
end$$;
revoke all on function app_private.dispatch_branch_shipment(jsonb) from public,anon,authenticated;
do $ack$ declare src text;anchor text:='if action in(''save_branch_request''';begin
 src:=pg_get_functiondef('app_private.network_original_ack(text,jsonb)'::regprocedure);
 if strpos(src,anchor)=0 then raise exception 'Review original acknowledgment gateway';end if;
 execute replace(src,anchor,$insert$if action='dispatch_branch_shipment' and app_private.membership_access(org,branch) then
  return (select ship.result||'{"duplicate":true}'::jsonb from app_private.branch_shipments ship where ship.id=(data->>'requestId')::uuid and ship.organization_id=org and ship.branch_id=branch and ship.actor_id=auth.uid() and ship.payload=data);
 end if;
 if action in('save_branch_request'$insert$);
end $ack$;
do $gate$ declare src text;anchor text:='if network_action then';begin
 src:=pg_get_functiondef('app_private.require_enabled_branch(text,jsonb)'::regprocedure);
 if strpos(src,anchor)=0 then raise exception 'Review managed legacy dispatch gateway';end if;
 execute replace(src,anchor,$insert$if action='dispatch_transfer' then raise exception 'Use the reviewed shipment workflow for managed network dispatch' using errcode='42501';end if;
 if network_action then$insert$);
end $gate$;
alter function app_private.command(text,jsonb) rename to command_before_branch_shipments;
revoke all on function app_private.command_before_branch_shipments(text,jsonb) from public,anon,authenticated;
create function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare ack jsonb;begin
 perform app_private.require_enabled_branch(action,data);
 ack:=app_private.network_original_ack(action,data);if ack is not null then return ack;end if;
 if action='dispatch_branch_shipment' then return app_private.dispatch_branch_shipment(data);end if;
 if action='list_branch_shipments' then return app_private.list_branch_shipments(data);end if;
 return app_private.command_before_branch_shipments(action,data);
end$$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;

create function app_private.guard_shipment_evidence() returns trigger language plpgsql set search_path='' as $$begin
 if tg_table_name='branch_shipments' and tg_op='UPDATE' and old.result='{}'::jsonb and (to_jsonb(new)-'result')=(to_jsonb(old)-'result') then return new;end if;
 raise exception 'Posted shipment evidence is immutable';
end$$;
create trigger immutable_shipment before update or delete on app_private.branch_shipments for each row execute function app_private.guard_shipment_evidence();
create trigger immutable_shipment_line before update or delete on app_private.branch_shipment_lines for each row execute function app_private.guard_shipment_evidence();
revoke all on function app_private.guard_shipment_evidence() from public,anon,authenticated;
create function app_private.list_branch_shipments(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;after_id uuid;answer jsonb;begin
 if not app_private.network_enabled(org) or not app_private.can_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.branch_id=branch and m.role in('manager','stock_staff')))) then raise exception 'Shipment history access denied' using errcode='42501';end if;
 if data ? 'cursor' and data->'cursor'<>'null'::jsonb then
  if data->'cursor'->>'organizationId' is distinct from org::text or data->'cursor'->>'branchId' is distinct from branch::text or data->'cursor'->>'scope' is distinct from 'branch_shipments' then raise exception 'Refresh shipment list' using errcode='22023';end if;
  after_id:=(data->'cursor'->>'id')::uuid;if after_id is null then raise exception 'Invalid shipment cursor' using errcode='22023';end if;
 end if;
 with page as materialized (select s.* from app_private.branch_shipments s where s.organization_id=org and (s.branch_id=branch or s.destination_branch_id=branch) and (after_id is null or s.id>after_id) order by s.id limit 51),visible as(select * from page order by id limit 50)
 select jsonb_build_object('items',coalesce((select jsonb_agg(v.result||jsonb_build_object('sourceName',v.source_name,'destinationName',v.destination_name,'sourceBranchId',v.branch_id,'destinationBranchId',v.destination_branch_id,'createdAt',v.created_at,'driver',v.payload->>'driver','vehicle',v.payload->>'vehicle','expectedArrival',v.payload->>'expectedArrival','reason',v.payload->>'reason') order by v.id) from visible v),'[]'::jsonb),
 'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope','branch_shipments','organizationId',org,'branchId',branch,'id',id) from visible order by id desc limit 1) else null end) into answer;
 return answer;
end$$;
revoke all on function app_private.list_branch_shipments(jsonb) from public,anon,authenticated;
