-- Owner inventory tools. All adjustments and version publishing are atomic.
alter table public.stock_counts
  drop constraint stock_counts_count_method_check,
  add constraint stock_counts_count_method_check
    check (count_method in ('legacy', 'blind_v1', 'owner_worksheet')),
  add column count_date date,
  add constraint stock_counts_worksheet_date_check
    check ((count_method = 'owner_worksheet') = (count_date is not null));

create index inventory_movements_worksheet_revision
  on public.inventory_movements (organization_id, branch_id, product_id, batch_id, id desc);

create table app_private.owner_worksheet_requests (
  id uuid primary key,
  organization_id uuid not null,
  actor_id uuid not null references auth.users,
  payload jsonb not null,
  result jsonb not null
);
alter table app_private.owner_worksheet_requests enable row level security;
revoke all on app_private.owner_worksheet_requests from public, anon, authenticated;
create trigger immutable before update or delete on app_private.owner_worksheet_requests
  for each row execute function app_private.immutable();

create function app_private.require_inventory_owner(org uuid, branch uuid)
returns uuid language plpgsql set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if org is null or branch is null or actor is null
    or not app_private.can_access(org, branch)
    or not exists (select 1 from public.branches b where b.organization_id = org and b.id = branch and b.active)
  then
    raise exception 'Owner access to the selected branch is required' using errcode = '42501';
  end if;
  perform 1 from public.staff_memberships m
    where m.organization_id = org and m.user_id = actor and m.active and m.role = 'owner'
    for share;
  if not found then
    raise exception 'Owner access to the selected branch is required' using errcode = '42501';
  end if;
  return actor;
end $$;

create function app_private.owner_stock_worksheet(data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  org uuid := (data->>'organizationId')::uuid;
  branch uuid := (data->>'branchId')::uuid;
  sheet_date date := (data->>'countDate')::date;
  search text := lower(btrim(coalesce(data->>'query', '')));
  page_offset integer := coalesce((data->>'offset')::integer, 0);
  review_items jsonb := data->'reviewItems';
  result jsonb;
begin
  perform app_private.require_inventory_owner(org, branch);
  if sheet_date is null or sheet_date > (statement_timestamp() at time zone 'Asia/Manila')::date
    or length(search) > 180 or page_offset not between 0 and 1000000
    or (review_items is not null and (jsonb_typeof(review_items) is distinct from 'array'
      or jsonb_array_length(review_items) not between 1 and 10000)) then
    raise exception 'Choose a valid count date and worksheet page' using errcode = '22023';
  end if;
  with reviewed_rows as materialized (
    select (r->>'productId')::uuid product_id, (r->>'batchId')::uuid batch_id
    from jsonb_array_elements(coalesce(review_items, '[]'::jsonb)) r
  ), catalog as materialized (
    select p.id, p.name, p.sku, p.base_unit, p.tracks_expiry
    from public.products p
    where p.organization_id = org and p.active and not p.setup_pending
      and (search = '' or strpos(lower(concat_ws(' ', p.name, p.sku, p.original_code)), search) > 0)
      and (review_items is null or exists (select 1 from reviewed_rows r where r.product_id = p.id))
  ), branch_stock as materialized (
    select stock.* from app_private.branch_stock_rows(org, array[branch]) stock
      join catalog p on p.id = stock.product_id
  ), matches as materialized (
    select p.id, p.name, p.sku, p.base_unit, b.id as batch_id, b.lot, b.expires_on, stock.usable
    from branch_stock stock
    join catalog p on p.id = stock.product_id
    left join public.product_batches b on b.organization_id = org and b.product_id = p.id and b.id = stock.batch_id
    where (stock.batch_id is not null and b.id is not null)
       or (stock.batch_id is null and not p.tracks_expiry)
    union all
    select p.id, p.name, p.sku, p.base_unit, null, null, null, 0::numeric
    from catalog p
    where not p.tracks_expiry
      and not exists (select 1 from branch_stock stock
        where stock.product_id = p.id and stock.batch_id is null)
  ), scoped as (
    select m.* from matches m
    where review_items is null or exists (select 1 from reviewed_rows r
      where r.product_id = m.id and r.batch_id is not distinct from m.batch_id)
  ), page as (
    select * from scoped order by lower(name), sku, id, lot nulls first, batch_id
    limit case when review_items is null then 50 else 10000 end offset page_offset
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'productId', p.id, 'batchId', p.batch_id, 'sku', p.sku, 'name', p.name, 'batch', p.lot,
      'expiresOn', p.expires_on, 'baseUnit', p.base_unit, 'expected', trim_scale(p.usable)::text,
      'revision', coalesce((select max(m.id) from public.inventory_movements m
        where m.organization_id = org and m.branch_id = branch and m.product_id = p.id
          and m.batch_id is not distinct from p.batch_id), 0)::text
    ) order by lower(p.name), p.sku, p.id, p.lot nulls first, p.batch_id) from page p), '[]'::jsonb),
    'total', totals.n,
    'next', case when review_items is null and totals.n > page_offset + 50 then page_offset + 50 end
  ) into result from (select count(*) n from scoped) totals;
  return result;
