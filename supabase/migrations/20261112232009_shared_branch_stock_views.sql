-- Shared catalog identity is availability, never an opening balance. All reads
-- below project existing journals/holds/transfers; this migration writes no
-- catalog, branch, price, entitlement or quantity data.
create index holds_branch_product_batch on public.stock_holds(organization_id,branch_id,product_id,batch_id) where remaining>0;
create index transfers_outstanding_source on public.stock_transfers(organization_id,branch_id,product_id,batch_id) where state='in_transit';
create index transfers_outstanding_destination on public.stock_transfers(organization_id,destination_branch_id,product_id,batch_id) where state='in_transit';

-- Only the authorized private read model calls this invoker helper. Usable is
-- already the movement projection: hold_out removed held goods, so subtracting
-- holds a second time would understate it. Transfers contain base quantities.
create function app_private.branch_stock_rows(org uuid,allowed uuid[])
returns table(product_id uuid,batch_id uuid,base_unit text,usable numeric,held numeric,in_transit_in numeric,in_transit_out numeric)
language sql stable security invoker set search_path='' as $$
 with quantities as (
  select i.product_id,i.batch_id,i.quantity usable,0::numeric held,0::numeric incoming,0::numeric outgoing
  from public.branch_inventory i where i.organization_id=org and i.branch_id=any(allowed)
  union all
  select h.product_id,h.batch_id,0,h.remaining,0,0 from public.stock_holds h
  where h.organization_id=org and h.branch_id=any(allowed) and h.remaining>0
  union all
  select t.product_id,t.batch_id,0,0,
   case when t.destination_branch_id=any(allowed) then t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity else 0 end,
   case when t.branch_id=any(allowed) then t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity else 0 end
  from public.stock_transfers t
  where t.organization_id=org and t.state='in_transit' and app_private.network_enabled(org)
   and (t.branch_id=any(allowed) or t.destination_branch_id=any(allowed))
   and app_private.network_branch_allowed(org,t.branch_id) and app_private.network_branch_allowed(org,t.destination_branch_id)
   and exists(select 1 from public.branches b where b.organization_id=org and b.id=t.branch_id and b.active)
   and exists(select 1 from public.branches b where b.organization_id=org and b.id=t.destination_branch_id and b.active)
 ), balances as (
  select q.product_id,q.batch_id,sum(q.usable) usable,sum(q.held) held,sum(q.incoming) incoming,sum(q.outgoing) outgoing
  from quantities q group by q.product_id,q.batch_id
 )
 select p.id,b.batch_id,p.base_unit,coalesce(b.usable,0),coalesce(b.held,0),coalesce(b.incoming,0),coalesce(b.outgoing,0)
 from public.products p left join balances b on b.product_id=p.id
 where p.organization_id=org and p.active
$$;
revoke all on function app_private.branch_stock_rows(uuid,uuid[]) from public,anon,authenticated;

