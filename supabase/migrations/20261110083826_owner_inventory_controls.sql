-- Owner-only catalog corrections. No direct UPDATE policy is exposed to clients.
-- Existing product IDs, selling units, prices, stock and past transactions remain unchanged.
create or replace function app_private.update_product_metadata(data jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  org uuid := (data->>'organizationId')::uuid;
  branch uuid := (data->>'branchId')::uuid;
  actor uuid := auth.uid();
  request_id uuid := (data->>'requestId')::uuid;
  before_product public.products;
  prior public.stock_control_events;
  next_name text := btrim(coalesce(data->>'name',''));
  next_sku text := btrim(coalesce(data->>'sku',''));
  next_category text := btrim(coalesce(data->>'category',''));
  next_minimum text := coalesce(data->>'minimumStock','');
  minimum_value numeric;
  reason text := btrim(coalesce(data->>'reason',''));
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or org is null or branch is null or actor is null or request_id is null then
    raise exception 'A signed-in owner, branch and permanent request ID are required' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.staff_memberships m
    where m.organization_id=org and m.user_id=actor and m.active and m.role='owner'
  ) then
    raise exception 'Only an active owner can edit product details' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.branches b
    where b.organization_id=org and b.id=branch and b.active
  ) or not app_private.can_access(org,branch) then
    raise exception 'Choose an active, authorized branch in this business' using errcode='42501';
  end if;
  if data->'confirmed' is distinct from 'true'::jsonb
     or length(reason) not between 3 and 1000 then
    raise exception 'Confirm the product correction and enter a reason (3 to 1000 characters)';
  end if;
  if jsonb_typeof(data->'name') is distinct from 'string'
     or length(next_name) not between 1 and 180
     or next_name ~ '[[:cntrl:]]' then
    raise exception 'Enter a product name between 1 and 180 printable characters';
  end if;
  if jsonb_typeof(data->'sku') is distinct from 'string'
     or length(next_sku) not between 1 and 80
     or next_sku ~ '[[:cntrl:]]' then
    raise exception 'Enter a SKU or barcode between 1 and 80 printable characters';
  end if;
  if jsonb_typeof(data->'category') is distinct from 'string'
     or length(next_category) not between 1 and 80
     or next_category ~ '[[:cntrl:]]' then
    raise exception 'Choose a category between 1 and 80 printable characters';
  end if;
  if jsonb_typeof(data->'minimumStock') is distinct from 'string'
     or next_minimum !~ '^\d{1,12}(\.\d{1,6})?$' then
    raise exception 'Enter a non-negative low-stock threshold with at most six decimal places';
  end if;
  minimum_value := next_minimum::numeric;
  if jsonb_typeof(data->'expectedName') is distinct from 'string'
     or jsonb_typeof(data->'expectedSku') is distinct from 'string'
     or jsonb_typeof(data->'expectedCategory') is distinct from 'string'
     or jsonb_typeof(data->'expectedMinimumStock') is distinct from 'string' then
    raise exception 'Refresh the product before editing its details';
  end if;

  -- Catalog identifiers are business-wide, so serialize SKU checks across branches.
  perform pg_advisory_xact_lock(hashtextextended('catalog:'||org::text,1));
  -- Also respect the branch lock used by other owner stock controls.
  perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
  select * into prior from public.stock_control_events where id=request_id;
  if found then
    if prior.organization_id<>org or prior.branch_id<>branch or
       prior.actor_id<>actor or prior.action<>'update_product_metadata' or
       prior.payload<>data then
      raise exception 'This product edit request ID already belongs to different values';
    end if;
    return jsonb_build_object('id',request_id,'duplicate',true);
  end if;

  select * into before_product
  from public.products p
  where p.organization_id=org and p.id=(data->>'productId')::uuid and p.active
  for update;
  if before_product.id is null then
    raise exception 'Choose an active product from this business';
  end if;
  if before_product.name is distinct from data->>'expectedName'
     or before_product.sku is distinct from data->>'expectedSku'
     or before_product.category is distinct from data->>'expectedCategory'
     or before_product.minimum_stock is distinct from (data->>'expectedMinimumStock')::numeric then
    raise exception 'This product changed since you opened it. Refresh and review the latest details';
  end if;
  if before_product.base_unit='piece' and minimum_value<>trunc(minimum_value) then
    raise exception 'Whole-piece products need a whole-number low-stock threshold';
  end if;
  if exists(
    select 1 from public.products p
    where p.organization_id=org and p.id<>before_product.id
      and lower(p.sku)=lower(next_sku)
  ) then
    raise exception 'This SKU or barcode belongs to another product in this business';
  end if;
  if before_product.name=next_name and before_product.sku=next_sku
     and before_product.category=next_category
     and before_product.minimum_stock=minimum_value then
    raise exception 'No product details changed';
  end if;

  update public.products
  set name=next_name,sku=next_sku,category=next_category,minimum_stock=minimum_value
  where organization_id=org and id=before_product.id;
  insert into public.stock_control_events
    (id,organization_id,branch_id,action,source_id,actor_id,payload)
  values
    (request_id,org,branch,'update_product_metadata',before_product.id,actor,data);
  insert into public.audit_events
    (organization_id,branch_id,actor_id,action,source_id,details)
  values
    (org,branch,actor,'update_product_metadata',before_product.id,
     jsonb_build_object(
       'requestId',request_id,'reason',reason,
       'before',jsonb_build_object('name',before_product.name,'sku',before_product.sku,
                                   'category',before_product.category,'minimumStock',before_product.minimum_stock::text),
       'after',jsonb_build_object('name',next_name,'sku',next_sku,
                                  'category',next_category,'minimumStock',minimum_value::text),
       'stockChanged',false,'pricesChanged',false));
  return jsonb_build_object('id',request_id,'duplicate',false,'productId',before_product.id);
