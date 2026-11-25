-- Immutable grouped acknowledgments use the existing inventory, transfer,
-- hold and control journals. No production activation or balances are seeded.
alter table public.stock_transfers add column returned_quantity numeric(20,6) not null default 0;
alter table public.stock_transfers drop constraint transfer_quantities;
alter table public.stock_transfers add constraint transfer_quantities check(received_quantity>=0 and held_quantity>=0 and lost_quantity>=0 and returned_quantity>=0 and received_quantity+held_quantity+lost_quantity+returned_quantity<=quantity);
alter table app_private.branch_shipment_lines add column original_transfer_line_id uuid references app_private.branch_shipment_lines(id),add column origin_hold_id uuid references public.stock_holds(id),add column held_in_transit boolean not null default false;
create index shipment_return_origin on app_private.branch_shipment_lines(original_transfer_line_id) where original_transfer_line_id is not null;
create table app_private.branch_shipment_events(
 id uuid primary key,organization_id uuid not null,branch_id uuid not null,shipment_id uuid not null,
 action text not null check(action in('receive_branch_shipment','write_off_branch_shipment','compensate_branch_shipment','return_branch_shipment','disposition_branch_shipment_hold')),
 actor_id uuid not null references auth.users(id),session_id uuid not null,created_at timestamptz not null default now(),payload jsonb not null,result jsonb not null,
 foreign key(organization_id,shipment_id) references app_private.branch_shipments(organization_id,id),foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
create index shipment_events_parent on app_private.branch_shipment_events(organization_id,shipment_id,created_at,id);
alter table app_private.branch_shipment_events enable row level security;
revoke all on app_private.branch_shipment_events from public,anon,authenticated;
create trigger immutable_shipment_event before update or delete on app_private.branch_shipment_events for each row execute function app_private.immutable();

-- Shared posting primitive extracted from the original stock-control receiver.
-- Callers validate authorization, quantities and custody and acquire ordered
-- branch locks and the transfer row before calling this private function.
create function app_private.post_transfer_receipt(org uuid,branch uuid,tr public.stock_transfers,ident uuid,q numeric,h numeric,action text,reason text,data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();remaining numeric:=tr.quantity-tr.received_quantity-tr.held_quantity-tr.lost_quantity-tr.returned_quantity;
begin
 if action='write_off_transfer' then
  update public.stock_transfers set lost_quantity=lost_quantity+q where id=tr.id;
 else
  if q>0 then
   if exists(select 1 from public.product_batches where id=tr.batch_id and expires_on<(now() at time zone 'Asia/Manila')::date) then raise exception 'Expired goods must be received into hold';end if;
   insert into public.inventory_movements(organization_id,branch_id,product_id,batch_id,quantity,kind,source_id,created_by) values(org,branch,tr.product_id,tr.batch_id,q,'transfer_in',ident,uid);
  end if;
  if h>0 then insert into public.stock_holds(organization_id,branch_id,product_id,batch_id,quantity,remaining,reason,source_id) values(org,branch,tr.product_id,tr.batch_id,h,h,reason,ident);end if;
  if action='compensate_transfer' then
   update public.stock_transfers set returned_quantity=returned_quantity+q+h where id=tr.id;
  else
   update public.stock_transfers set received_quantity=received_quantity+q,held_quantity=held_quantity+h where id=tr.id;
  end if;
 end if;
 update public.stock_transfers set state=case when received_quantity+held_quantity+lost_quantity+returned_quantity=quantity then case when lost_quantity>0 then 'closed_short' else 'received' end else 'in_transit' end,received_by=uid,received_at=now() where id=tr.id;
 insert into public.stock_control_events values(ident,org,branch,action,tr.id,uid,data,now());
 if q+h<remaining or h>0 or action='write_off_transfer' then
  insert into public.stock_exceptions(organization_id,branch_id,kind,source_id,details) values(org,branch,'transfer_difference',tr.id,jsonb_build_object('dispatched',tr.quantity::text,'notes',reason,'sourceBranch',tr.branch_id,'destinationBranch',tr.destination_branch_id)) on conflict do nothing;
 end if;
end$$;
revoke all on function app_private.post_transfer_receipt(uuid,uuid,public.stock_transfers,uuid,numeric,numeric,text,text,jsonb) from public,anon,authenticated;

-- Fail-closed extraction: preserve all legacy validation and reuse its posting.
do $extract$ declare fn regprocedure;src text;first_at int;last_at int;anchor text:='  if action=''write_off_transfer'' then';begin
 select p.oid::regprocedure into strict fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.prosrc like '%elsif action in (''receive_transfer'',''write_off_transfer'') then%';
 src:=pg_get_functiondef(fn);first_at:=strpos(src,anchor);last_at:=strpos(src,' elsif action=''refund_sale'' then');
 if first_at=0 or last_at<=first_at then raise exception 'Review stock-control posting extraction';end if;
 src:=left(src,first_at-1)||E'  if action=''write_off_transfer'' and h<>0 then raise exception ''A transfer loss cannot include held goods'';end if;\n  perform app_private.post_transfer_receipt(org,branch,tr,ident,q,h,action,reason,data);\n'||substr(src,last_at);
 src:=replace(src,'tr.quantity-tr.received_quantity-tr.held_quantity-tr.lost_quantity','tr.quantity-tr.received_quantity-tr.held_quantity-tr.lost_quantity-tr.returned_quantity');
 src:=replace(src,'t.received_quantity+t.held_quantity+t.lost_quantity<t.quantity','t.received_quantity+t.held_quantity+t.lost_quantity+t.returned_quantity<t.quantity');
 execute src;
end $extract$;

create function app_private.shipment_projection(org uuid,ident uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select s.result||jsonb_build_object('status',case when exists(select 1 from public.stock_transfers t where t.organization_id=org and t.shipment_id=ident and t.state='in_transit') then 'in_transit' when exists(select 1 from public.stock_transfers t where t.organization_id=org and t.shipment_id=ident and t.lost_quantity>0) then 'closed_short' else 'received' end,
 'sourceName',s.source_name,'destinationName',s.destination_name,'sourceBranchId',s.branch_id,'destinationBranchId',s.destination_branch_id,'createdAt',s.created_at,'driver',s.payload->>'driver','vehicle',s.payload->>'vehicle','expectedArrival',s.payload->>'expectedArrival','reason',s.payload->>'reason',
 'lines',(select jsonb_agg(original||jsonb_build_object('accepted',trim_scale(t.received_quantity/l.factor)::text,'held',trim_scale(t.held_quantity/l.factor)::text,'lost',trim_scale(t.lost_quantity/l.factor)::text,'returned',trim_scale(t.returned_quantity/l.factor)::text,'outstanding',trim_scale((t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity-t.returned_quantity)/l.factor)::text,'heldInTransit',l.held_in_transit,'originalTransferLineId',l.original_transfer_line_id,
 'returnedReceived',trim_scale(coalesce((select sum(r.base_quantity) from app_private.branch_shipment_lines r where r.original_transfer_line_id=l.id),0)/l.factor)::text,
 'holds',coalesce((select jsonb_agg(jsonb_build_object('holdId',h.id,'baseQuantity',trim_scale(h.remaining)::text,'branchId',h.branch_id,'branchName',(select b.name from public.branches b where b.id=h.branch_id),'sourceAction',e.action) order by h.id) from public.stock_holds h join public.stock_control_events e on e.id=h.source_id where h.organization_id=org and h.remaining>0 and e.source_id=t.id and e.action in('receive_transfer','compensate_transfer') and (h.branch_id=s.destination_branch_id or exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner'))),'[]'::jsonb)) order by l.id)
 from jsonb_array_elements(s.result->'lines') original join app_private.branch_shipment_lines l on l.id=(original->>'lineId')::uuid join public.stock_transfers t on t.id=l.id))
 from app_private.branch_shipments s where s.organization_id=org and s.id=ident
$$;
revoke all on function app_private.shipment_projection(uuid,uuid) from public,anon,authenticated;

create function app_private.reconcile_branch_shipment(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;shipment uuid:=(data->>'shipmentId')::uuid;
 ident uuid:=coalesce(data->>'receiptId',data->>'requestId')::uuid;prior app_private.branch_shipment_events;s app_private.branch_shipments;l app_private.branch_shipment_lines;t public.stock_transfers;
 lock_branch uuid;entry jsonb;line uuid;q numeric;h numeric;reason text:=coalesce(data->>'note',data->>'reason');ids uuid[]:='{}';event_id uuid;result jsonb;posted_lines jsonb:='[]';
 loss boolean:=action='write_off_branch_shipment';compensating boolean:=action='compensate_branch_shipment';
begin
 if ident is null or org is null or branch is null or shipment is null then raise exception 'Review receiving identity' using errcode='22023';end if;
 if not app_private.membership_access(org,branch) then raise exception 'Receiving access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,8301));
 select * into prior from app_private.branch_shipment_events e where e.id=ident;
 if found then
  if prior.organization_id=org and prior.branch_id=branch and prior.actor_id=auth.uid() and prior.action=action and prior.payload=data then return prior.result||'{"duplicate":true}'::jsonb;end if;
  raise exception 'Receiving reference already has different details' using errcode='22023';
 end if;
 select * into s from app_private.branch_shipments x where x.organization_id=org and x.id=shipment;
 if s.id is null or branch is distinct from (case when compensating then s.branch_id else s.destination_branch_id end) then raise exception 'Shipment is not addressed to this receiving location' using errcode='42501';end if;
 for lock_branch in select x from unnest(array[s.branch_id,s.destination_branch_id]) x order by x loop perform pg_advisory_xact_lock(hashtextextended(org::text||lock_branch::text,1));end loop;
 if not app_private.membership_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (not loss and not compensating and m.branch_id=branch and m.role in('manager','stock_staff')))) then raise exception 'Receiving permission denied' using errcode='42501';end if;
 if not exists(select 1 from app_private.branch_network_configuration c where c.organization_id=org and c.activated_at is not null and s.created_at>=c.activated_at)
 or not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=branch and (compensating or n.can_receive)) then raise exception 'No activated shipment obligation at this location' using errcode='42501';end if;
 if (loss or compensating) and length(btrim(coalesce(data->>'evidenceReference',''))) not between 3 and 1000 then raise exception 'Record observed evidence before closing or returning stock' using errcode='22023';end if;
 if compensating and (data->>'observedBranchId')::uuid is distinct from s.branch_id then raise exception 'Physically verify goods at the original source' using errcode='22023';end if;
 if length(btrim(coalesce(reason,''))) not between 3 and 1000 or jsonb_typeof(data->'lines') is distinct from 'array' or jsonb_array_length(data->'lines') not between 1 and 100 then raise exception 'Review receiving lines and notes' using errcode='22023';end if;
 for entry in select x from jsonb_array_elements(data->'lines') x order by x->>'transferLineId' loop
  line:=(entry->>'transferLineId')::uuid;
  if line is null or line=any(ids) then raise exception 'Use each shipment line once' using errcode='22023';end if;ids:=array_append(ids,line);
  select * into l from app_private.branch_shipment_lines x where x.id=line and x.organization_id=org and x.shipment_id=shipment;
  select * into t from public.stock_transfers x where x.id=l.id and x.organization_id=org for update;
  if l.id is null or t.id is null then raise exception 'Shipment line not found' using errcode='22023';end if;
  q:=(case when loss then entry->>'quantity' else entry->>'accepted' end)::numeric;h:=case when loss then 0 else (entry->>'held')::numeric end;
  if q is null or h is null or q in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or h in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or q<0 or h<0 or q+h<=0 or scale(trim_scale(q))>6 or scale(trim_scale(h))>6 then raise exception 'Enter actual nonnegative receiving quantities' using errcode='22023';end if;
  q:=q*l.factor;h:=h*l.factor;
  if q+h>t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity-t.returned_quantity or scale(trim_scale(q))>6 or scale(trim_scale(h))>6 or (l.base_unit='piece' and (q<>trunc(q) or h<>trunc(h))) then raise exception 'Receiving exceeds outstanding stock or recorded precision' using errcode='22023';end if;
  if not loss and q>0 and (l.held_in_transit or l.batch_expires_on<(now() at time zone 'Asia/Manila')::date or exists(select 1 from public.product_batches b where b.id=l.batch_id and b.expires_on<(now() at time zone 'Asia/Manila')::date)) then raise exception 'These goods must stay held pending separate inspection' using errcode='22023';end if;
  posted_lines:=posted_lines||jsonb_build_array(case when loss then jsonb_build_object('transferLineId',line,'quantity',trim_scale((entry->>'quantity')::numeric)::text) else jsonb_build_object('transferLineId',line,'accepted',trim_scale((entry->>'accepted')::numeric)::text,'held',trim_scale((entry->>'held')::numeric)::text) end);
  event_id:=gen_random_uuid();
  perform app_private.post_transfer_receipt(org,branch,t,event_id,q,h,case when loss then 'write_off_transfer' when compensating then 'compensate_transfer' else 'receive_transfer' end,reason,jsonb_build_object('shipmentEventId',ident,'quantity',trim_scale(q)::text,'heldQuantity',trim_scale(h)::text,'reason',reason,'evidenceReference',data->>'evidenceReference'));
 end loop;
 result:=app_private.shipment_projection(org,shipment)||jsonb_build_object('id',ident,'duplicate',false,'action',action,'postedLines',posted_lines);
 insert into app_private.branch_shipment_events(id,organization_id,branch_id,shipment_id,action,actor_id,session_id,payload,result) values(ident,org,branch,shipment,action,auth.uid(),(auth.jwt()->>'session_id')::uuid,data,result);
 return result;
end$$;
revoke all on function app_private.reconcile_branch_shipment(text,jsonb) from public,anon,authenticated;

do $gate$ declare src text;anchor text:='if not managed then return;end if;';begin
 src:=pg_get_functiondef('app_private.require_enabled_branch(text,jsonb)'::regprocedure);
 if strpos(src,anchor)=0 then raise exception 'Review shipment gateway';end if;
 execute replace(src,anchor,$insert$
 if action in('receive_transfer','write_off_transfer') and exists(select 1 from public.stock_transfers t where t.organization_id=org and t.id=(data->>'transferId')::uuid and t.shipment_id is not null) then raise exception 'Use the grouped shipment receiving workflow' using errcode='42501';end if;
 if action in('receive_branch_shipment','write_off_branch_shipment','compensate_branch_shipment','return_branch_shipment','shipment_obligations') then
  if not app_private.membership_access(org,null) then raise exception 'Sign in with a current business membership' using errcode='42501';end if;
  return; -- These private handlers apply the narrower activated-obligation gate.
 end if;
 if not managed then return;end if;
 $insert$);
end $gate$;
alter function app_private.command(text,jsonb) rename to command_before_shipment_receiving;
revoke all on function app_private.command_before_shipment_receiving(text,jsonb) from public,anon,authenticated;
create function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform app_private.require_enabled_branch(action,data);
 if action in('receive_branch_shipment','write_off_branch_shipment','compensate_branch_shipment') then return app_private.reconcile_branch_shipment(action,data);end if;
 return app_private.command_before_shipment_receiving(action,data);
end$$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;

-- Projection changes are applied to the owning existing readers, retaining
-- their permission checks, cursor scopes and historical cutoff semantics.
do $projection$ declare src text;begin
 src:=pg_get_functiondef('app_private.branch_stock_rows(uuid,uuid[])'::regprocedure);
 if strpos(src,'t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity')=0 then raise exception 'Review branch transit projection';end if;
 execute replace(src,'t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity','t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity-t.returned_quantity');
 src:=pg_get_functiondef('app_private.stock_reconciliation(uuid,uuid,timestamptz,timestamptz,timestamptz)'::regprocedure);
 if strpos(src,'e.action in (''receive_transfer'',''write_off_transfer'')')=0 then raise exception 'Review historical transit projection';end if;
 src:=replace(src,'e.action in (''receive_transfer'',''write_off_transfer'')','e.action in (''receive_transfer'',''write_off_transfer'',''compensate_transfer'')');
 src:=replace(src,'e.action=''receive_transfer''','e.action in(''receive_transfer'',''compensate_transfer'')');
 src:=replace(src,'e.action=''disposition_hold''','e.action in(''disposition_hold'',''return_transfer_hold'')');execute src;
 src:=pg_get_functiondef('app_private.list_branch_shipments(jsonb)'::regprocedure);
 if strpos(src,'v.result||jsonb_build_object')=0 then raise exception 'Review shipment list projection';end if;
 execute replace(src,'v.result||jsonb_build_object','app_private.shipment_projection(org,v.id)||jsonb_build_object');
end $projection$;
-- Shared dispatch posting is also used by linked reverse shipments. The
-- actual-source lock is acquired by both callers before checking availability.
create function app_private.post_transfer_dispatch(org uuid,src uuid,dst uuid,product uuid,batch uuid,q numeric,line uuid,shipment uuid,hold uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare available numeric;begin
 if hold is null then
  select quantity into available from public.branch_inventory where organization_id=org and branch_id=src and product_id=product and batch_id is not distinct from batch for update;
  if coalesce(available,0)<q then raise exception 'Insufficient confirmed source stock' using errcode='22023';end if;
  insert into public.inventory_movements(organization_id,branch_id,product_id,batch_id,quantity,kind,source_id,created_by) values(org,src,product,batch,-q,'transfer_out',line,auth.uid());
 else
  select remaining into available from public.stock_holds where organization_id=org and id=hold and branch_id=src and product_id=product and batch_id is not distinct from batch for update;
  if coalesce(available,0)<q then raise exception 'Insufficient identified held stock' using errcode='22023';end if;
  update public.stock_holds set remaining=remaining-q where id=hold;
  insert into public.stock_control_events(id,organization_id,branch_id,action,source_id,actor_id,payload) values(gen_random_uuid(),org,src,'return_transfer_hold',hold,auth.uid(),jsonb_build_object('quantity',trim_scale(q)::text,'transferLineId',line,'shipmentId',shipment));
 end if;
 insert into public.stock_transfers(id,organization_id,branch_id,destination_branch_id,product_id,batch_id,quantity,dispatched_by,shipment_id) values(line,org,src,dst,product,batch,q,auth.uid(),shipment);
end$$;
revoke all on function app_private.post_transfer_dispatch(uuid,uuid,uuid,uuid,uuid,numeric,uuid,uuid,uuid) from public,anon,authenticated;
do $dispatch_extract$ declare src text;anchor text:=$old$insert into public.stock_transfers(id,organization_id,branch_id,destination_branch_id,product_id,batch_id,quantity,dispatched_by,shipment_id) values(line,org,src,dst,p.id,batch,base_q,uid,ident);
  insert into public.inventory_movements(organization_id,branch_id,product_id,batch_id,quantity,kind,source_id,created_by) values(org,src,p.id,batch,-base_q,'transfer_out',line,uid);$old$;begin
 src:=replace(pg_get_functiondef('app_private.dispatch_branch_shipment(jsonb)'::regprocedure),chr(13),'');anchor:=replace(anchor,chr(13),'');
 if strpos(src,anchor)=0 then raise exception 'Review shared dispatch posting extraction';end if;
 execute replace(src,anchor,'perform app_private.post_transfer_dispatch(org,src,dst,p.id,batch,base_q,line,ident);');
end $dispatch_extract$;

create function app_private.return_branch_shipment(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;src uuid:=(data->>'branchId')::uuid;ident uuid:=(data->>'requestId')::uuid;
 s app_private.branch_shipments;l app_private.branch_shipment_lines;t public.stock_transfers;prior app_private.branch_shipment_events;h public.stock_holds;
 entry jsonb;result jsonb;out_lines jsonb:='[]';posted_lines jsonb:='[]';line uuid;original uuid;hold uuid;lock_branch uuid;ids uuid[]:='{}';q numeric;base_q numeric;prior_return numeric;
begin
 if ident is null or org is null or src is null or not app_private.membership_access(org,src) then raise exception 'Return access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,8301));
 select * into prior from app_private.branch_shipment_events e where e.id=ident;
 if found then
  if prior.organization_id=org and prior.branch_id=src and prior.actor_id=auth.uid() and prior.action='return_branch_shipment' and prior.payload=data then return prior.result||'{"duplicate":true}'::jsonb;end if;
  raise exception 'Return reference already has different details' using errcode='22023';
 end if;
 select * into s from app_private.branch_shipments x where x.id=(data->>'shipmentId')::uuid and x.organization_id=org;
 if s.id is null or s.destination_branch_id<>src or s.branch_id<>app_private.network_hub(org) then raise exception 'Return must follow its original hub route' using errcode='42501';end if;
 for lock_branch in select x from unnest(array[src,s.branch_id]) x order by x loop perform pg_advisory_xact_lock(hashtextextended(org::text||lock_branch::text,1));end loop;
 if not app_private.network_enabled(org) or not app_private.branch_dispatch_source_ready(org,src) or not app_private.membership_access(org,src)
 or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner')
 or not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=s.branch_id and n.can_receive) then raise exception 'Owner approval and actual source dispatch readiness are required' using errcode='42501';end if;
 if (data->>'observedBranchId')::uuid is distinct from src or length(btrim(coalesce(data->>'evidenceReference',''))) not between 3 and 1000 or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000 then raise exception 'Record physical location and return evidence' using errcode='22023';end if;
 if jsonb_typeof(data->'lines') is distinct from 'array' or jsonb_array_length(data->'lines') not between 1 and 100 then raise exception 'Review return lines' using errcode='22023';end if;
 insert into app_private.branch_shipments(id,organization_id,branch_id,destination_branch_id,source_name,destination_name,actor_id,session_id,payload,result) values(ident,org,src,s.branch_id,s.destination_name,s.source_name,auth.uid(),(auth.jwt()->>'session_id')::uuid,data,'{}');
 for entry in select x from jsonb_array_elements(data->'lines') x order by x->>'transferLineId',coalesce(x->>'holdId','') loop
  line:=(entry->>'lineId')::uuid;original:=(entry->>'transferLineId')::uuid;hold:=nullif(entry->>'holdId','')::uuid;
  if line is null or line=any(ids) then raise exception 'Review distinct return line IDs' using errcode='22023';end if;ids:=array_append(ids,line);
  select * into l from app_private.branch_shipment_lines x where x.id=original and x.organization_id=org and x.shipment_id=s.id;
  select * into t from public.stock_transfers x where x.id=l.id and x.organization_id=org for update;
  if l.id is null or t.id is null then raise exception 'Original received line not found' using errcode='22023';end if;
  q:=(entry->>'quantity')::numeric;base_q:=q*l.factor;
  if q is null or q in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or q<=0 or scale(trim_scale(q))>6 or scale(trim_scale(base_q))>6 or (l.base_unit='piece' and base_q<>trunc(base_q)) then raise exception 'Review return quantity in recorded units' using errcode='22023';end if;
  if hold is null then
   select coalesce(sum(x.base_quantity),0) into prior_return from app_private.branch_shipment_lines x where x.original_transfer_line_id=l.id and x.origin_hold_id is null;
   if base_q>t.received_quantity-prior_return then raise exception 'Return exceeds original eligible received stock' using errcode='22023';end if;
   if l.batch_expires_on<(now() at time zone 'Asia/Manila')::date or exists(select 1 from public.product_batches b where b.id=l.batch_id and b.expires_on<(now() at time zone 'Asia/Manila')::date) then raise exception 'Expired goods require identified hold custody' using errcode='22023';end if;
  else
   select x.* into h from public.stock_holds x join public.stock_control_events e on e.id=x.source_id where x.id=hold and x.organization_id=org and x.branch_id=src and e.organization_id=org and e.source_id=l.id and e.action='receive_transfer' for update of x;
   if h.id is null or h.remaining<base_q then raise exception 'Return requires remaining original receipt hold' using errcode='22023';end if;
  end if;
  insert into app_private.branch_shipment_lines(id,organization_id,shipment_id,product_id,unit_id,batch_id,product_name,unit_name,batch_lot,batch_expires_on,quantity,factor,base_unit,base_quantity,original_transfer_line_id,origin_hold_id,held_in_transit) values(line,org,ident,l.product_id,l.unit_id,l.batch_id,l.product_name,l.unit_name,l.batch_lot,l.batch_expires_on,q,l.factor,l.base_unit,base_q,l.id,hold,hold is not null);
  perform app_private.post_transfer_dispatch(org,src,s.branch_id,l.product_id,l.batch_id,base_q,line,ident,hold);
  posted_lines:=posted_lines||jsonb_build_array(jsonb_build_object('lineId',line,'transferLineId',l.id,'quantity',trim_scale(q)::text,'holdId',hold));
  out_lines:=out_lines||jsonb_build_array(jsonb_build_object('lineId',line,'productId',l.product_id,'productName',l.product_name,'unitId',l.unit_id,'unitName',l.unit_name,'batchId',l.batch_id,'batchLot',l.batch_lot,'batchExpiresOn',l.batch_expires_on,'quantity',trim_scale(q)::text,'factor',trim_scale(l.factor)::text,'baseUnit',l.base_unit,'baseQuantity',trim_scale(base_q)::text,'requestLineId',null,'originalTransferLineId',l.id,'heldInTransit',hold is not null));
 end loop;
 result:=jsonb_build_object('id',ident,'shipmentId',ident,'originalShipmentId',s.id,'reference',ident::text,'duplicate',false,'status','in_transit','lines',out_lines,'action','return_branch_shipment','postedLines',posted_lines);
 update app_private.branch_shipments set result=result where id=ident;
 insert into app_private.branch_shipment_events(id,organization_id,branch_id,shipment_id,action,actor_id,session_id,payload,result) values(ident,org,src,s.id,'return_branch_shipment',auth.uid(),(auth.jwt()->>'session_id')::uuid,data,result);
 return result;
end$$;
revoke all on function app_private.return_branch_shipment(jsonb) from public,anon,authenticated;
do $return_gate$ declare src text;anchor text:='return app_private.command_before_shipment_receiving(action,data);';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if strpos(src,anchor)=0 then raise exception 'Review return dispatcher';end if;
 execute replace(src,anchor,'if action=''return_branch_shipment'' then return app_private.return_branch_shipment(data);end if;'||anchor);
end $return_gate$;
-- Session-bound discovery deliberately does not restore operating membership
-- rows, branch selectors, catalogue or checkout after suspension.
create function app_private.shipment_obligations(data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare after_id uuid;answer jsonb;begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())) then raise exception 'Sign in again to reconcile deliveries' using errcode='42501';end if;
 if data ? 'cursor' and data->'cursor'<>'null'::jsonb then
  if data->'cursor'->>'actorId' is distinct from auth.uid()::text or data->'cursor'->>'scope' is distinct from 'shipment_obligations' then raise exception 'Refresh delivery obligations' using errcode='22023';end if;
  after_id:=(data->'cursor'->>'id')::uuid;if after_id is null then raise exception 'Invalid delivery cursor' using errcode='22023';end if;
 end if;
 with page as materialized(select s.*,
  exists(select 1 from public.staff_memberships m where m.organization_id=s.organization_id and m.user_id=auth.uid() and m.active and m.role='owner') owner
  from app_private.branch_shipments s join app_private.branch_network_configuration c on c.organization_id=s.organization_id
  where c.activated_at is not null and s.created_at>=c.activated_at and (after_id is null or s.id>after_id)
  and (exists(select 1 from public.stock_transfers t where t.organization_id=s.organization_id and t.shipment_id=s.id and t.state='in_transit') or exists(select 1 from public.stock_holds h join public.stock_control_events e on e.id=h.source_id join public.stock_transfers t on t.id=e.source_id where h.organization_id=s.organization_id and h.remaining>0 and t.shipment_id=s.id and e.action in('receive_transfer','compensate_transfer') and (h.branch_id=s.destination_branch_id or exists(select 1 from public.staff_memberships m where m.organization_id=s.organization_id and m.user_id=auth.uid() and m.active and m.role='owner'))))
  and exists(select 1 from app_private.branch_network_branches n where n.organization_id=s.organization_id and n.branch_id=s.branch_id)
  and exists(select 1 from app_private.branch_network_branches n where n.organization_id=s.organization_id and n.branch_id=s.destination_branch_id and n.can_receive)
  and exists(select 1 from public.staff_memberships m where m.organization_id=s.organization_id and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.branch_id=s.destination_branch_id and m.role in('manager','stock_staff'))))
  order by s.id limit 51),visible as(select * from page order by id limit 50)
 select jsonb_build_object('actorId',auth.uid(),'items',coalesce((select jsonb_agg(jsonb_build_object('organizationId',v.organization_id,'branchId',v.destination_branch_id,'owner',v.owner,'shipment',app_private.shipment_projection(v.organization_id,v.id)) order by v.id) from visible v),'[]'::jsonb),
 'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope','shipment_obligations','actorId',auth.uid(),'id',id) from visible order by id desc limit 1) else null end) into answer;
 return answer;
end$$;
revoke all on function app_private.shipment_obligations(jsonb) from public,anon,authenticated;
do $discovery_gate$ declare src text;anchor text:='if action in(''receive_branch_shipment'',''write_off_branch_shipment'',''compensate_branch_shipment'',''return_branch_shipment'',''shipment_obligations'') then';begin
 src:=pg_get_functiondef('app_private.require_enabled_branch(text,jsonb)'::regprocedure);
 if strpos(src,anchor)=0 then raise exception 'Review discovery gateway';end if;
 execute replace(src,anchor,'if action=''shipment_obligations'' then if auth.uid() is null or coalesce((auth.jwt()->>''is_anonymous'')::boolean,false) or not exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>''session_id'')::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now())) then raise exception ''Sign in again to reconcile deliveries'' using errcode=''42501'';end if;return;end if;'||anchor);
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);anchor:='return app_private.command_before_shipment_receiving(action,data);';
 if strpos(src,anchor)=0 then raise exception 'Review discovery dispatcher';end if;
 execute replace(src,anchor,'if action=''shipment_obligations'' then return app_private.shipment_obligations(data);end if;'||anchor);
end $discovery_gate$;
-- Owner inspection reuses ordinary release/dispose journal semantics; this
-- deliberately creates neither a supplier return nor an invented purchase cost.
create function app_private.post_hold_disposition(org uuid,branch uuid,held public.stock_holds,ident uuid,q numeric,disposition text,data jsonb) returns void language plpgsql security definer set search_path='' as $$begin
 if disposition='release' then
  if exists(select 1 from public.product_batches where id=held.batch_id and expires_on<(now() at time zone 'Asia/Manila')::date) then raise exception 'Expired held goods cannot be released for sale';end if;
  insert into public.inventory_movements(organization_id,branch_id,product_id,batch_id,quantity,kind,source_id,created_by) values(org,branch,held.product_id,held.batch_id,q,'hold_release',ident,auth.uid());
 end if;
 update public.stock_holds h set remaining=h.remaining-q where h.id=held.id;
 insert into public.stock_control_events values(ident,org,branch,'disposition_hold',held.id,auth.uid(),data,now());
end$$;
revoke all on function app_private.post_hold_disposition(uuid,uuid,public.stock_holds,uuid,numeric,text,jsonb) from public,anon,authenticated;
do $hold_extract$ declare fn regprocedure;src text;first_at int;last_at int;begin
 select p.oid::regprocedure into strict fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.prosrc like '%elsif action in (''receive_transfer'',''write_off_transfer'') then%';
 src:=pg_get_functiondef(fn);first_at:=strpos(src,'  if disposition=''release'' then');last_at:=strpos(src,' elsif action=''approve_count'' then');
 if first_at=0 or last_at<=first_at then raise exception 'Review hold posting extraction';end if;
 execute left(src,first_at-1)||E'  perform app_private.post_hold_disposition(org,branch,held,ident,q,disposition,data);\n'||substr(src,last_at);
end $hold_extract$;
create function app_private.disposition_branch_shipment_hold(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;ident uuid:=(data->>'requestId')::uuid;shipment uuid:=(data->>'shipmentId')::uuid;
 prior app_private.branch_shipment_events;held public.stock_holds;s app_private.branch_shipments;l app_private.branch_shipment_lines;
 lock_branch uuid;disposition text:=data->>'disposition';q numeric:=(data->>'quantity')::numeric;result jsonb;
begin
 if ident is null or not app_private.membership_access(org,branch) then raise exception 'Held shipment access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(ident::text,8301));
 select * into prior from app_private.branch_shipment_events e where e.id=ident;
 if found then
  if prior.organization_id=org and prior.branch_id=branch and prior.actor_id=auth.uid() and prior.action='disposition_branch_shipment_hold' and prior.payload=data then return prior.result||'{"duplicate":true}'::jsonb;end if;
  raise exception 'Held shipment reference already has different details' using errcode='22023';
 end if;
 select * into s from app_private.branch_shipments x where x.organization_id=org and x.id=shipment;
 if s.id is null or branch not in(s.branch_id,s.destination_branch_id) then raise exception 'Held shipment location not found' using errcode='42501';end if;
 for lock_branch in select x from unnest(array[s.branch_id,s.destination_branch_id]) x order by x loop perform pg_advisory_xact_lock(hashtextextended(org::text||lock_branch::text,1));end loop;
 if not app_private.membership_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner')
 or not exists(select 1 from app_private.branch_network_configuration c where c.organization_id=org and c.activated_at is not null and s.created_at>=c.activated_at)
 or not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=branch and (n.can_receive or (branch=s.branch_id and exists(select 1 from public.stock_holds h join public.stock_control_events e on e.id=h.source_id where h.organization_id=org and h.id=(data->>'holdId')::uuid and h.branch_id=branch and e.action='compensate_transfer')))) then raise exception 'Owner access to activated held shipment required' using errcode='42501';end if;
 select x.* into held from public.stock_holds x join public.stock_control_events e on e.id=x.source_id join app_private.branch_shipment_lines sl on sl.id=e.source_id
 where x.organization_id=org and x.id=(data->>'holdId')::uuid and x.branch_id=branch and e.action in('receive_transfer','compensate_transfer') and sl.organization_id=org and sl.shipment_id=shipment for update of x;
 select sl.* into l from app_private.branch_shipment_lines sl join public.stock_control_events e on e.source_id=sl.id where e.id=held.source_id;
 if held.id is null or (data->>'observedBranchId')::uuid is distinct from branch or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000 or length(btrim(coalesce(data->>'evidenceReference',''))) not between 3 and 1000 then raise exception 'Record identified hold, physical location and inspection evidence' using errcode='22023';end if;
 if q is null or q in('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or q<=0 or q>held.remaining or scale(trim_scale(q))>6 or (l.base_unit='piece' and q<>trunc(q)) or disposition is null or disposition not in('release','dispose') then raise exception 'Enter inspected base quantity and release or dispose' using errcode='22023';end if;
 if disposition='release' and (l.batch_expires_on<(now() at time zone 'Asia/Manila')::date or exists(select 1 from public.product_batches b where b.id=l.batch_id and b.expires_on<(now() at time zone 'Asia/Manila')::date)) then raise exception 'Expired shipment hold cannot be released' using errcode='22023';end if;
 perform app_private.post_hold_disposition(org,branch,held,gen_random_uuid(),q,disposition,jsonb_build_object('shipmentEventId',ident,'quantity',trim_scale(q)::text,'disposition',disposition,'reason',data->>'reason','evidenceReference',data->>'evidenceReference'));
 result:=jsonb_build_object('id',ident,'shipmentId',shipment,'holdId',held.id,'quantity',trim_scale(q)::text,'disposition',disposition,'action','disposition_branch_shipment_hold','duplicate',false);
 insert into app_private.branch_shipment_events(id,organization_id,branch_id,shipment_id,action,actor_id,session_id,payload,result) values(ident,org,branch,shipment,'disposition_branch_shipment_hold',auth.uid(),(auth.jwt()->>'session_id')::uuid,data,result);
 return result;
end$$;
revoke all on function app_private.disposition_branch_shipment_hold(jsonb) from public,anon,authenticated;
do $hold_gate$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.require_enabled_branch(text,jsonb)'::regprocedure);anchor:='if not managed then return;end if;';
 if strpos(src,anchor)=0 then raise exception 'Review held shipment gateway';end if;
 execute replace(src,anchor,$insert$
 if action='disposition_hold' and exists(select 1 from public.stock_holds h join public.stock_control_events e on e.id=h.source_id join public.stock_transfers t on t.id=e.source_id where h.organization_id=org and h.id=(data->>'holdId')::uuid and t.shipment_id is not null and e.action in('receive_transfer','compensate_transfer')) then raise exception 'Use the evidenced shipment hold workflow' using errcode='42501';end if;
 if action='disposition_branch_shipment_hold' then if not app_private.membership_access(org,branch) then raise exception 'Held shipment access denied' using errcode='42501';end if;return;end if;
 if not managed then return;end if;
 $insert$);
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);anchor:='return app_private.command_before_shipment_receiving(action,data);';
 if strpos(src,anchor)=0 then raise exception 'Review held shipment dispatcher';end if;
 execute replace(src,anchor,'if action=''disposition_branch_shipment_hold'' then return app_private.disposition_branch_shipment_hold(data);end if;'||anchor);
end $hold_gate$;
