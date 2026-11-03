-- Retain source uncertainty and real-photo provenance on imported catalog rows.
alter table public.products
 add column catalog_source text,
 add column original_code text,
 add column catalog_note text not null default '',
 add column price_pending boolean not null default false,
 add column setup_pending boolean not null default false,
 add column cost_pending boolean not null default false,
 add column image_path text,
 add column image_source_url text,
 add column image_label text;
alter table public.products add constraint product_image_local_path check(image_path is null or image_path ~ '^/products/[a-f0-9]{16}\.webp$');
alter table public.products add constraint product_image_source_https check(image_source_url is null or image_source_url ~ '^https://');

alter function app_private.command(text,jsonb) rename to command_before_catalog_photos;
create function app_private.command(action text,data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; prod public.products; unit public.product_units; item jsonb;
 org uuid:=(data->>'organizationId')::uuid; price_value bigint; cost_value bigint;
begin
 if action='review_imported_product' then
  -- Use the established command's current-session and branch authorization.
  perform app_private.command_before_catalog_photos('dashboard',data);
  if not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner') then
   raise exception 'Only the owner can confirm an imported product' using errcode='42501';
  end if;
  select * into prod from public.products where organization_id=org and id=(data->>'productId')::uuid and active for update;
  if prod.id is null or prod.catalog_source is null then raise exception 'Choose an imported active product';end if;
  if exists(select 1 from public.sale_items where organization_id=org and product_id=prod.id)
   or exists(select 1 from public.inventory_movements where organization_id=org and product_id=prod.id) then
   raise exception 'Selling setup cannot change after stock or sales are recorded. Change its price separately.';
  end if;
  if data->>'baseUnit' not in ('kg','liter','meter','piece') or length(btrim(coalesce(data->>'unitName',''))) not between 1 and 40 then
   raise exception 'Choose a stock measurement and selling unit';end if;
  price_value:=(data->>'price')::bigint;cost_value:=(data->>'cost')::bigint;
  if price_value is null or price_value<=0 or price_value>9007199254740991 or cost_value is null or cost_value<0 or cost_value>9007199254740991 then
   raise exception 'Enter a positive price and a non-negative actual cost';end if;
  if (data->>'factor')::numeric is null or (data->>'factor')::numeric::text in ('NaN','Infinity','-Infinity') or (data->>'factor')::numeric<=0 or scale(trim_scale((data->>'factor')::numeric))>6
   or (data->>'baseUnit'='piece' and (data->>'factor')::numeric<>trunc((data->>'factor')::numeric)) then
   raise exception 'Enter a valid stock conversion';end if;
  select * into unit from public.product_units where organization_id=org and product_id=prod.id order by id limit 1 for update;
  if unit.id is null then raise exception 'Product selling unit is missing';end if;
  update public.product_units set name=btrim(data->>'unitName'),factor=(data->>'factor')::numeric,price_version=price_version+1 where id=unit.id;
  insert into public.unit_prices(organization_id,unit_id,version,price,cost) values(org,unit.id,unit.price_version+1,price_value,cost_value);
  update public.products set base_unit=data->>'baseUnit',price_pending=false,setup_pending=false,cost_pending=false where id=prod.id;
  insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details)
   values(org,(data->>'branchId')::uuid,auth.uid(),action,prod.id,data-'organizationId'-'branchId');
  return jsonb_build_object('id',prod.id);
 end if;
 if action='record_sale' then
  -- Imported blank prices and unconfirmed selling units cannot become free sales.
  for item in select value from jsonb_array_elements(coalesce(data->'items','[]')) loop
   if exists(select 1 from public.products p where p.organization_id=org and p.id=(item->>'productId')::uuid and (p.price_pending or p.setup_pending)) then
    raise exception 'The owner must confirm the imported price and selling unit before this item can be sold';
   end if;
  end loop;
 end if;
 result:=app_private.command_before_catalog_photos(action,data);
 if action='set_price' then
  update public.products p set price_pending=false,cost_pending=false
   where p.organization_id=org and p.catalog_source is not null and p.id=(select u.product_id from public.product_units u where u.organization_id=org and u.id=(data->>'unitId')::uuid)
   and (data->>'price')::bigint>0;
 end if;
 if action='snapshot' and not coalesce((result->>'catalogUnchanged')::boolean,false) then
  return result||jsonb_build_object('products',coalesce((
   select jsonb_agg(e.value||jsonb_build_object('catalogSource',p.catalog_source,'originalCode',p.original_code,
    'catalogNote',p.catalog_note,'pricePending',p.price_pending,'setupPending',p.setup_pending,'costPending',p.cost_pending,
    'imagePath',p.image_path,'imageSourceUrl',p.image_source_url,'imageLabel',p.image_label) order by e.ordinality)
   from jsonb_array_elements(result->'products') with ordinality e(value,ordinality)
   join public.products p on p.organization_id=org and p.id=(e.value->>'id')::uuid),'[]'));
 end if;
 return result;
end $$;
revoke all on function app_private.command(text,jsonb) from public,anon,authenticated;
grant execute on function app_private.command(text,jsonb) to authenticated;
