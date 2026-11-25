-- Bound and aggregate the visible product page once across approved branches.
create or replace function app_private.branch_network_overview(data jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid; working uuid:=(data->>'branchId')::uuid;
 kind text:=coalesce(data->>'kind','stock'); cursor jsonb:=data->'cursor'; after_id uuid; allowed uuid[]; answer jsonb; checked timestamptz:=statement_timestamp();
begin
 if not app_private.network_enabled(org) or not app_private.can_access(org,working) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner') then raise exception 'Owner access to an enabled network is required' using errcode='42501';end if;
 if kind not in ('stock','shipments') then raise exception 'Unknown overview page' using errcode='22023';end if;
 if cursor is not null and cursor<>'null'::jsonb then
  if cursor->>'scope' is distinct from kind or cursor->>'organizationId' is distinct from org::text or cursor->>'workingBranchId' is distinct from working::text or cursor->>'actorId' is distinct from auth.uid()::text then raise exception 'Refresh the report scope' using errcode='22023';end if;
  begin after_id:=(cursor->>'id')::uuid; exception when invalid_text_representation then raise exception 'Invalid report cursor' using errcode='22023';end;
  if after_id is null then raise exception 'Invalid report cursor' using errcode='22023';end if;
 end if;
 select array_agg(b.id) into allowed from public.branches b where b.organization_id=org and b.active and app_private.network_branch_allowed(org,b.id);
 if kind='stock' then
  -- Restrict every ledger input to the visible product page before grouping.
  with page as materialized (select p.* from public.products p where p.organization_id=org and p.active and (after_id is null or p.id>after_id) order by p.id limit 51),
  visible as materialized (select * from page order by id limit 50),
  inventory as materialized (
   select i.product_id,i.branch_id,i.quantity,pb.expires_on from public.branch_inventory i
   join visible v on v.id=i.product_id left join public.product_batches pb on pb.id=i.batch_id and pb.organization_id=org
   where i.organization_id=org and i.branch_id=any(allowed)
  ), holds as materialized (
   select h.product_id,h.branch_id,h.remaining,pb.expires_on from public.stock_holds h
   join visible v on v.id=h.product_id left join public.product_batches pb on pb.id=h.batch_id and pb.organization_id=org
   where h.organization_id=org and h.branch_id=any(allowed) and h.remaining>0
  ), transfers as materialized (
   select t.product_id,t.branch_id,t.destination_branch_id,t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity-t.returned_quantity as outstanding,
    sl.held_in_transit,sl.batch_expires_on,pb.expires_on
   from public.stock_transfers t join visible v on v.id=t.product_id
   left join app_private.branch_shipment_lines sl on sl.id=t.id and sl.organization_id=org
   left join public.product_batches pb on pb.id=t.batch_id and pb.organization_id=org
   where t.organization_id=org and t.state='in_transit' and t.branch_id=any(allowed) and t.destination_branch_id=any(allowed)
  ), contributions as (
   select i.product_id,i.branch_id,i.quantity usable,0::numeric held,0::numeric incoming,0::numeric outgoing,
    case when i.expires_on is null or i.expires_on >= (now() at time zone 'Asia/Manila')::date then i.quantity else 0 end planning_on_hand,
    0::numeric planning_incoming,case when i.expires_on <= (now() at time zone 'Asia/Manila')::date+90 then i.quantity else 0 end near_expiry from inventory i
   union all
   select h.product_id,h.branch_id,0,h.remaining,0,0,0,0,case when h.expires_on <= (now() at time zone 'Asia/Manila')::date+90 then h.remaining else 0 end from holds h
   union all
   select t.product_id,t.branch_id,0,0,0,t.outstanding,0,0,0 from transfers t
   union all
   select t.product_id,t.destination_branch_id,0,0,t.outstanding,0,0,
    case when not coalesce(t.held_in_transit,false) and (t.batch_expires_on is null or t.batch_expires_on >= (now() at time zone 'Asia/Manila')::date) and (t.expires_on is null or t.expires_on >= (now() at time zone 'Asia/Manila')::date) then t.outstanding else 0 end,0 from transfers t
  ), balances as materialized (
   select c.product_id,c.branch_id,sum(c.usable) usable,sum(c.held) held,sum(c.incoming) incoming,sum(c.outgoing) outgoing,sum(c.planning_on_hand) planning_on_hand,sum(c.planning_incoming) planning_incoming,sum(c.near_expiry) near_expiry
   from contributions c group by c.product_id,c.branch_id
  ), totals as materialized (
   select product_id,sum(usable) usable,sum(held) held,sum(outgoing) transit from balances group by product_id
  ), branch_rows as materialized (
   select v.id product_id,jsonb_agg(jsonb_build_object('branchId',b.id,'name',b.name,'usable',trim_scale(coalesce(x.usable,0))::text,'held',trim_scale(coalesce(x.held,0))::text,'incoming',trim_scale(coalesce(x.incoming,0))::text,'outgoing',trim_scale(coalesce(x.outgoing,0))::text,'planningOnHand',trim_scale(coalesce(x.planning_on_hand,0))::text,'planningIncoming',trim_scale(coalesce(x.planning_incoming,0))::text,'nearExpiry',trim_scale(coalesce(x.near_expiry,0))::text) order by b.id) branches
   from visible v cross join public.branches b left join balances x on x.product_id=v.id and x.branch_id=b.id
   where b.id=any(allowed) and b.organization_id=org group by v.id
  )
  select jsonb_build_object('kind',kind,'organizationId',org,'checkedAt',checked,'items',coalesce((select jsonb_agg(jsonb_build_object('productId',v.id,'name',v.name,'sku',v.sku,'baseUnit',v.base_unit,'minimumStock',trim_scale(v.minimum_stock)::text,'branches',coalesce(br.branches,'[]'::jsonb),'usable',trim_scale(coalesce(t.usable,0))::text,'held',trim_scale(coalesce(t.held,0))::text,'transit',trim_scale(coalesce(t.transit,0))::text) order by v.id)
   from visible v left join totals t on t.product_id=v.id left join branch_rows br on br.product_id=v.id),'[]'::jsonb),
   'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope',kind,'organizationId',org,'workingBranchId',working,'actorId',auth.uid(),'id',id) from visible order by id desc limit 1) else null end) into answer;
 else
  with page as materialized (select s.* from app_private.branch_shipments s where s.organization_id=org and s.branch_id=any(allowed) and s.destination_branch_id=any(allowed) and (after_id is null or s.id>after_id) order by s.id limit 51),visible as(select * from page order by id limit 50)
  select jsonb_build_object('kind',kind,'organizationId',org,'checkedAt',checked,'items',coalesce((select jsonb_agg(app_private.shipment_projection(org,s.id)||jsonb_build_object('sourceName',s.source_name,'destinationName',s.destination_name,'createdAt',s.created_at,'expectedArrival',s.payload->>'expectedArrival') order by s.id) from visible s),'[]'::jsonb),
   'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope',kind,'organizationId',org,'workingBranchId',working,'actorId',auth.uid(),'id',id) from visible order by id desc limit 1) else null end) into answer;
 end if;
 return answer;
end$$;
