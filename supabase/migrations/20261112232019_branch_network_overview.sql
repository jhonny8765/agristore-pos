-- Owner-only, entitlement-gated read model. No writes to operational or financial journals.
create function app_private.branch_network_overview(data jsonb) returns jsonb
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
  with page as materialized (select p.* from public.products p where p.organization_id=org and p.active and (after_id is null or p.id>after_id) order by p.id limit 51), visible as (select * from page order by id limit 50)
  select jsonb_build_object('kind',kind,'organizationId',org,'checkedAt',checked,'items',coalesce((select jsonb_agg(jsonb_build_object('productId',p.id,'name',p.name,'sku',p.sku,'baseUnit',p.base_unit,'minimumStock',trim_scale(p.minimum_stock)::text,
   'branches',coalesce((select jsonb_agg(jsonb_build_object('branchId',b.id,'name',b.name,'usable',trim_scale(coalesce(r.usable,0))::text,'held',trim_scale(coalesce(r.held,0))::text,'incoming',trim_scale(coalesce(r.incoming,0))::text,'outgoing',trim_scale(coalesce(r.outgoing,0))::text,
    'planningOnHand',trim_scale(coalesce((select sum(i.quantity) from public.branch_inventory i left join public.product_batches pb on pb.id=i.batch_id and pb.organization_id=org where i.organization_id=org and i.branch_id=b.id and i.product_id=p.id and (i.batch_id is null or pb.expires_on is null or pb.expires_on >= (now() at time zone 'Asia/Manila')::date)),0))::text,
    'planningIncoming',trim_scale(coalesce((select sum(t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity-t.returned_quantity) from public.stock_transfers t left join app_private.branch_shipment_lines sl on sl.id=t.id and sl.organization_id=org left join public.product_batches pb on pb.id=t.batch_id and pb.organization_id=org where t.organization_id=org and t.product_id=p.id and t.destination_branch_id=b.id and t.branch_id=any(allowed) and t.state='in_transit' and not coalesce(sl.held_in_transit,false) and (sl.batch_expires_on is null or sl.batch_expires_on >= (now() at time zone 'Asia/Manila')::date) and (pb.expires_on is null or pb.expires_on >= (now() at time zone 'Asia/Manila')::date)),0))::text,
    'nearExpiry',trim_scale(coalesce((select sum(i.quantity) from public.branch_inventory i join public.product_batches pb on pb.id=i.batch_id and pb.organization_id=org where i.organization_id=org and i.branch_id=b.id and i.product_id=p.id and pb.expires_on<=(now() at time zone 'Asia/Manila')::date+90),0)+coalesce((select sum(h.remaining) from public.stock_holds h join public.product_batches pb on pb.id=h.batch_id and pb.organization_id=org where h.organization_id=org and h.branch_id=b.id and h.product_id=p.id and pb.expires_on<=(now() at time zone 'Asia/Manila')::date+90),0))::text) order by b.id)
    from public.branches b left join lateral (select sum(s.usable) usable,sum(s.held) held,sum(s.in_transit_in) incoming,sum(s.in_transit_out) outgoing from app_private.branch_stock_rows(org,array[b.id]) s where s.product_id=p.id) r on true where b.id=any(allowed)),'[]'::jsonb),
   'usable',trim_scale(coalesce(t.usable,0))::text,'held',trim_scale(coalesce(t.held,0))::text,'transit',trim_scale(coalesce(t.transit,0))::text) order by p.id)
   from visible p left join lateral (select sum(s.usable) usable,sum(s.held) held,sum(s.in_transit_out) transit from app_private.branch_stock_rows(org,allowed) s where s.product_id=p.id) t on true),'[]'::jsonb),
   'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope',kind,'organizationId',org,'workingBranchId',working,'actorId',auth.uid(),'id',id) from visible order by id desc limit 1) else null end) into answer;
 else
  with page as materialized (select s.* from app_private.branch_shipments s where s.organization_id=org and s.branch_id=any(allowed) and s.destination_branch_id=any(allowed) and (after_id is null or s.id>after_id) order by s.id limit 51),visible as(select * from page order by id limit 50)
  select jsonb_build_object('kind',kind,'organizationId',org,'checkedAt',checked,'items',coalesce((select jsonb_agg(app_private.shipment_projection(org,s.id)||jsonb_build_object('sourceName',s.source_name,'destinationName',s.destination_name,'createdAt',s.created_at,'expectedArrival',s.payload->>'expectedArrival') order by s.id) from visible s),'[]'::jsonb),
   'next',case when (select count(*) from page)>50 then (select jsonb_build_object('scope',kind,'organizationId',org,'workingBranchId',working,'actorId',auth.uid(),'id',id) from visible order by id desc limit 1) else null end) into answer;
 end if;
 return answer;
end$$;
revoke all on function app_private.branch_network_overview(jsonb) from public,anon,authenticated;
alter function app_private.command(text,jsonb) rename to command_before_network_overview;
revoke all on function app_private.command_before_network_overview(text,jsonb) from public,anon,authenticated;
create function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform app_private.require_enabled_branch(action,data);
 if action='branch_network_overview' then return app_private.branch_network_overview(data);end if;
 return app_private.command_before_network_overview(action,data);
end$$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;
