-- Canonical baseline for the archive safeguard already installed by store preparation.
-- Existing installations are retained; fresh test/recovery stacks get the same chain.
do $archive_baseline$
begin
 if to_regprocedure('app_private.command_before_test_history_archive(text,jsonb)') is not null then return;end if;
 if to_regprocedure('app_private.command_before_customer_credit(text,jsonb)') is not null then
  raise exception 'Install the archive baseline before customer credit on a fresh database';
 end if;
 execute $archive_baseline_ddl$
-- Maintenance-only archive storage. This does not archive or delete any data.
-- The normal authenticated command remains the authorization boundary.
create table if not exists app_private.test_history_archives (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 created_at timestamptz not null default now(), data jsonb not null, retired_ids text[] not null
);
create table if not exists app_private.archived_test_sales (
 id uuid primary key, organization_id uuid not null, branch_id uuid not null,
 cashier_id uuid not null, archive_id uuid not null references app_private.test_history_archives(id),
 payload jsonb not null, receipt text not null, fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$')
);
alter table app_private.test_history_archives enable row level security;
alter table app_private.archived_test_sales enable row level security;
revoke all on app_private.test_history_archives,app_private.archived_test_sales from public,anon,authenticated;
do $$begin
 if to_regprocedure('app_private.command_before_test_history_archive(text,jsonb)') is null then
  alter function app_private.command(text,jsonb) rename to command_before_test_history_archive;
 end if;
end$$;
create or replace function app_private.command(action text,data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare archive_request_data jsonb:=data; org uuid:=(data->>'organizationId')::uuid; branch uuid:=(data->>'branchId')::uuid;
 retired app_private.archived_test_sales; archive_id uuid; result jsonb; owner_access boolean;
begin
 if action='record_sale' then
  select * into retired from app_private.archived_test_sales s where s.id=(data->>'transactionId')::uuid and s.organization_id=org;
  if retired.id is not null then
   if auth.uid() is distinct from retired.cashier_id or branch is distinct from retired.branch_id
    or not app_private.can_checkout(org,branch)
    or not exists(select 1 from public.branches where id=branch and organization_id=org and active) then
    raise exception 'The original cashier must acknowledge this archived test sale' using errcode='42501';
   end if;
   if retired.payload is distinct from data then raise exception 'Archived test transaction payload differs from the original' using errcode='22023';end if;
   -- Exact old-file retries acknowledge the archive without creating live cash
   -- or inventory effects, including from a browser on the previous app build.
   return jsonb_build_object('transactionId',retired.id,'status','duplicate','receipt',retired.receipt,'flags','[]'::jsonb);
  end if;
 end if;
 if action<>'snapshot' and exists(
  select 1 from app_private.test_history_archives a cross join lateral jsonb_each_text(archive_request_data) e
  where a.organization_id=org and e.value=any(a.retired_ids)
 ) then
  if not app_private.can_access(org,branch) then raise exception 'Store access denied' using errcode='42501';end if;
  raise exception 'This TEST record was archived during store preparation. Start a new record.' using errcode='22023';
 end if;
 result:=app_private.command_before_test_history_archive(action,data);
 if action='snapshot' then
  select a.id into archive_id from app_private.test_history_archives a where a.organization_id=org order by a.created_at desc,a.id desc limit 1;
  if archive_id is not null then
   owner_access:=exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner');
   result:=result||jsonb_build_object('confirmedIds',coalesce((select jsonb_agg(id order by id) from (
    select value as id from jsonb_array_elements_text(coalesce(result->'confirmedIds','[]'))
    union select s.id::text from app_private.archived_test_sales s
     where s.organization_id=org and s.branch_id=branch and (owner_access or s.cashier_id=auth.uid())
     and s.id::text in(select value from jsonb_array_elements_text(coalesce(data->'transactionIds','[]')))
   )ids),'[]'::jsonb));
   if data->>'historyArchiveVersion' is distinct from archive_id::text then
    result:=result||jsonb_build_object('historyArchive',jsonb_build_object(
     'id',archive_id,'organizationId',org,'branchId',branch,
     'sales',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'fingerprint',s.fingerprint) order by s.id)
       from app_private.archived_test_sales s where s.organization_id=org and s.branch_id=branch and(owner_access or s.cashier_id=auth.uid())),'[]'::jsonb),
     'shiftIds',coalesce((select jsonb_agg(s.value->>'id' order by s.value->>'id') from app_private.test_history_archives a
      cross join lateral jsonb_array_elements(a.data->'tables'->'public.cashier_shifts')s
      where a.organization_id=org and s.value->>'branch_id'=branch::text and(owner_access or s.value->>'cashier_id'=auth.uid()::text)),'[]'::jsonb)
    ));
   end if;
  end if;
 end if;
 return result;
end$$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;

$archive_baseline_ddl$;
end
$archive_baseline$;
