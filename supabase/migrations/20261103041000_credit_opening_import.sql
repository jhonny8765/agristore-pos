-- Historical receivables are documents, never manufactured product sales.
create table app_private.credit_import_batches (
 organization_id uuid primary key references public.organizations(id),branch_id uuid not null,source_hash text not null,
 source_rows jsonb not null,imported_by uuid not null references auth.users(id),imported_at timestamptz not null default now(),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
alter table app_private.credit_import_batches enable row level security;
revoke all on app_private.credit_import_batches from public,anon,authenticated;
create policy command_only on app_private.credit_import_batches as restrictive for all to authenticated using(false) with check(false);
create trigger immutable_history before update or delete on app_private.credit_import_batches for each row execute function app_private.immutable();

create function app_private.credit_source_uuid(key text) returns uuid language sql immutable set search_path='' as $$
 select overlay(overlay(md5(key) placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid
$$;
revoke all on function app_private.credit_source_uuid(text) from public,anon,authenticated;

create function app_private.import_opening_credit(org uuid,branch uuid,owner_id uuid,source_hash text,source_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare previous app_private.credit_import_batches;r jsonb;client_id uuid;invoice_id uuid;source_name text;client_count integer;invoice_count integer:=0;excluded integer:=0;zero_count integer:=0;total bigint:=0;amount bigint;issued date;
begin
 perform pg_advisory_xact_lock(hashtextextended('opening-credit:'||org::text,0));
 if org is null or branch is null or not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch and b.active) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=owner_id and m.active and m.role='owner') then raise exception 'Verify the intended branch and existing owner before importing';end if;
 if exists(select 1 from public.cashier_shifts s where s.organization_id=org and s.closed_at is null) then raise exception 'Close and synchronize store shifts before opening-balance import';end if;
 if source_hash is null or source_hash!~'^[0-9a-f]{64}$' or jsonb_typeof(source_rows) is distinct from 'array' or jsonb_array_length(source_rows) not between 1 and 10000 then raise exception 'Use a hashed source workbook with 1 to 10000 documented rows';end if;
 select * into previous from app_private.credit_import_batches b where b.organization_id=org;
 if previous.organization_id is not null then
  if previous.source_hash=source_hash and previous.source_rows=source_rows and previous.branch_id=branch then return jsonb_build_object('duplicate',true,'sourceHash',source_hash);end if;
  raise exception 'Opening credit was already imported. Preserve the original and reconcile subsequent files separately';
 end if;
 if (select count(distinct x->>'sourceRow') from jsonb_array_elements(source_rows)x)<>jsonb_array_length(source_rows) then raise exception 'Each workbook row needs one permanent source identity';end if;
 for r in select value from jsonb_array_elements(source_rows) loop
  if r->>'group' not in ('CUSTOMER','BRANCH') or r->>'group' is null then raise exception 'Unsupported source account group';end if;
  if r->>'group'='BRANCH' then excluded:=excluded+1;continue;end if;
  source_name:=btrim(r->>'name');amount:=(r->>'amountCentavos')::bigint;issued:=(r->>'issuedOn')::date;
  if source_name is null or length(source_name) not between 1 and 180 or amount is null or amount<0 or amount>9007199254740991 or issued is null or issued>(now() at time zone 'Asia/Manila')::date or length(btrim(coalesce(r->>'reference',''))) not between 1 and 100 or (r->>'sourceRow')::integer<2 then raise exception 'A source invoice is incomplete or invalid. Do not guess missing values';end if;
  client_id:=app_private.credit_source_uuid(org::text||':opening-client:'||upper(regexp_replace(source_name,'\s+',' ','g')));
  insert into public.credit_clients(id,organization_id,branch_id,name,enabled,credit_limit,terms) values(client_id,org,branch,source_name,false,0,array[30]) on conflict(id) do nothing;
  if not exists(select 1 from public.credit_clients c where c.id=client_id and c.organization_id=org and c.branch_id=branch) then raise exception 'Client source identity conflict';end if;
  if amount=0 then zero_count:=zero_count+1;continue;end if;
  invoice_id:=app_private.credit_source_uuid(org::text||':opening-invoice:'||source_hash||':'||(r->>'sourceRow'));
  insert into public.credit_invoices(sale_id,organization_id,branch_id,client_id,term,due_on,official_reference,client_snapshot,seller_name,actual_sale_id,amount,issued_at,payload,source,source_hash,source_row,source_notes)
   values(invoice_id,org,branch,client_id,null,null,btrim(r->>'reference'),jsonb_build_object('name',source_name,'address','','tin',''),(select o.name from public.organizations o where o.id=org),null,amount,issued::timestamp at time zone 'Asia/Manila',jsonb_build_object('items',jsonb_build_array()),'opening',source_hash,(r->>'sourceRow')::integer,coalesce(r->>'notes',''));
  invoice_count:=invoice_count+1;total:=total+amount;
 end loop;
 select count(*) into client_count from public.credit_clients c where c.organization_id=org and exists(select 1 from jsonb_array_elements(source_rows)x where x->>'group'='CUSTOMER' and c.id=app_private.credit_source_uuid(org::text||':opening-client:'||upper(regexp_replace(btrim(x->>'name'),'\s+',' ','g'))));
 insert into app_private.credit_import_batches values(org,branch,source_hash,source_rows,owner_id,now());
 insert into public.audit_events(organization_id,branch_id,actor_id,action,details) values(org,branch,owner_id,'import_opening_credit',jsonb_build_object('sourceHash',source_hash,'sourceRows',jsonb_array_length(source_rows),'clients',client_count,'invoices',invoice_count,'openingBalanceCentavos',total,'excludedBranchRows',excluded,'zeroBalanceRows',zero_count,'performedVia','Owner-requested maintenance import','dueDatesSupplied',false,'newCreditApproved',false,'stockChanged',false));
 return jsonb_build_object('duplicate',false,'clients',client_count,'invoices',invoice_count,'balanceCentavos',total,'excludedBranchRows',excluded,'zeroBalanceRows',zero_count);
end$$;
-- Maintenance import is intentionally unavailable to the public/authenticated API.
revoke all on function app_private.import_opening_credit(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