end $$;

create function app_private.post_owner_stock_count(data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  org uuid := (data->>'organizationId')::uuid;
  branch uuid := (data->>'branchId')::uuid;
  actor uuid := app_private.require_inventory_owner(org, branch);
  request_id uuid := (data->>'requestId')::uuid;
  sheet_date date := (data->>'countDate')::date;
  note text := btrim(coalesce(data->>'reason', ''));
  prior app_private.owner_worksheet_requests;
  entry jsonb;
  item uuid;
  lot_id uuid;
  product public.products;
  physical numeric;
  current_stock numeric;
  revision bigint;
  ledger_revision bigint;
  count_id uuid;
  lots uuid[];
  count_n integer := 0;
  changed integer := 0;
  posted timestamptz;
  result jsonb;
begin
  if request_id is null or data->'confirmed' is distinct from 'true'::jsonb
    or length(note) not between 3 and 1000 or sheet_date is null
    or sheet_date > (statement_timestamp() at time zone 'Asia/Manila')::date
    or jsonb_typeof(data->'items') is distinct from 'array'
    or jsonb_array_length(data->'items') not between 1 and 10000 then
    raise exception 'Review the counted rows, date and reason before posting';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text || request_id::text, 0));
  select * into prior from app_private.owner_worksheet_requests r where r.id = request_id;
  if found then
    if prior.organization_id <> org or prior.actor_id <> actor or prior.payload is distinct from data then
      raise exception 'This count reference contains different reviewed values';
    end if;
    return prior.result || '{"duplicate":true}'::jsonb;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(org::text || branch::text, 1));
  perform 1 from public.devices d where d.organization_id = org and d.branch_id = branch for update;
  if exists (select 1 from public.cashier_shifts s where s.organization_id = org and s.branch_id = branch and s.closed_at is null)
    or exists (select 1 from app_private.offline_pc_grants g where g.organization_id = org and g.branch_id = branch and g.closed_at is null) then
    raise exception 'Close and synchronize every branch shift and reconcile offline stock rights before counting';
  end if;
  if exists (
    select 1 from jsonb_array_elements(data->'items') x
    group by (x->>'productId')::uuid, (x->>'batchId')::uuid
    having count(*) > 1
  ) then
    raise exception 'Each product and batch can be counted only once';
  end if;
  select coalesce(max(m.id), 0) into ledger_revision from public.inventory_movements m
    where m.organization_id = org and m.branch_id = branch;
  select coalesce(array_agg(stock.batch_id), '{}'::uuid[]) into lots
    from app_private.branch_stock_rows(org, array[branch]) stock
    where stock.batch_id is not null;
  posted := clock_timestamp();

  for entry in select value from jsonb_array_elements(data->'items') loop
    item := (entry->>'productId')::uuid;
    lot_id := (entry->>'batchId')::uuid;
    select * into product from public.products p
      where p.organization_id = org and p.id = item and p.active and not p.setup_pending for share;
    if product.id is null or product.base_unit is distinct from entry->>'baseUnit'
      or (lot_id is null and product.tracks_expiry)
      or (lot_id is not null and not exists (
        select 1 from public.product_batches b
        where b.organization_id = org and b.product_id = item and b.id = lot_id and b.id = any(lots)
      )) then
      raise exception 'Stock changed: a product, measurement or batch is no longer available. Refresh and review it again.';
    end if;
    if coalesce(entry->>'quantity', '') !~ '^\d{1,14}(\.\d{1,6})?$' then
      raise exception 'Count quantities must be nonnegative with up to six decimal places';
    end if;
    physical := (entry->>'quantity')::numeric;
    if product.base_unit = 'piece' and physical <> trunc(physical) then
      raise exception 'Count pieces as whole numbers';
    end if;

    select coalesce((select i.quantity from public.branch_inventory i where i.organization_id = org
      and i.branch_id = branch and i.product_id = item and i.batch_id is not distinct from lot_id), 0) into current_stock;
    select coalesce(max(m.id), 0) into revision from public.inventory_movements m where m.organization_id = org
      and m.branch_id = branch and m.product_id = item and m.batch_id is not distinct from lot_id;
    if current_stock is distinct from (entry->>'expected')::numeric or revision is distinct from (entry->>'revision')::bigint then
      raise exception 'Stock changed after review. Refresh the worksheet and review updated On Hand before saving again.';
    end if;
    if exists (select 1 from app_private.blind_counts c where c.organization_id = org and c.branch_id = branch
      and c.product_id = item and c.batch_id is not distinct from lot_id and c.state not in ('approved', 'cancelled')) then
      raise exception 'Finish or close the open blind count for this product and batch before posting the worksheet';
    end if;

    count_id := gen_random_uuid();
    insert into public.stock_counts (
      id, organization_id, branch_id, product_id, batch_id, expected, counted, ledger_revision,
      reason, state, counted_by, approved_by, created_at, count_method, count_date
    ) values (
      count_id, org, branch, item, lot_id, current_stock, physical, ledger_revision,
      note, 'approved', actor, actor, posted, 'owner_worksheet', sheet_date
    );
    insert into public.adjustment_approvals (organization_id, branch_id, count_id, approved_by, reason, created_at)
      values (org, branch, count_id, actor, note, posted);
    if physical <> current_stock then
      insert into public.inventory_movements (organization_id, branch_id, product_id, batch_id, quantity, kind, source_id, created_by, created_at)
        values (org, branch, item, lot_id, physical - current_stock, 'adjustment', count_id, actor, posted);
      changed := changed + 1;
    end if;
    insert into public.audit_events (organization_id, branch_id, actor_id, action, source_id, details)
      values (org, branch, actor, 'post_owner_stock_count', count_id, jsonb_build_object(
        'requestId', request_id, 'countDate', sheet_date, 'postedAt', posted, 'reason', note,
        'productId', item, 'batchId', lot_id, 'before', current_stock, 'after', physical
      ));
    count_n := count_n + 1;
  end loop;
  result := jsonb_build_object('id', request_id, 'count', count_n, 'adjusted', changed, 'postedAt', posted, 'duplicate', false);
  insert into app_private.owner_worksheet_requests values (request_id, org, actor, data, result);
  return result;
