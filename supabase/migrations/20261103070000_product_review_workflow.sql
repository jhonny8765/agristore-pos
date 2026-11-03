-- Preserve source quantities separately from usable stock. This metadata alone
-- never creates a movement, a purchase, a payment, or a new selling unit.
alter table public.products add column source_stock jsonb;
alter table public.products add constraint product_source_stock_object check(source_stock is null or jsonb_typeof(source_stock)='object');

create function app_private.with_source_stock(snapshot jsonb,data jsonb) returns jsonb language sql stable set search_path='' as $$
 select case when snapshot->'products' is null then snapshot else jsonb_set(snapshot,'{products}',coalesce((
  select jsonb_agg(e.value||jsonb_build_object('sourceStock',case when p.source_stock->>'branchId'=data->>'branchId' then p.source_stock else null end) order by e.n)
  from jsonb_array_elements(snapshot->'products') with ordinality e(value,n)
  join public.products p on p.id=(e.value->>'id')::uuid and p.organization_id=(data->>'organizationId')::uuid),'[]')) end
$$;
revoke all on function app_private.with_source_stock(jsonb,jsonb) from public,anon,authenticated;

create function app_private.product_review_command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;uid uuid:=auth.uid();ident uuid:=(data->>'requestId')::uuid;
 p public.products;u public.product_units;v public.unit_prices;previous public.stock_control_events;price_value bigint;cost_value bigint;
 factor_value numeric;q numeric;target numeric;current_q numeric;revision bigint;new_base text;reason text:=btrim(coalesce(data->>'reason',''));