create function app_private.read_branch_stock(action text,data jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 org uuid:=(data->>'organizationId')::uuid; branch uuid:=(data->>'branchId')::uuid;
 network boolean:=action='network_stock'; allowed uuid[]; search text:=coalesce(data->>'query','');
 cursor jsonb:=data->'cursor'; after_product uuid; after_batch uuid;
 zero_batch constant uuid:='00000000-0000-0000-0000-000000000000';
 checked timestamptz:=statement_timestamp(); result jsonb;
begin
 if action not in('branch_stock','network_stock') then raise exception 'Unknown stock read';end if;
 if org is null or branch is null or not app_private.can_access(org,branch)
 or not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch and b.active) then
  raise exception 'Branch stock access denied' using errcode='42501';
 end if;
 -- This explicit gate is essential: new read names are not automatically
 -- recognized as transfer actions by the legacy gateway.
 if network and (not app_private.network_enabled(org) or not exists(
  select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner')) then
  raise exception 'Owner access to an enabled branch stock network is required' using errcode='42501';
 end if;
 if (data ? 'query' and jsonb_typeof(data->'query') is distinct from 'string') or length(search)>180 then
  raise exception 'Enter a product search up to 180 characters' using errcode='22023';
 end if;
 if cursor is not null and cursor<>'null'::jsonb then
  if jsonb_typeof(cursor) is distinct from 'object'
   or cursor->>'scope' is distinct from action
   or cursor->>'organizationId' is distinct from org::text
   or cursor->>'branchId' is distinct from branch::text
   or cursor->>'query' is distinct from search
   or jsonb_typeof(cursor->'productId') is distinct from 'string'
   or (not network and (not cursor ? 'batchId' or jsonb_typeof(cursor->'batchId') not in('string','null'))) then
   raise exception 'Refresh stock after changing branch or search' using errcode='22023';
  end if;
  begin
   after_product:=(cursor->>'productId')::uuid;
   after_batch:=coalesce((cursor->>'batchId')::uuid,zero_batch);
  exception when invalid_text_representation then
   raise exception 'Invalid stock cursor' using errcode='22023';
  end;
 end if;
 if network then
  select array_agg(b.id) into allowed from public.branches b
  where b.organization_id=org and b.active and app_private.network_branch_allowed(org,b.id);
 else allowed:=array[branch];end if;

 if network then
  with matches as materialized (
   select r.product_id,r.base_unit,sum(r.usable) usable,sum(r.held) held,sum(r.in_transit_out) transit
   from app_private.branch_stock_rows(org,allowed) r join public.products p on p.id=r.product_id
   where search='' or strpos(lower(p.name||' '||p.sku),lower(search))>0
   group by r.product_id,r.base_unit
  ), page as materialized (
   select * from matches where after_product is null or product_id>after_product order by product_id limit 51
  ), visible as (select * from page order by product_id limit 50)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
   'productId',v.product_id,'baseUnit',v.base_unit,'usable',trim_scale(v.usable)::text,
   'held',trim_scale(v.held)::text,'inTransit',trim_scale(v.transit)::text) order by v.product_id) from visible v),'[]'::jsonb),
   'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope',action,'organizationId',org,'branchId',branch,'query',search,'productId',v.product_id) from visible v order by v.product_id desc limit 1) else null end,
   'checkedAt',checked) into result;
 else
  with page as materialized (
   select r.* from app_private.branch_stock_rows(org,allowed) r join public.products p on p.id=r.product_id
   where (search='' or strpos(lower(p.name||' '||p.sku),lower(search))>0)
    and (after_product is null or (r.product_id,coalesce(r.batch_id,zero_batch))>(after_product,after_batch))
   order by r.product_id,coalesce(r.batch_id,zero_batch) limit 51
  ), visible as (select * from page order by product_id,coalesce(batch_id,zero_batch) limit 50)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
   'productId',v.product_id,'batchId',v.batch_id,'baseUnit',v.base_unit,'usable',trim_scale(v.usable)::text,
   'held',trim_scale(v.held)::text,'inTransitIn',trim_scale(v.in_transit_in)::text,'inTransitOut',trim_scale(v.in_transit_out)::text)
   order by v.product_id,coalesce(v.batch_id,zero_batch)) from visible v),'[]'::jsonb),
   'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope',action,'organizationId',org,'branchId',branch,'query',search,'productId',v.product_id,'batchId',v.batch_id) from visible v order by v.product_id desc,coalesce(v.batch_id,zero_batch) desc limit 1) else null end,
   'checkedAt',checked) into result;
 end if;
 return result;
end $$;
revoke all on function app_private.read_branch_stock(text,jsonb) from public,anon,authenticated;

-- Keep public RPC and the callable shared dispatcher on exactly the same gate.
do $route$ declare src text; anchor text:='if action=''branch_network'' then return app_private.branch_network(org);end if;';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if strpos(src,anchor)=0 then raise exception 'Branch network dispatcher changed; review stock read routing';end if;
 execute replace(src,anchor,anchor||E'\n if action in(''branch_stock'',''network_stock'') then return app_private.read_branch_stock(action,data);end if;');
end $route$;