end $$;

create function app_private.review_branch_price_copy(data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  org uuid := (data->>'organizationId')::uuid;
  source_branch uuid := (data->>'branchId')::uuid;
  copy_scope text := data->>'scope';
  copy_mode text := data->>'mode';
  targets uuid[];
  selected_units uuid[];
  result jsonb;
begin
  perform app_private.require_inventory_owner(org, source_branch);
  if not app_private.network_enabled(org) then
    raise exception 'An enabled branch network is required to copy prices' using errcode = '42501';
  end if;
  if copy_scope is null or copy_scope not in ('selected', 'all') or copy_mode is null or copy_mode not in ('fill', 'replace')
    or jsonb_typeof(data->'targetIds') is distinct from 'array' or jsonb_typeof(data->'unitIds') is distinct from 'array' then
    raise exception 'Choose the price copy scope, rule and destination branches';
  end if;
  select array(select distinct x::uuid from jsonb_array_elements_text(data->'targetIds') x order by 1),
         array(select distinct x::uuid from jsonb_array_elements_text(data->'unitIds') x order by 1)
    into targets, selected_units;
  if cardinality(targets) < 1 or (copy_scope = 'selected' and cardinality(selected_units) < 1)
    or (copy_scope = 'all' and cardinality(selected_units) <> 0) then
    raise exception 'Choose a destination and the prices to copy';
  end if;
  if exists (select 1 from unnest(targets) target(id) where target.id is null or target.id = source_branch
    or not app_private.can_access(org, target.id)
    or not exists (select 1 from public.branches b where b.organization_id = org and b.id = target.id and b.active)) then
    raise exception 'Choose eligible destinations other than the source branch' using errcode = '42501';
  end if;

  with eligible as materialized (
    select u.id unit_id, u.name unit_name, u.factor, p.name, p.sku, p.base_unit,
      src.id source_id, src.price, src.selling_policy
    from public.product_units u
    join public.products p on p.organization_id = u.organization_id and p.id = u.product_id
    join lateral (
      select v.id, v.price, v.selling_policy from app_private.branch_unit_prices v
      where v.organization_id = org and v.branch_id = source_branch and v.unit_id = u.id
      order by v.version desc limit 1
    ) src on true
    where u.organization_id = org and p.active and not p.setup_pending
      and (copy_scope = 'all' or u.id = any(selected_units))
  ), rows as (
    select target.id branch_id, e.*, dst.version, dst.price current_price, dst.id current_id,
      case when dst.id is null then 'Fill'
           when copy_mode = 'fill' then 'Skip'
           else 'Replace' end decision
    from eligible e
    cross join unnest(targets) target(id)
    left join lateral (
      select v.id, v.version, v.price from app_private.branch_unit_prices v
      where v.organization_id = org and v.branch_id = target.id and v.unit_id = e.unit_id
      order by v.version desc limit 1
    ) dst on true
  ), reviewed as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'branchId', r.branch_id, 'unitId', r.unit_id, 'sourceId', r.source_id, 'currentId', r.current_id,
      'version', coalesce(r.version, 0), 'price', r.price, 'currentPrice', r.current_price,
      'sellingPolicy', r.selling_policy, 'decision', r.decision,
      'name', r.name, 'sku', r.sku, 'unitName', r.unit_name, 'factor', r.factor, 'baseUnit', r.base_unit
    ) order by lower(r.name), r.sku, lower(r.unit_name), r.unit_id, r.branch_id), '[]'::jsonb) as entries,
    count(*) filter (where r.decision <> 'Skip') as changes from rows r
  )
  select jsonb_build_object(
    'token', encode(sha256(convert_to(jsonb_build_array(org, source_branch, copy_scope, copy_mode, targets, selected_units, reviewed.entries)::text, 'UTF8')), 'hex'),
    'rows', reviewed.entries,
    'units', (select count(*) from eligible),
    'count', reviewed.changes
  ) into result from reviewed;
  if copy_scope = 'selected' and (result->>'units')::integer <> cardinality(selected_units) then
    raise exception 'A selected selling unit no longer has a confirmed source price. Refresh and select eligible units.';
  end if;
  return result;
