-- Keep paper-era records with their original business date and drawer evidence.
create table public.historical_drawer_notebooks (
  organization_id uuid not null,
  branch_id uuid not null,
  business_date date not null,
  source_reference text not null check (length(source_reference) between 3 and 250),
  opening_cash bigint not null,
  closing_cash bigint not null,
  gross_sales bigint not null,
  reported_expenses bigint not null,
  drawer_in bigint not null,
  drawer_out bigint not null,
  evidence jsonb not null,
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  primary key (organization_id, branch_id, business_date),
  foreign key (organization_id, branch_id) references public.branches(organization_id, id),
  check (opening_cash + drawer_in - drawer_out = closing_cash)
);

alter table public.historical_drawer_notebooks enable row level security;
revoke all on table public.historical_drawer_notebooks from public, anon, authenticated;
grant select on table public.historical_drawer_notebooks to authenticated;
create policy historical_notebook_owner on public.historical_drawer_notebooks for select to authenticated
  using (app_private.can_access(organization_id, branch_id) and exists (
    select 1 from public.staff_memberships s
    where s.organization_id=historical_drawer_notebooks.organization_id
      and s.user_id=(select auth.uid()) and s.active and s.role='owner'
  ));
create trigger immutable_historical_drawer_notebook before update or delete on public.historical_drawer_notebooks
  for each row execute function app_private.immutable();

create function app_private.notebook_centavos(amount jsonb) returns bigint
language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(amount) is distinct from 'number' or amount::text !~ '^[0-9]{1,12}$' then
    raise exception 'Enter nonnegative whole centavos in each notebook amount.';
  end if;
  return amount::text::bigint;
end $$;
revoke all on function app_private.notebook_centavos(jsonb) from public, anon, authenticated;

create function app_private.store_historical_drawer_notebooks(
  org uuid, branch uuid, recorder uuid, days jsonb
) returns jsonb language plpgsql set search_path='' as $$
declare
  day_data jsonb; entry jsonb; day_key date; reference text;
  opening bigint; closing bigint; sales bigint; expenses bigint;
  cash_in bigint; cash_out bigint; gross bigint; spent bigint; incoming bigint; outgoing bigint;
  existing public.historical_drawer_notebooks;
  added integer := 0; known integer := 0;
