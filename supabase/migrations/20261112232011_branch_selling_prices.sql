-- Selling authority is separate from the legacy unit_prices cost/version namespace.
-- No location is activated and no product, stock or historical payload is changed.
create table app_private.branch_unit_prices (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null, branch_id uuid not null, unit_id uuid not null,
 version integer not null check(version>0), price bigint not null check(price between 0 and 9007199254740991),
 selling_policy text not null default 'fractional' check(selling_policy in('fractional','sealed_whole')),
 reason text not null, created_at timestamptz not null default clock_timestamp(), created_by uuid references auth.users(id),
 source_legacy_version integer,
 unique(organization_id,branch_id,unit_id,version),unique(organization_id,branch_id,unit_id,id,version),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,unit_id) references public.product_units(organization_id,id),
 foreign key(organization_id,unit_id,source_legacy_version) references public.unit_prices(organization_id,unit_id,version)
);
create index branch_unit_prices_current on app_private.branch_unit_prices(organization_id,branch_id,unit_id,version desc);
create table app_private.branch_price_requests (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 actor_id uuid not null references auth.users(id), payload jsonb not null, result jsonb not null
);
alter table app_private.branch_unit_prices enable row level security;
alter table app_private.branch_price_requests enable row level security;
revoke all on app_private.branch_unit_prices,app_private.branch_price_requests from public,anon,authenticated;
create trigger immutable before update or delete on app_private.branch_unit_prices for each row execute function app_private.immutable();
create trigger immutable before update or delete on app_private.branch_price_requests for each row execute function app_private.immutable();

-- Only prices already confirmed for the existing fixed hub are migration sources.
insert into app_private.branch_unit_prices(organization_id,branch_id,unit_id,version,price,reason,source_legacy_version)
select u.organization_id,app_private.network_hub(u.organization_id),u.id,1,v.price,
 'Existing confirmed hub selling price; original legacy version retained',v.version
from public.product_units u join public.unit_prices v on v.organization_id=u.organization_id and v.unit_id=u.id and v.version=u.price_version
join public.products p on p.organization_id=u.organization_id and p.id=u.product_id
where app_private.network_managed(u.organization_id) and app_private.network_hub(u.organization_id) is not null
and not p.price_pending and not p.setup_pending;

alter table public.sale_items add column branch_id uuid,add column branch_price_id uuid,add column branch_price_version integer;
alter table public.sale_items add constraint sale_items_branch_price_identity
 check((branch_id is null and branch_price_id is null and branch_price_version is null) or (branch_id is not null and branch_price_id is not null and branch_price_version is not null));
alter table public.sale_items add constraint sale_items_branch_price_fk
 foreign key(organization_id,branch_id,unit_id,branch_price_id,branch_price_version)
 references app_private.branch_unit_prices(organization_id,branch_id,unit_id,id,version);
create index sale_items_branch_price on public.sale_items(branch_price_id) where branch_price_id is not null;