end $$;

create function app_private.apply_branch_price_copy(data jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  org uuid := (data->>'organizationId')::uuid;
  source_branch uuid := (data->>'branchId')::uuid;
  actor uuid := app_private.require_inventory_owner(org, source_branch);
  request_id uuid := (data->>'requestId')::uuid;
  note text := btrim(coalesce(data->>'reason', ''));
  prior app_private.branch_price_requests;
  scope_branch uuid;
  review jsonb;
  applied integer;
  result jsonb;
begin
  if request_id is null or data->'confirmed' is distinct from 'true'::jsonb
    or length(note) not between 3 and 1000 or coalesce(data->>'token', '') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(data->'targetIds') is distinct from 'array'
    or coalesce((data->>'expectedCount')::integer, 0) < 1 then
    raise exception 'Review the destination prices and enter a reason before confirming the copy';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text || request_id::text, 0));
  select * into prior from app_private.branch_price_requests r where r.id = request_id;
  if found then
    if prior.organization_id <> org or prior.actor_id <> actor or prior.payload is distinct from data then
      raise exception 'This copy reference contains different reviewed prices';
    end if;
    return prior.result || '{"duplicate":true}'::jsonb;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('catalog:' || org::text, 1));
  for scope_branch in
    select source_branch union select x::uuid from jsonb_array_elements_text(data->'targetIds') x order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(org::text || scope_branch::text, 1));
  end loop;
  perform 1 from public.product_units u
    join public.products p on p.organization_id = u.organization_id and p.id = u.product_id
    where p.organization_id = org and p.active and not p.setup_pending
      and (data->>'scope' = 'all' or u.id in (select x::uuid from jsonb_array_elements_text(data->'unitIds') x))
    order by p.id, u.id for share of p, u;
  review := app_private.review_branch_price_copy(data);
  if review->>'token' is distinct from data->>'token'
    or review->>'count' is distinct from data->>'expectedCount' then
    raise exception 'Source or destination prices changed. Review the price copy again.';
  end if;

  with entries as materialized (
    select x from jsonb_array_elements(review->'rows') x where x->>'decision' <> 'Skip'
  ), published as (
    insert into app_private.branch_unit_prices (
      organization_id, branch_id, unit_id, version, price, selling_policy, reason, created_by
    )
    select org, (x->>'branchId')::uuid, (x->>'unitId')::uuid, (x->>'version')::integer + 1,
      (x->>'price')::bigint, x->>'sellingPolicy', note, actor from entries
    returning id, branch_id, unit_id, version, price, selling_policy
  )
  insert into public.audit_events (organization_id, branch_id, actor_id, action, source_id, details)
  select org, p.branch_id, actor, 'publish_branch_unit_price', p.id, jsonb_build_object(
    'requestId', request_id, 'sourceBranchId', source_branch, 'unitId', p.unit_id,
    'price', p.price, 'sellingPolicy', p.selling_policy, 'version', p.version, 'reason', note
  ) from published p;
  get diagnostics applied = row_count;

  result := jsonb_build_object('id', request_id, 'count', applied, 'duplicate', false);
  insert into app_private.branch_price_requests values (request_id, org, actor, data, result);
  return result;
end $$;

revoke all on function app_private.require_inventory_owner(uuid, uuid),
  app_private.owner_stock_worksheet(jsonb), app_private.post_owner_stock_count(jsonb),
  app_private.review_branch_price_copy(jsonb), app_private.apply_branch_price_copy(jsonb)
  from public, anon, authenticated;

alter function app_private.command(text, jsonb) rename to command_before_owner_inventory_worksheet;
revoke all on function app_private.command_before_owner_inventory_worksheet(text, jsonb) from public, anon, authenticated;
create function app_private.command(action text, data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.require_enabled_branch(action, data);
  case action
    when 'owner_count_worksheet' then return app_private.owner_stock_worksheet(data);
    when 'post_owner_stock_count' then return app_private.post_owner_stock_count(data);
    when 'preview_branch_price_copy' then return app_private.review_branch_price_copy(data);
    when 'apply_branch_price_copy' then return app_private.apply_branch_price_copy(data);
    else return app_private.command_before_owner_inventory_worksheet(action, data);
  end case;
end $$;
revoke all on function app_private.command(text, jsonb) from public, anon;
grant execute on function app_private.command(text, jsonb) to authenticated;