begin
  if not exists(select 1 from public.staff_memberships s
    where s.organization_id=org and s.user_id=recorder and s.role='owner' and s.active)
    or not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch and b.active)
  then raise exception 'Only an owner of this branch can save a notebook.' using errcode='42501';end if;
  if jsonb_typeof(days) is distinct from 'array' or jsonb_array_length(days) not between 1 and 31
     or pg_column_size(days)>1000000
  then raise exception 'Choose up to 31 historical business days in a notebook under 1 MB.';end if;
  if exists(select 1 from jsonb_array_elements(days) x group by x->>'date' having count(*)>1)
  then raise exception 'Include each business date only once.';end if;

  perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
  for day_data in select value from jsonb_array_elements(days) order by value->>'date' loop
    if coalesce(day_data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
      or jsonb_typeof(day_data->'sales') is distinct from 'array'
      or jsonb_typeof(day_data->'expenses') is distinct from 'array'
      or jsonb_typeof(day_data->'drawer') is distinct from 'array'
      or greatest(jsonb_array_length(day_data->'sales'),jsonb_array_length(day_data->'expenses'),
        jsonb_array_length(day_data->'drawer'))>2000
    then raise exception 'Provide the historical date and its sales, expenses and drawer entries.';end if;
    day_key:=(day_data->>'date')::date;
    if day_key >= (statement_timestamp() at time zone 'Asia/Manila')::date
    then raise exception 'Use a prior business date for the historical notebook.';end if;
    reference:=btrim(coalesce(day_data->>'source',''));
    if length(reference) not between 3 and 250 then raise exception 'Name the source notebook or report.';end if;
    opening:=app_private.notebook_centavos(day_data->'openingCash');
    closing:=app_private.notebook_centavos(day_data->'closingCash');
    sales:=app_private.notebook_centavos(day_data->'grossSales');
    expenses:=app_private.notebook_centavos(day_data->'reportedExpenses');
    gross:=0; spent:=0; incoming:=0; outgoing:=0;
    for entry in select value from jsonb_array_elements(day_data->'sales') loop
      if jsonb_typeof(entry->'product') is distinct from 'string'
         or length(btrim(entry->>'product')) not between 1 and 250 then raise exception 'Every sale line needs its written product.';end if;
      gross:=gross+app_private.notebook_centavos(entry->'amount');
    end loop;
    for entry in select value from jsonb_array_elements(day_data->'expenses') loop
      if jsonb_typeof(entry->'category') is distinct from 'string'
         or length(btrim(entry->>'category')) not between 1 and 180 then raise exception 'Every expense line needs its written category.';end if;
      spent:=spent+app_private.notebook_centavos(entry->'amount');
    end loop;
    for entry in select value from jsonb_array_elements(day_data->'drawer') loop
      if jsonb_typeof(entry->'description') is distinct from 'string'
        or length(btrim(entry->>'description')) not between 1 and 250 then raise exception 'Every drawer entry needs its written description.';end if;
      cash_in:=app_private.notebook_centavos(entry->'cashIn');
      cash_out:=app_private.notebook_centavos(entry->'cashOut');
      if (cash_in>0)=(cash_out>0) then raise exception 'A drawer entry needs one cash-in or cash-out amount.';end if;
      incoming:=incoming+cash_in; outgoing:=outgoing+cash_out;
    end loop;
    if gross<>sales or spent<>expenses or opening+incoming-outgoing<>closing
    then raise exception 'Notebook totals do not reconcile for %.',day_key;end if;
    select * into existing from public.historical_drawer_notebooks n
      where n.organization_id=org and n.branch_id=branch and n.business_date=day_key;
    if found then
      if existing.evidence is distinct from day_data then
        raise exception 'A different notebook is already recorded for %. Keep its original and reconcile the difference.', day_key;
      end if;
      known:=known+1;
      continue;
    end if;
    if exists(select 1 from public.sales s where s.organization_id=org and s.branch_id=branch
        and s.occurred_at>=day_key::timestamp at time zone 'Asia/Manila'
        and s.occurred_at<(day_key+1)::timestamp at time zone 'Asia/Manila')
    then raise exception 'POS receipts already exist for %. Check for overlapping sales before saving the notebook.',day_key;end if;
    insert into public.historical_drawer_notebooks
      (organization_id,branch_id,business_date,source_reference,opening_cash,closing_cash,
       gross_sales,reported_expenses,drawer_in,drawer_out,evidence,recorded_by)
    values(org,branch,day_key,reference,opening,closing,sales,expenses,incoming,outgoing,day_data,recorder);
    insert into public.audit_events(organization_id,branch_id,actor_id,action,details)
    values(org,branch,recorder,'save_historical_drawer_notebook',
      jsonb_build_object('businessDate',day_key,'source',reference,'grossSales',sales,'reportedExpenses',expenses,
        'openingCash',opening,'closingCash',closing));
    added:=added+1;
  end loop;
  return jsonb_build_object('saved',added,'alreadySaved',known);
end $$;
revoke all on function app_private.store_historical_drawer_notebooks(uuid,uuid,uuid,jsonb) from public, anon, authenticated;

create function public.save_historical_drawer_notebooks(org uuid, branch uuid, days jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not app_private.can_access(org,branch) then
    raise exception 'Sign in with access to this branch.' using errcode='42501';
  end if;
  return app_private.store_historical_drawer_notebooks(org,branch,auth.uid(),days);
end
$$;
revoke all on function public.save_historical_drawer_notebooks(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_historical_drawer_notebooks(uuid,uuid,jsonb) to authenticated;