end
$function$;

-- Keep the privileged function outside exposed API schemas; only the existing
-- authenticated command wrapper can reach this action.
revoke all on function app_private.update_product_metadata(jsonb) from public, anon;
grant execute on function app_private.update_product_metadata(jsonb) to authenticated;

-- Only products explicitly hidden through this workflow can be restored here.
-- Retired products from source rebuilds are never silently offered for sale again.
create table app_private.owner_hidden_products (
 organization_id uuid not null,
 product_id uuid primary key,
 hidden_request_id uuid not null,
 hidden_at timestamptz not null default now(),
 reason text not null,
 foreign key(organization_id,product_id) references public.products(organization_id,id)
);
alter table app_private.owner_hidden_products enable row level security;
revoke all on app_private.owner_hidden_products from public,anon,authenticated;

create function app_private.owner_product_visibility(action text,data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 org uuid:=(data->>'organizationId')::uuid; branch uuid:=(data->>'branchId')::uuid;
 actor uuid:=auth.uid(); request_id uuid:=(data->>'requestId')::uuid;
 p public.products; prior public.stock_control_events; hidden app_private.owner_hidden_products;
 reason text:=btrim(coalesce(data->>'reason','')); restore boolean:=action='restore_product';
begin
 if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 or not app_private.can_access(org,branch)
 or not exists(select 1 from public.staff_memberships where organization_id=org and user_id=actor and active and role='owner')
 or not exists(select 1 from public.branches where organization_id=org and id=branch and active) then
  raise exception 'Only a signed-in owner can manage hidden products' using errcode='42501';
 end if;
 if action='hidden_products' then
  return (with matches as materialized (
    select prod.id,prod.name,prod.sku,h.hidden_request_id,h.hidden_at,h.reason
    from app_private.owner_hidden_products h join public.products prod on prod.id=h.product_id and prod.organization_id=h.organization_id
    where h.organization_id=org and not prod.active
    and (coalesce(data->>'query','')='' or strpos(lower(prod.name||' '||prod.sku),lower(data->>'query'))>0)
   ), page as (select * from matches where data->>'afterId' is null or id>(data->>'afterId')::uuid order by id limit 51)
   select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'sku',r.sku,'hiddenRequestId',r.hidden_request_id,'hiddenAt',r.hidden_at,'reason',r.reason) order by r.id) from (select * from page order by id limit 50) r),'[]'::jsonb),
    'total',(select count(*) from matches),'next',case when (select count(*) from page)>50 then (select id from page order by id offset 49 limit 1) else null end));
 end if;
 if action not in('archive_product','restore_product') then raise exception 'Unknown product visibility action';end if;
 if request_id is null or data->'confirmed' is distinct from 'true'::jsonb or length(reason) not between 3 and 1000 then
  raise exception 'Confirm the change and enter a reason (3 to 1000 characters)';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog:'||org::text,1));
 perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
 select * into prior from public.stock_control_events where id=request_id;
 if found then
  if prior.organization_id<>org or prior.branch_id<>branch or prior.actor_id<>actor or prior.action<>action or prior.payload<>data then
   raise exception 'This request reference belongs to different values';
  end if;
  return jsonb_build_object('id',request_id,'duplicate',true);
 end if;
 select * into p from public.products where organization_id=org and id=(data->>'productId')::uuid for update;
 if p.id is null or p.active=restore then raise exception 'Product visibility changed. Refresh the list';end if;
 if p.name is distinct from data->>'expectedName' or p.sku is distinct from data->>'expectedSku' then
  raise exception 'Product details changed. Refresh before continuing';
 end if;
 if restore then
  select * into hidden from app_private.owner_hidden_products where organization_id=org and product_id=p.id;
  if hidden.product_id is null or hidden.hidden_request_id is distinct from (data->>'hiddenRequestId')::uuid then
   raise exception 'Choose a product hidden through this screen and refresh its details';
  end if;
  if not exists(select 1 from public.product_units u join public.unit_prices v on v.organization_id=u.organization_id and v.unit_id=u.id and v.version=u.price_version where u.organization_id=org and u.product_id=p.id) then
   raise exception 'Restore this product''s selling setup before enabling it';
  end if;
 else
  if p.sku is distinct from btrim(coalesce(data->>'typedSku','')) then raise exception 'Type the exact product SKU to hide it';end if;
  if coalesce((p.source_stock->>'pending')::boolean,false) then raise exception 'Resolve imported stock before hiding this product';end if;
  if exists(select 1 from public.branch_inventory where organization_id=org and product_id=p.id and quantity<>0) then
   raise exception 'Product has recorded stock. Resolve its actual stock before hiding it';
  end if;
  if exists(select 1 from public.stock_holds where organization_id=org and product_id=p.id and remaining>0)
   or exists(select 1 from public.stock_issues where organization_id=org and product_id=p.id and state='pending') then
   raise exception 'Resolve held stock and pending stock issues before hiding this product';
  end if;
  if exists(select 1 from public.stock_counts where organization_id=org and product_id=p.id and state not in('approved','cancelled'))
   or exists(select 1 from app_private.blind_counts where organization_id=org and product_id=p.id and state not in('approved','cancelled')) then
   raise exception 'Finish open stock counts before hiding this product';
  end if;
  if exists(select 1 from public.stock_transfers where organization_id=org and product_id=p.id and state='in_transit') then
   raise exception 'Finish open transfers before hiding this product';
  end if;
  if exists(select 1 from app_private.purchase_order_lines l join app_private.purchase_orders o on o.id=l.order_id and o.organization_id=l.organization_id
    where l.organization_id=org and l.product_id=p.id and not exists(select 1 from app_private.purchase_order_events e where e.organization_id=org and e.order_id=o.id and e.action in('close','cancel'))) then
   raise exception 'Finish open purchase orders before hiding this product';
  end if;
  insert into app_private.owner_hidden_products(organization_id,product_id,hidden_request_id,reason)
   values(org,p.id,request_id,reason) on conflict(product_id) do update set hidden_request_id=excluded.hidden_request_id,hidden_at=now(),reason=excluded.reason;
 end if;
 update public.products set active=restore where organization_id=org and id=p.id;
 insert into public.stock_control_events(id,organization_id,branch_id,action,source_id,actor_id,payload) values(request_id,org,branch,action,p.id,actor,data);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details)
 values(org,branch,actor,action,p.id,jsonb_build_object('requestId',request_id,'reason',reason,'name',p.name,'sku',p.sku,'before',jsonb_build_object('active',p.active),'after',jsonb_build_object('active',restore),'stockChanged',false,'pricesChanged',false,'historyDeleted',false));
 return jsonb_build_object('id',request_id,'duplicate',false,'productId',p.id);
end $$;
revoke all on function app_private.owner_product_visibility(text,jsonb) from public,anon;
grant execute on function app_private.owner_product_visibility(text,jsonb) to authenticated;

-- Extend the existing gateway rather than replacing unrelated release fixes.
do $route$ declare src text; anchor text:=' perform app_private.require_enabled_branch(action,data);'; begin
 src:=pg_get_functiondef('public.agri_command(text,jsonb)'::regprocedure);
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Owner catalog route anchor changed';end if;
 execute replace(src,anchor,anchor||E'\n if action=''update_product_metadata'' then return app_private.update_product_metadata(data);end if;\n if action in(''archive_product'',''restore_product'',''hidden_products'') then return app_private.owner_product_visibility(action,data);end if;');
end $route$;