begin
 perform app_private.command_before_customer_credit('dashboard',data);
 if not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=uid and m.active and m.role='owner') then raise exception 'Only the owner can review imported products' using errcode='42501';end if;
 if not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch) then raise exception 'Choose a branch in this business';end if;
 if action='product_review_state' then
  if not exists(select 1 from public.products where organization_id=org and id=(data->>'productId')::uuid and active) then raise exception 'Choose an active product in this business';end if;
  return (select jsonb_build_object('stock',coalesce((select sum(quantity) from public.branch_inventory where organization_id=org and branch_id=branch and product_id=rp.id),0)::text,
   'revision',coalesce((select max(id) from public.inventory_movements where organization_id=org and branch_id=branch and product_id=rp.id),0)::text,
   'sourceStock',case when rp.source_stock->>'branchId'=branch::text then rp.source_stock else null end,
   'asOf',statement_timestamp(),'shiftOpen',exists(select 1 from public.cashier_shifts where organization_id=org and branch_id=branch and closed_at is null)) from public.products rp where rp.id=(data->>'productId')::uuid and rp.organization_id=org);
 end if;
 if ident is null or data->'confirmed' is distinct from 'true'::jsonb or length(reason) not between 3 and 1000 then raise exception 'Confirm the reviewed values and enter a reason';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
 select * into previous from public.stock_control_events e where e.organization_id=org and e.id=ident;
 if found then
  if previous.action<>action or previous.branch_id<>branch or previous.actor_id<>uid or previous.payload<>data then raise exception 'This request reference belongs to different reviewed values';end if;
  return jsonb_build_object('id',ident,'duplicate',true);
 end if;
 select * into p from public.products where organization_id=org and id=(data->>'productId')::uuid and active for update;
 if p.id is null then raise exception 'Choose an active product in this business';end if;
 select * into u from public.product_units where organization_id=org and product_id=p.id and id=(data->>'unitId')::uuid for update;
 if u.id is null or (data->>'expectedPriceVersion')::integer is distinct from u.price_version then raise exception 'The selling unit or price changed. Refresh and review it again';end if;
 select * into v from public.unit_prices where organization_id=org and unit_id=u.id and version=u.price_version;
 if action='confirm_import_stock' then
  if p.setup_pending or p.source_stock is null or (p.source_stock->>'branchId') is distinct from branch::text or p.source_stock->'pending' is distinct from 'true'::jsonb then raise exception 'Confirm the unit first and choose an unposted source balance';end if;
  if data->>'sourceHash' is distinct from p.source_stock->>'sha256' then raise exception 'The source evidence changed. Refresh before posting stock';end if;
  if exists(select 1 from public.cashier_shifts where organization_id=org and branch_id=branch and closed_at is null) then raise exception 'Close and synchronize the branch shift before reviewing a starting balance';end if;
  if exists(select 1 from public.stock_holds where organization_id=org and branch_id=branch and product_id=p.id and remaining>0)
    or exists(select 1 from public.stock_transfers where organization_id=org and state='in_transit' and product_id=p.id) then raise exception 'Resolve held or in-transit stock before changing a starting balance';end if;
  select coalesce(sum(quantity),0) into current_q from public.branch_inventory where organization_id=org and branch_id=branch and product_id=p.id;
  select coalesce(max(id),0) into revision from public.inventory_movements where organization_id=org and branch_id=branch and product_id=p.id;
  if (data->>'expectedRevision')::bigint is distinct from revision or (data->>'expectedStock')::numeric is distinct from current_q then raise exception 'Stock changed. Refresh and review the balance again';end if;
  if exists(select 1 from public.branch_inventory where organization_id=org and branch_id=branch and product_id=p.id and batch_id is not null and quantity<>0) or p.tracks_expiry then raise exception 'Use batch-aware stock counting for this product';end if;
  if coalesce(data->>'quantity','')!~'^\d{1,12}(\.\d{1,6})?$' then raise exception 'Enter the reviewed current quantity in the selected selling unit';end if;
  q:=(data->>'quantity')::numeric;target:=q*u.factor;
  if target>99999999999999 or scale(trim_scale(target))>6 or (p.base_unit='piece' and target<>trunc(target)) then raise exception 'The reviewed balance must use exact supported stock quantities';end if;
  if target<>current_q then insert into public.inventory_movements(organization_id,branch_id,product_id,quantity,kind,source_id,created_by) values(org,branch,p.id,target-current_q,'adjustment',ident,uid);end if;
  update public.products set source_stock=source_stock||jsonb_build_object('pending',false,'postedAt',now(),'postedRequestId',ident,'reviewedTarget',target::text) where id=p.id;
 elsif action in('review_import_setup','review_product_price') then
  if jsonb_typeof(data->'price') is distinct from 'number' or (data->>'price')!~'^\d{1,16}$' or (data->>'price')::numeric not between 1 and 9007199254740991 then raise exception 'Enter a positive selling price in exact centavos';end if;
  price_value:=(data->>'price')::bigint;cost_value:=v.cost;
  if data->'cost' is not null and data->'cost'<>'null'::jsonb then
   if jsonb_typeof(data->'cost') is distinct from 'number' or (data->>'cost')!~'^\d{1,16}$' or (data->>'cost')::numeric not between 0 and 9007199254740991 then raise exception 'Enter an exact non-negative cost or leave it unconfirmed';end if;
   cost_value:=(data->>'cost')::bigint;
  end if;
  if action='review_import_setup' then
   if not p.setup_pending then raise exception 'This unit is already configured. Update its price or cost instead';end if;
   if exists(select 1 from public.inventory_movements where organization_id=org and product_id=p.id) or exists(select 1 from public.sale_items where organization_id=org and product_id=p.id)
    or exists(select 1 from app_private.purchase_order_lines where organization_id=org and product_id=p.id) or exists(select 1 from public.stock_holds where organization_id=org and product_id=p.id)
    or exists(select 1 from app_private.blind_counts where organization_id=org and product_id=p.id) then raise exception 'This product has recorded activity. Its unit needs a controlled replacement; price and cost can be updated separately';end if;
   new_base:=data->>'baseUnit';
   if new_base is null or new_base not in('piece','kg','liter','meter') or length(btrim(coalesce(data->>'unitName',''))) not between 1 and 40 or coalesce(data->>'factor','')!~'^\d{1,12}(\.\d{1,6})?$' then raise exception 'Choose the stock measurement, selling unit and exact conversion';end if;
   factor_value:=(data->>'factor')::numeric;
   if factor_value<=0 or (new_base='piece' and factor_value<>trunc(factor_value)) then raise exception 'Piece conversions must be whole; every conversion must be positive';end if;
   update public.product_units set name=btrim(data->>'unitName'),factor=factor_value where id=u.id;
   update public.products set base_unit=new_base,setup_pending=false where id=p.id;
  end if;
  insert into public.unit_prices(organization_id,unit_id,version,price,cost) values(org,u.id,u.price_version+1,price_value,cost_value);
  update public.product_units set price_version=u.price_version+1 where id=u.id;
  update public.products set price_pending=false,cost_pending=case when data->'cost' is null or data->'cost'='null'::jsonb then cost_pending else false end where id=p.id;
 else raise exception 'Unknown product review action';end if;
 insert into public.stock_control_events(id,organization_id,branch_id,action,source_id,actor_id,payload) values(ident,org,branch,action,p.id,uid,data);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,p.id,jsonb_build_object('requestId',ident,'reason',reason,'reviewed',data,'previousPriceVersion',u.price_version,'previousBaseUnit',p.base_unit,'sourceEvidence',p.source_stock));
 return jsonb_build_object('id',ident,'duplicate',false);
end$$;
revoke all on function app_private.product_review_command(text,jsonb) from public,anon,authenticated;

do $review_route$declare src text;anchor text:=' if action in (''supplier_account_book''';fallback text:=' return app_private.command_before_customer_credit(action,data);';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 or (length(src)-length(replace(src,fallback,'')))/length(fallback)<>1 then raise exception 'Review dispatcher anchors changed';end if;
 src:=replace(src,anchor,E' if action in (''product_review_state'',''review_import_setup'',''review_product_price'',''confirm_import_stock'') then return app_private.product_review_command(action,data);end if;\n'||anchor);
 src:=replace(src,fallback,E' if action=''snapshot'' then return app_private.with_source_stock(app_private.command_before_customer_credit(action,data),data);end if;\n'||fallback);
 execute src;
end$review_route$;