create function app_private.publish_branch_unit_price(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;unit uuid:=(data->>'unitId')::uuid;
 request uuid:=(data->>'requestId')::uuid;previous app_private.branch_price_requests;current_price app_private.branch_unit_prices;created app_private.branch_unit_prices;result jsonb;
begin
 perform app_private.require_enabled_branch('publish_branch_unit_price',data);
 if not app_private.can_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner') then raise exception 'Only the owner can confirm branch selling prices' using errcode='42501';end if;
 if not app_private.network_managed(org) then raise exception 'This installation uses the existing unit-price editor';end if;
 if request is null then raise exception 'An original price request reference is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||request::text,0));
 select * into previous from app_private.branch_price_requests r where r.id=request;
 if found then
  if previous.organization_id<>org or previous.actor_id<>auth.uid() or previous.payload<>data then raise exception 'This price request reference contains different values';end if;
  return previous.result||'{"duplicate":true}'::jsonb;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
 if not exists(select 1 from public.product_units u join public.products p on p.organization_id=u.organization_id and p.id=u.product_id where u.organization_id=org and u.id=unit and p.active and not p.setup_pending) then raise exception 'Confirm this product and selling unit before pricing';end if;
 if jsonb_typeof(data->'price') is distinct from 'number' or coalesce(data->>'price','')!~'^\d{1,16}$' or (data->>'price')::numeric>9007199254740991 or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000 then raise exception 'Enter exact non-negative centavos and a price confirmation reason';end if;
 select * into current_price from app_private.branch_unit_prices p where p.organization_id=org and p.branch_id=branch and p.unit_id=unit order by p.version desc limit 1;
 if (data->>'expectedVersion')::integer is distinct from coalesce(current_price.version,0) then raise exception 'The branch selling price changed. Refresh and review';end if;
 insert into app_private.branch_unit_prices(organization_id,branch_id,unit_id,version,price,selling_policy,reason,created_by)
 values(org,branch,unit,coalesce(current_price.version,0)+1,(data->>'price')::bigint,coalesce(data->>'sellingPolicy',current_price.selling_policy,'fractional'),btrim(data->>'reason'),auth.uid()) returning * into created;
 result:=jsonb_build_object('branchPriceId',created.id,'version',created.version,'duplicate',false);
 insert into app_private.branch_price_requests values(request,org,auth.uid(),data,result);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,auth.uid(),'publish_branch_unit_price',created.id,data);
 return result;
end $$;

