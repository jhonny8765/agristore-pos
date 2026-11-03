-- Keep the original numeric fields for old clients; new clients read exact
-- decimal strings before JavaScript can round large account-wide aggregates.
-- PostgreSQL numeric accepts NaN even in fixed-precision columns. Reject all
-- non-finite stored quantities/cost evidence independently of RPC validation.
do $finite_numeric$declare r record;begin
 for r in select table_schema,table_name,string_agg(format('(%1$I is null or %1$I not in (''NaN''::numeric,''Infinity''::numeric,''-Infinity''::numeric))',column_name),' and ' order by ordinal_position) predicate
 from information_schema.columns c where table_schema in('public','app_private') and data_type='numeric' and exists(select 1 from pg_tables t where t.schemaname=c.table_schema and t.tablename=c.table_name) group by table_schema,table_name loop
  execute format('alter table %I.%I add constraint finite_numbers check (%s)',r.table_schema,r.table_name,r.predicate);
 end loop;
end$finite_numeric$;
create function app_private.exact_credit_book(book jsonb) returns jsonb language sql immutable set search_path='' as $$
 select book||jsonb_build_object(
  'exactTotals',(select jsonb_object_agg(k,book->>k) from unnest(array['outstanding','overdue','creditSales','openingBalances','cashCollected']) k),
  'agingExact',(select jsonb_object_agg(k,v#>>'{}') from jsonb_each(book->'aging') a(k,v)),
  'clients',coalesce((select jsonb_agg(c||jsonb_build_object('outstandingExact',c->>'outstanding','overdueExact',c->>'overdue') order by n) from jsonb_array_elements(book->'clients') with ordinality a(c,n)),'[]'))
$$;
revoke all on function app_private.exact_credit_book(jsonb) from public,anon,authenticated;
create function app_private.exact_dashboard(book jsonb) returns jsonb language sql immutable set search_path='' as $$
 select book||jsonb_build_object('exactTotals',coalesce((select jsonb_object_agg(k,v#>>'{}') from jsonb_each(book) a(k,v) where k in('grossSales','refunds','netRefunds','refundRecoveries','total','expected_cash','counted_cash','opening_cash')),'{}'))
 ||case when jsonb_typeof(book->'branchTotals')='array' then jsonb_build_object('branchTotals',(select coalesce(jsonb_agg(app_private.exact_dashboard(b) order by n),'[]') from jsonb_array_elements(book->'branchTotals') with ordinality a(b,n))) else '{}'::jsonb end
$$;
revoke all on function app_private.exact_dashboard(jsonb) from public,anon,authenticated;
create index unit_price_history_scope on public.unit_prices(organization_id,created_at desc,unit_id desc,version desc);
create function app_private.price_history(data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;q text:=btrim(coalesce(data->>'query',''));c jsonb:=data->'before';stamp timestamptz;unit uuid;version_n integer;result jsonb;
begin
 if not app_private.can_supplier_accounts(org) then raise exception 'Only the owner can read price history' using errcode='42501';end if;
 if length(q)>180 then raise exception 'Use a shorter product search';end if;
 if c is not null and c<>'null'::jsonb then
  stamp:=(c->>'at')::timestamptz;unit:=(c->>'unitId')::uuid;version_n:=(c->>'version')::integer;
  if stamp is null or unit is null or version_n is null or version_n<1 then raise exception 'Refresh the price-history page';end if;
 end if;
 with filtered as materialized(select v.*,p.name product_name,p.sku,u.name unit_name from public.unit_prices v join public.product_units u on u.organization_id=v.organization_id and u.id=v.unit_id join public.products p on p.organization_id=u.organization_id and p.id=u.product_id where v.organization_id=org and (q='' or position(lower(q) in lower(p.name||' '||p.sku||' '||u.name))>0)),
 page as materialized(select * from filtered where stamp is null or (created_at,unit_id,version)<(stamp,unit,version_n) order by created_at desc,unit_id desc,version desc limit 51),
 shown as materialized(select * from page order by created_at desc,unit_id desc,version desc limit 50)
 select jsonb_build_object('asOf',statement_timestamp(),'total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(jsonb_build_object('unitId',unit_id,'version',version,'price',price::text,'at',created_at,'name',product_name,'sku',sku,'unitName',unit_name) order by created_at desc,unit_id desc,version desc) from shown),'[]'),
 'next',case when (select count(*) from page)>50 then (select jsonb_build_object('at',created_at,'unitId',unit_id,'version',version) from shown order by created_at,unit_id,version limit 1) else null end) into result;
 return result;
end$$;
revoke all on function app_private.price_history(jsonb) from public,anon,authenticated;
do $exact_credit_route$declare src text;anchor text:=' if action in (''product_review_state''';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Exact credit dispatcher anchor changed';end if;
 src:=replace(src,anchor,E' if action=''price_history'' then return app_private.price_history(data);end if;\n if action in (''dashboard'',''close_shift'') then return app_private.exact_dashboard(app_private.command_before_customer_credit(action,data));end if;\n if action=''credit_book'' then return app_private.exact_credit_book(app_private.credit_command(action,data));end if;\n'||anchor);
 execute src;
end$exact_credit_route$;
