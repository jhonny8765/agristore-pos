-- Soft archive only. Historical sales, ledger entries, prices and audit records remain intact.
-- An owner must clear stock and pending work before removing a product from active sale.
create or replace function app_private.archive_product(data jsonb)
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
  target_product uuid := (data->>'productId')::uuid;
  before_product public.products;
  prior public.stock_control_events;
  reason text := btrim(coalesce(data->>'reason',''));
begin
  if org is null or branch is null or actor is null or request_id is null or target_product is null then
    raise exception 'Signed-in owner, branch, product and request ID are required' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.staff_memberships m
    where m.organization_id=org and m.user_id=actor and m.active and m.role='owner'
  ) then
    raise exception 'Only an active owner may archive a product' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.branches b
    where b.organization_id=org and b.id=branch and b.active
  ) or not app_private.can_access(org,branch) then
    raise exception 'Choose an active, authorized branch' using errcode='42501';
  end if;
  if data->'confirmed' is distinct from 'true'::jsonb
    or length(reason) not between 3 and 1000 then
    raise exception 'Confirm removal and enter a reason (3 to 1000 characters)';
  end if;
  if jsonb_typeof(data->'expectedName') is distinct from 'string'
    or jsonb_typeof(data->'expectedSku') is distinct from 'string'
    or jsonb_typeof(data->'typedSku') is distinct from 'string' then
    raise exception 'Refresh the product and type its exact SKU to confirm removal';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('catalog:'||org::text,1));
  perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
  select * into prior from public.stock_control_events where id=request_id;
  if found then
    if prior.organization_id<>org or prior.branch_id<>branch
       or prior.actor_id<>actor or prior.action<>'archive_product'
       or prior.payload<>data then
      raise exception 'This archive request ID already belongs to different values';
    end if;
    return jsonb_build_object('id',request_id,'duplicate',true,'productId',target_product);
  end if;

  select * into before_product from public.products p
  where p.organization_id=org and p.id=target_product and p.active
  for update;
  if before_product.id is null then
    raise exception 'Choose an active product in this business';
  end if;
  if before_product.name is distinct from data->>'expectedName'
    or before_product.sku is distinct from data->>'expectedSku' then
    raise exception 'This product changed. Refresh before removing it';
  end if;
  if before_product.sku is distinct from btrim(data->>'typedSku') then
    raise exception 'Type the exact product SKU before removal';
  end if;
  if coalesce((before_product.source_stock->>'pending')::boolean,false) then
    raise exception 'Resolve imported stock before removing this product';
  end if;
  if exists(
    select 1 from public.branch_inventory i
    where i.organization_id=org and i.product_id=target_product and i.quantity<>0
  ) then
    raise exception 'Product still has recorded stock. Complete a verified stock count first';
  end if;
  if exists(
    select 1 from public.stock_holds h
    where h.organization_id=org and h.product_id=target_product and h.remaining>0
  ) then
    raise exception 'Release or resolve held stock before removing this product';
  end if;
  if exists(
    select 1 from public.stock_counts c
    where c.organization_id=org and c.product_id=target_product
      and c.state not in ('approved','cancelled')
  ) then
    raise exception 'Finish open stock counts before removing this product';
  end if;
  if exists(
    select 1 from public.stock_transfers t
    where t.organization_id=org and t.product_id=target_product
      and t.state not in ('received','closed_short')
  ) then
    raise exception 'Finish open branch transfers before removing this product';
  end if;

  update public.products set active=false
  where organization_id=org and id=target_product;
  insert into public.stock_control_events
    (id,organization_id,branch_id,action,source_id,actor_id,payload)
  values(request_id,org,branch,'archive_product',target_product,actor,data);
  insert into public.audit_events
    (organization_id,branch_id,actor_id,action,source_id,details)
  values(org,branch,actor,'archive_product',target_product,
    jsonb_build_object(
      'requestId',request_id,'reason',reason,
      'name',before_product.name,'sku',before_product.sku,
      'before',jsonb_build_object('active',true),
      'after',jsonb_build_object('active',false),
      'stockChanged',false,'pricesChanged',false,'historyDeleted',false
    ));
  return jsonb_build_object('id',request_id,'duplicate',false,'productId',target_product);
end
$function$;

revoke all on function app_private.archive_product(jsonb) from public, anon;
grant execute on function app_private.archive_product(jsonb) to authenticated;

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
  if action='archive_product' then
    return app_private.archive_product(data);
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