create function app_private.branch_price_book(data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;query text:=lower(btrim(coalesce(data->>'query','')));result jsonb;
begin
 if not app_private.can_access(org,branch) then raise exception 'Branch price access denied' using errcode='42501';end if;
 with filtered as materialized(
  select u.*,p.name product_name,p.sku,p.base_unit,p.setup_pending from public.product_units u join public.products p on p.organization_id=u.organization_id and p.id=u.product_id
  where u.organization_id=org and p.active and (query='' or position(query in lower(p.name||' '||p.sku||' '||u.name))>0)
 ), page as materialized(select * from filtered where (data->>'cursor') is null or id>(data->>'cursor')::uuid order by id limit 51), visible as(select * from page order by id limit 50)
 select jsonb_build_object('pricingMode',case when app_private.network_managed(org) then 'branch' else 'legacy' end,'networkEnabled',app_private.network_enabled(org),'branchId',branch,
 'branchName',(select b.name from public.branches b where b.organization_id=org and b.id=branch),'total',(select count(*) from filtered),'asOf',statement_timestamp(),
 'next',case when (select count(*) from page)>50 then (select id from visible order by id desc limit 1) else null end,
 'rows',coalesce((select jsonb_agg(jsonb_build_object('unitId',u.id,'productId',u.product_id,'name',u.product_name,'sku',u.sku,'unitName',u.name,'factor',u.factor::text,'baseUnit',u.base_unit,
 'price',b.price,'branchPriceId',b.id,'version',coalesce(b.version,0),'sellingPolicy',coalesce(b.selling_policy,'fractional'),'ready',b.id is not null and not u.setup_pending,
 'history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'version',h.version,'price',h.price,'sellingPolicy',h.selling_policy,'reason',h.reason,'at',h.created_at) order by h.version desc) from app_private.branch_unit_prices h where h.organization_id=org and h.branch_id=branch and h.unit_id=u.id),'[]')) order by u.id)
 from visible u left join lateral(select * from app_private.branch_unit_prices p where p.organization_id=org and p.branch_id=branch and p.unit_id=u.id order by p.version desc limit 1)b on true),'[]')) into result;
 return result;
end $$;

-- Add branch scope to the catalog validator. A branch switch never reuses a
-- different location's catalog, even when the shared catalog revision matches.
create function app_private.branch_priced_snapshot(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;result jsonb;version text;managed boolean:=app_private.network_managed(org);
begin
 if not managed then return app_private.command_before_branch_pricing('snapshot',data)||'{"pricingMode":"legacy"}'::jsonb;end if;
 select concat(org,':',branch,':',managed,':',coalesce((select max(p.created_at)::text||':'||count(*)::text from app_private.branch_unit_prices p where p.organization_id=org and p.branch_id=branch),'')) into version;
 -- The old dispatcher still owns stock/session/catalog fields. Strip only the
-- conditional download token; never change any original sale request.
 result:=app_private.command_before_branch_pricing('snapshot',data-'catalogVersion');
 version:=version||':'||coalesce(result->>'catalogVersion','');
 if data->>'catalogVersion'=version then return result||jsonb_build_object('products','[]'::jsonb,'catalogVersion',version,'catalogUnchanged',true,'pricingMode',case when managed then 'branch' else 'legacy' end);end if;
 if managed then
  result:=jsonb_set(result,'{products}',coalesce((select jsonb_agg(p.value||jsonb_build_object('units',coalesce((select jsonb_agg(u.value||jsonb_build_object('branchId',branch,'branchPriceId',bp.id,'branchPriceVersion',bp.version,'price',bp.price,'sellingPolicy',coalesce(bp.selling_policy,'fractional')) order by u.n)
   from jsonb_array_elements(p.value->'units') with ordinality u(value,n) left join lateral(select * from app_private.branch_unit_prices v where v.organization_id=org and v.branch_id=branch and v.unit_id=(u.value->>'id')::uuid order by v.version desc limit 1)bp on true),'[]')) order by p.n) from jsonb_array_elements(result->'products') with ordinality p(value,n)),'[]'));
 end if;
 return result||jsonb_build_object('catalogVersion',version,'catalogUnchanged',false,'pricingMode',case when managed then 'branch' else 'legacy' end);
end $$;

alter function app_private.command(text,jsonb) rename to command_before_branch_pricing;
revoke all on function app_private.command_before_branch_pricing(text,jsonb) from public,anon,authenticated;
create function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;result jsonb;legacy_before bigint;current_price app_private.branch_unit_prices;unit record;publish_needed boolean:=false;
begin
 perform app_private.require_enabled_branch(action,data);
 if action='publish_branch_unit_price' then return app_private.publish_branch_unit_price(data);end if;
 if action='branch_price_book' then return app_private.branch_price_book(data);end if;
 if action='snapshot' then return app_private.branch_priced_snapshot(data);end if;
 if action='copy_branch_unit_prices' then return app_private.copy_branch_unit_prices(data);end if;
 if action='validate_sale_prices' then
  if not app_private.can_checkout(org,branch) or data->>'cashierId' is distinct from auth.uid()::text or not exists(select 1 from public.cashier_shifts s join public.devices d on d.id=s.device_id where s.organization_id=org and s.branch_id=branch and s.id=(data->>'shiftId')::uuid and s.cashier_id=auth.uid() and s.device_id=(data->>'deviceId')::uuid and s.closed_at is null and d.active and exists(select 1 from public.shift_authorizations a where a.shift_id=s.id and now() between a.issued_at and a.expires_at)) then raise exception 'Open or renew your authorized cashier shift before checking prices' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
  perform app_private.require_online_branch_prices(data);
  return '{"valid":true}'::jsonb;
 end if;
 if action in('record_online_sale','record_credit_sale') then
  perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
  if not exists(select 1 from public.sales s where s.id=coalesce((data->>'transactionId')::uuid,(data->>'requestId')::uuid)) then
   perform app_private.require_online_branch_prices(data);
  end if;
 end if;
 if action in('set_price','review_product_price','review_import_setup','review_imported_product','create_product') and app_private.network_managed(org) then
  if exists(select 1 from public.stock_control_events e where e.id=(data->>'requestId')::uuid and e.organization_id=org and e.branch_id=branch and e.actor_id=auth.uid() and e.action=command.action and e.payload=data) then return app_private.command_before_branch_pricing(action,data);end if;
  if branch is distinct from app_private.network_hub(org) then raise exception 'Use the branch selling-price editor for this location; shared costing is managed at the hub' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
  if data->>'unitId' is not null then
   select v.price into legacy_before from public.product_units u join public.unit_prices v on v.organization_id=u.organization_id and v.unit_id=u.id and v.version=u.price_version where u.organization_id=org and u.id=(data->>'unitId')::uuid;
   select * into current_price from app_private.branch_unit_prices p where p.organization_id=org and p.branch_id=branch and p.unit_id=(data->>'unitId')::uuid order by p.version desc limit 1;
   if data->'retailPriceConfirmed'='true'::jsonb and (data->>'expectedBranchPriceVersion')::integer is distinct from coalesce(current_price.version,0) then
    raise exception 'The branch selling price changed. Refresh and review';
   end if;
   publish_needed:=current_price.id is null or ((data->>'price')::bigint is distinct from current_price.price and ((data->>'price')::bigint is distinct from legacy_before or data->'retailPriceConfirmed'='true'::jsonb));
   if publish_needed and current_price.id is not null and current_price.price is distinct from legacy_before and not coalesce((data->'retailPriceConfirmed'='true'::jsonb and (data->>'expectedBranchPriceVersion')::integer=current_price.version),false) then
    raise exception 'The branch price changed independently. Review its current selling price before changing retail; cost-only edits keep the existing branch price';
   end if;
  end if;
  result:=app_private.command_before_branch_pricing(action,data);
  if coalesce((result->>'duplicate')::boolean,false) then return result;end if;
  if action='create_product' or action='review_imported_product' then
   for unit in select u.id,v.price from public.product_units u join public.unit_prices v on v.organization_id=u.organization_id and v.unit_id=u.id and v.version=u.price_version join public.products p on p.id=u.product_id where u.organization_id=org and u.product_id=(result->>'id')::uuid and not p.price_pending and not p.setup_pending loop
    if not exists(select 1 from app_private.branch_unit_prices p where p.organization_id=org and p.branch_id=branch and p.unit_id=unit.id) then
     perform app_private.publish_branch_unit_price(jsonb_build_object('organizationId',org,'branchId',branch,'requestId',gen_random_uuid(),'unitId',unit.id,'expectedVersion',0,'price',unit.price,'reason','Owner confirmed selling setup'));
    end if;
   end loop;
  elsif publish_needed then
   perform app_private.publish_branch_unit_price(jsonb_build_object('organizationId',org,'branchId',branch,'requestId',gen_random_uuid(),'unitId',data->>'unitId','expectedVersion',coalesce(current_price.version,0),'price',data->'price','reason',coalesce(nullif(data->>'reason',''),'Owner confirmed hub selling price')));
  end if;
  return result;
 end if;
 return app_private.command_before_branch_pricing(action,data);
end $$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;
revoke all on function app_private.publish_branch_unit_price(jsonb),app_private.branch_price_book(jsonb),app_private.branch_priced_snapshot(jsonb) from public,anon,authenticated;

create function app_private.branch_sale_price(org uuid,branch uuid,item jsonb,strict boolean default false) returns bigint language plpgsql stable set search_path='' as $$
declare selected app_private.branch_unit_prices;current_price app_private.branch_unit_prices;legacy_price bigint;
begin
 select p.price into legacy_price from public.unit_prices p where p.organization_id=org and p.unit_id=(item->>'unitId')::uuid and p.version=(item->>'priceVersion')::integer;
 if item->>'branchPriceId' is not null then
  select * into selected from app_private.branch_unit_prices p where p.organization_id=org and p.branch_id=branch and p.unit_id=(item->>'unitId')::uuid and p.id=(item->>'branchPriceId')::uuid and p.version=(item->>'branchPriceVersion')::integer;
  if selected.id is null or (item->>'branchId')::uuid is distinct from branch or (item->>'unitPrice')::bigint is distinct from selected.price or item->>'sellingPolicy' is distinct from selected.selling_policy then raise exception 'Branch selling price, unit or version does not match the original confirmed price';end if;
  if selected.selling_policy='sealed_whole' and ((item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or item->'intactPackagingConfirmed' is distinct from 'true'::jsonb) then raise exception 'Sealed packs require whole quantities and cashier confirmation of intact packaging';end if;
 else
  -- Legacy completed offline cash keeps the original historical price rules.
  if item->>'branchId' is not null or item->>'branchPriceVersion' is not null then raise exception 'Incomplete branch price identity';end if;
  if not strict or not app_private.network_managed(org) then return legacy_price;end if;
 end if;
 if strict and app_private.network_managed(org) then
  select * into current_price from app_private.branch_unit_prices p where p.organization_id=org and p.branch_id=branch and p.unit_id=(item->>'unitId')::uuid order by p.version desc limit 1;
  if current_price.id is null then raise exception 'This branch needs a confirmed selling price for this unit';end if;
  if selected.id is not null then
   if selected.id<>current_price.id then raise exception 'The branch selling price changed. Refresh and review this basket';end if;
  elsif branch is distinct from app_private.network_hub(org) or current_price.source_legacy_version is distinct from (item->>'priceVersion')::integer or current_price.price is distinct from (item->>'unitPrice')::bigint or current_price.selling_policy<>'fractional' then
   raise exception 'Update this basket with the confirmed branch selling price before checkout';
  end if;
 end if;
 return coalesce(selected.price,legacy_price);
end $$;
create function app_private.require_online_branch_prices(data jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb;org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;
begin
 for item in select value from jsonb_array_elements(data->'items') loop
  perform app_private.branch_sale_price(org,branch,item,true);
  if not exists(select 1 from public.product_units u join public.products p on p.organization_id=u.organization_id and p.id=u.product_id join public.unit_prices v on v.organization_id=u.organization_id and v.unit_id=u.id and v.version=u.price_version where u.organization_id=org and u.id=(item->>'unitId')::uuid and u.product_id=(item->>'productId')::uuid and p.active and not p.setup_pending and (not p.price_pending or item->>'branchPriceId' is not null) and u.price_version=(item->>'priceVersion')::integer and v.cost=(item->>'unitCost')::bigint and u.factor=(item->>'factor')::numeric) then raise exception 'Product, cost or selling unit changed. Refresh and review this basket';end if;
 end loop;
end $$;
revoke all on function app_private.branch_sale_price(uuid,uuid,jsonb,boolean),app_private.require_online_branch_prices(jsonb) from public,anon,authenticated;

-- Patch the existing financial writers, with exact checked anchors. Their
-- shift, cost, refund, discount, stock and original-request rules remain owners.
do $validators$ declare src text;anchor text;replacement text;fn text;begin
 foreach fn in array array['command_legacy','credit_command'] loop
  src:=pg_get_functiondef(format('app_private.%I(text,jsonb)',fn)::regprocedure);
  anchor:=case when fn='command_legacy' then '(row_item->>''unitPrice'')::bigint<>price.price' else '(row_item->>''unitPrice'')::bigint is distinct from pr.price' end;
  if strpos(src,anchor)=0 then raise exception 'Selling price validator changed: %',fn;end if;
  replacement:='(row_item->>''unitPrice'')::bigint is distinct from app_private.branch_sale_price(org,branch,row_item)';
  src:=replace(src,anchor,replacement);
  anchor:=case when fn='command_legacy' then 'app_private.discounted_sale_line(row_item,q,price.price,org,branch)' else 'app_private.discounted_sale_line(row_item,q,pr.price,org,branch)' end;
  if strpos(src,anchor)=0 then raise exception 'Sale amount validator changed: %',fn;end if;
  src:=replace(src,anchor,'app_private.discounted_sale_line(row_item,q,app_private.branch_sale_price(org,branch,row_item),org,branch)');
  anchor:='line_total,price_version) values(org,ident,';
  if strpos(src,anchor)=0 then raise exception 'Sale item writer changed: %',fn;end if;
  src:=replace(src,anchor,'line_total,price_version,branch_id,branch_price_id,branch_price_version) values(org,ident,');
  anchor:=case when fn='command_legacy' then '(row_item->>''priceVersion'')::int);' else '(row_item->>''priceVersion'')::integer);' end;
  if strpos(src,anchor)=0 then raise exception 'Sale item version writer changed: %',fn;end if;
  src:=replace(src,anchor,replace(anchor,');',',(row_item->>''branchId'')::uuid,(row_item->>''branchPriceId'')::uuid,(row_item->>''branchPriceVersion'')::integer);'));
  if fn='credit_command' then
   src:=replace(src,'if prod.price_pending or prod.setup_pending then','if (prod.price_pending and row_item->>''branchPriceId'' is null) or prod.setup_pending then');
  end if;
  execute src;
 end loop;
 -- Retail pending is per unit once the branch price is explicitly confirmed.
 src:=pg_get_functiondef('app_private.command_before_test_history_archive(text,jsonb)'::regprocedure);
 anchor:='(p.price_pending or p.setup_pending)';
 if strpos(src,anchor)=0 then raise exception 'Imported cash price-readiness validator changed';end if;
 execute replace(src,anchor,'((p.price_pending and item->>''branchPriceId'' is null) or p.setup_pending)');
end $validators$;

create function app_private.copy_branch_unit_prices(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;request uuid:=(data->>'requestId')::uuid;prior app_private.branch_price_requests;entry jsonb;source app_private.branch_unit_prices;result jsonb;count_n integer:=0;
begin
 if not app_private.network_enabled(org) or not app_private.can_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner') then raise exception 'Only the owner of an enabled branch network can copy selling prices' using errcode='42501';end if;
 if request is null or data->'confirmed' is distinct from 'true'::jsonb or jsonb_typeof(data->'copies') is distinct from 'array' or jsonb_array_length(data->'copies') not between 1 and 100 or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000 then raise exception 'Review explicit target branches, units, prices and reason before confirming a copy';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||request::text,0));
 select * into prior from app_private.branch_price_requests r where r.id=request;
 if found then
  if prior.organization_id<>org or prior.actor_id<>auth.uid() or prior.payload<>data then raise exception 'This price copy reference contains different selections';end if;
  return prior.result||'{"duplicate":true}'::jsonb;
 end if;
 -- Deterministic locks prevent opposing copy operations deadlocking.
 for entry in select to_jsonb(b) from (select branch b union select (x->>'branchId')::uuid from jsonb_array_elements(data->'copies')x) ids order by b loop
  perform pg_advisory_xact_lock(hashtextextended(org::text||(entry#>>'{}'),1));
 end loop;
 for entry in select value from jsonb_array_elements(data->'copies') loop
  if (entry->>'branchId')::uuid=branch then raise exception 'Choose a different destination branch';end if;
  select * into source from app_private.branch_unit_prices p where p.organization_id=org and p.branch_id=branch and p.unit_id=(entry->>'unitId')::uuid order by p.version desc limit 1;
  if source.id is null or source.id is distinct from (entry->>'sourcePriceId')::uuid then raise exception 'A selected source price changed. Review the copy again';end if;
  perform app_private.publish_branch_unit_price(jsonb_build_object('organizationId',org,'branchId',entry->>'branchId','unitId',entry->>'unitId','requestId',gen_random_uuid(),'expectedVersion',entry->'expectedVersion','price',source.price,'sellingPolicy',source.selling_policy,'reason',data->>'reason'));
  count_n:=count_n+1;
 end loop;
 result:=jsonb_build_object('count',count_n,'duplicate',false);
 insert into app_private.branch_price_requests values(request,org,auth.uid(),data,result);
 return result;
end $$;
revoke all on function app_private.copy_branch_unit_prices(jsonb) from public,anon,authenticated;
