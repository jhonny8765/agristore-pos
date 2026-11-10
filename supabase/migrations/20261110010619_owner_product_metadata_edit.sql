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
  if org is null or branch is null or actor is null or request_id is null then
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

create or replace function public.agri_command(action text, data jsonb)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare result jsonb;
begin
  perform app_private.require_enabled_branch(action,data);
  if action='update_product_metadata' then
    return app_private.update_product_metadata(data);
  end if;
  if action='sales_analytics' then return app_private.sales_analytics(data);end if;
  if action in ('create_branch','rename_branch') then return app_private.branch_command(action,data);end if;
  result:=app_private.command(action,data);
  if action='dashboard' and exists(
    select 1 from public.branches b
    where b.organization_id=(data->>'organizationId')::uuid
      and b.id=(data->>'branchId')::uuid and b.active and b.management_locked
  ) then
    return result||app_private.fixed_branch_dashboard((data->>'organizationId')::uuid,
                                                       (data->>'branchId')::uuid);
  end if;
  return result;
end
$function$;
