-- Release A is a schema-only foundation. No business, branch or entitlement rows
-- are inserted here. Existing fixed installations fail closed without config.
create table app_private.branch_network_entitlements (
 organization_id uuid primary key references public.organizations(id),
 granted boolean not null default false,
 payment_reference text,
 activation_reference text,
 check(not granted or (length(btrim(payment_reference))>=3 and length(btrim(activation_reference))>=3
  and payment_reference is not null and activation_reference is not null))
);
create table app_private.branch_network_configuration (
 organization_id uuid primary key references public.organizations(id),
 hub_branch_id uuid not null,
 enabled boolean not null default false,
 activated_at timestamptz,
 foreign key(organization_id,hub_branch_id) references public.branches(organization_id,id)
);
create table app_private.branch_network_branches (
 organization_id uuid not null references app_private.branch_network_configuration(organization_id),
 branch_id uuid not null,
 can_request boolean not null default false,
 can_dispatch boolean not null default false,
 can_receive boolean not null default false,
 primary key(organization_id,branch_id),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
do $private$ declare t text;begin
 foreach t in array array['branch_network_entitlements','branch_network_configuration','branch_network_branches'] loop
  execute format('alter table app_private.%I enable row level security',t);
  execute format('revoke all on app_private.%I from public,anon,authenticated',t);
  execute format('create policy maintainer_only on app_private.%I as restrictive for all to anon,authenticated using(false) with check(false)',t);
 end loop;
end $private$;

create function app_private.network_managed(org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.branch_network_configuration c where c.organization_id=org)
 or exists(select 1 from public.branches b where b.organization_id=org and b.active and b.management_locked)
$$;
create function app_private.network_enabled(org uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.branch_network_configuration c join app_private.branch_network_entitlements e using(organization_id)
 where c.organization_id=org and c.enabled and e.granted)
$$;
create function app_private.network_hub(org uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select coalesce((select c.hub_branch_id from app_private.branch_network_configuration c where c.organization_id=org),
 (select b.id from public.branches b where b.organization_id=org and b.active and b.management_locked))
$$;
-- Preserve the original membership/session predicate independently of the
-- commercial scope, solely for verified acknowledgments and reconciliation.
create function app_private.membership_access(org uuid,branch uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now()))
 and exists(select 1 from public.staff_memberships m where m.user_id=auth.uid() and m.organization_id=org and m.active and (m.role='owner' or branch is null or m.branch_id=branch))
$$;
create function app_private.membership_checkout(org uuid,branch uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.membership_access(org,branch) and exists(select 1 from public.staff_memberships m where m.user_id=auth.uid() and m.organization_id=org and m.active and (m.role='owner' or (m.branch_id=branch and m.role in('cashier','manager'))))
$$;
revoke all on function app_private.membership_access(uuid,uuid),app_private.membership_checkout(uuid,uuid) from public,anon,authenticated;
create function app_private.network_branch_allowed(org uuid,branch uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not app_private.network_managed(org) or exists(select 1 from public.branches b
 where b.organization_id=org and b.id=branch and b.active and
 (b.id=app_private.network_hub(org) or (app_private.network_enabled(org) and exists(
  select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=branch))))
$$;
create or replace function app_private.can_access(org uuid,branch uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.membership_access(org,branch) and (branch is null or app_private.network_branch_allowed(org,branch))
$$;
create or replace function app_private.can_checkout(org uuid,branch uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.membership_checkout(org,branch) and app_private.network_branch_allowed(org,branch)
$$;
revoke all on function app_private.can_access(uuid,uuid),app_private.can_checkout(uuid,uuid) from public,anon;
grant execute on function app_private.can_access(uuid,uuid),app_private.can_checkout(uuid,uuid) to authenticated;

-- Add a restrictive commercial scope to every existing branch-scoped public
-- table, including the owner/self membership policies.
do $rls$ declare t record;begin
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='branch_id'
 and table_name in(select tablename from pg_tables where schemaname='public') loop
  execute format('create policy network_scope on public.%I as restrictive for select to authenticated using(branch_id is null or app_private.network_branch_allowed(organization_id,branch_id))',t.table_name);
 end loop;
end $rls$;
alter policy branch_read on public.branches using(active and app_private.can_access(organization_id,id));
create policy network_transfer_scope on public.stock_transfers as restrictive for select to authenticated using(
 app_private.network_branch_allowed(organization_id,branch_id) and app_private.network_branch_allowed(organization_id,destination_branch_id));
-- sale_items/shift_authorizations have no branch_id of their own. Their original
-- policies reference the old function OIDs; explicitly use the scoped checks.
alter policy items_read on public.sale_items using(exists(select 1 from public.sales s where s.id=sale_id and app_private.can_checkout(s.organization_id,s.branch_id)));
alter policy authz_read on public.shift_authorizations using(exists(select 1 from public.cashier_shifts s where s.id=shift_id and app_private.can_access(s.organization_id,s.branch_id)));

create function app_private.mark_network_activation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.enabled and new.activated_at is null and app_private.network_enabled(new.organization_id) then
  new.activated_at:=transaction_timestamp();
 end if;
 -- BEFORE row visibility cannot see NEW.enabled; entitlement must still exist.
 if new.enabled and new.activated_at is null and exists(select 1 from app_private.branch_network_entitlements e where e.organization_id=new.organization_id and e.granted) then
  new.activated_at:=transaction_timestamp();
 end if;
 return new;
end $$;
create trigger network_activation before insert or update on app_private.branch_network_configuration for each row execute function app_private.mark_network_activation();
create function app_private.mark_entitled_network_activation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.granted then
  update app_private.branch_network_configuration set activated_at=transaction_timestamp()
  where organization_id=new.organization_id and enabled and activated_at is null;
 end if;
 return new;
end $$;
create trigger entitled_network_activation after insert or update of granted on app_private.branch_network_entitlements for each row execute function app_private.mark_entitled_network_activation();
revoke all on function app_private.mark_entitled_network_activation() from public,anon,authenticated;

create function app_private.branch_network(org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare enabled boolean:=app_private.network_enabled(org);managed boolean:=app_private.network_managed(org);hub uuid:=app_private.network_hub(org);
begin
 if not app_private.membership_access(org,null) then raise exception 'You do not have access to this branch' using errcode='42501';end if;
 return jsonb_build_object('enabled',case when managed then enabled else true end,'hubBranchId',case when app_private.can_access(org,hub) then hub else null end,
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'code',b.code,
  'canRequest',(not managed or enabled) and coalesce(n.can_request,not managed) and exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.branch_id=b.id and m.role in('manager','stock_staff')))),
  'canDispatch',(not managed or enabled) and coalesce(n.can_dispatch,not managed) and exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.branch_id=b.id and m.role='manager'))),
  'canReceive',(not managed or enabled) and coalesce(n.can_receive,not managed) and exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.branch_id=b.id and m.role in('manager','stock_staff'))))) order by b.code)
  from public.branches b left join app_private.branch_network_branches n on n.organization_id=org and n.branch_id=b.id
  where b.organization_id=org and b.active and app_private.can_access(org,b.id)),'[]'::jsonb));
end $$;

create function app_private.network_reconciliation_allowed(org uuid,branch uuid,transfer uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.membership_access(org,branch)
 and exists(select 1 from app_private.branch_network_configuration c where c.organization_id=org and c.activated_at is not null)
 and exists(select 1 from app_private.branch_network_branches b where b.organization_id=org and b.branch_id=branch and b.can_receive)
 and exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.branch_id=branch and m.role in('manager','stock_staff'))))
 and (transfer is null or exists(select 1 from public.stock_transfers t where t.organization_id=org and t.id=transfer and t.destination_branch_id=branch and t.state='in_transit'
 and exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=t.branch_id)
 and exists(select 1 from app_private.branch_network_configuration c where c.organization_id=org and t.dispatched_at>=c.activated_at)))
$$;

create function app_private.network_original_ack(action text,data jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;s public.sales;e public.stock_control_events;
begin
 if action in('record_sale','record_online_sale') and app_private.membership_checkout(org,branch) then
  select * into s from public.sales x where x.id=(data->>'transactionId')::uuid and x.organization_id=org and x.branch_id=branch and x.cashier_id=auth.uid() and x.payload=data;
  if found then return jsonb_build_object('transactionId',s.id,'status','duplicate','receipt',s.receipt,'flags',coalesce((select a.details->'flags' from public.audit_events a where a.organization_id=org and a.source_id=s.id and a.action='record_sale' order by a.id desc limit 1),to_jsonb(s.flags)));end if;
 elsif action in('receive_transfer','write_off_transfer') and app_private.membership_access(org,branch) then
  select * into e from public.stock_control_events x where x.id=(data->>'receiptId')::uuid and x.organization_id=org and x.branch_id=branch and x.actor_id=auth.uid() and x.action=action and x.payload=data;
  if found then return jsonb_build_object('id',e.id,'duplicate',true);end if;
 end if;
 return null;
end $$;

-- Central deny-before-read/write gate, shared by public RPC and direct current
-- dispatcher calls. Existing generic installs keep their established behavior.
create or replace function app_private.require_enabled_branch(action text,data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;destination uuid:=(data->>'destinationBranchId')::uuid;managed boolean:=app_private.network_managed(org);network_action boolean:=action like '%transfer%' or action in('request_stock','stock_requests','dispatch_stock','receive_branch_stock','return_branch_stock');
begin
 if not managed then return;end if;
 if not app_private.membership_access(org,null) then raise exception 'You do not have access to this branch' using errcode='42501';end if;
 if app_private.network_original_ack(action,data) is not null then return;end if;
 if action in('branch_network','network_obligations') then return;end if;
 if action in('create_branch','rename_branch') then raise exception 'Branch configuration is fixed. Contact your service provider.' using errcode='42501';end if;
 if action in('receive_transfer','write_off_transfer') and app_private.network_reconciliation_allowed(org,branch,(data->>'transferId')::uuid) then return;end if;
 if branch is null or not app_private.can_access(org,branch) then
  raise exception 'This branch is no longer enabled. Keep original recovery records and contact your service provider.' using errcode='42501';
 end if;
 if destination is not null and (not app_private.network_branch_allowed(org,destination) or destination=branch) then raise exception 'The destination branch is not enabled.' using errcode='42501';end if;
 if network_action then
  if not app_private.network_enabled(org) then raise exception 'Branch stock network is not enabled. Contact your service provider.' using errcode='42501';end if;
  if action='dispatch_transfer' and (not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=branch and n.can_dispatch)
    or not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=destination and n.can_receive)) then
   raise exception 'Transfer branch permission denied' using errcode='42501';end if;
  if action in('receive_transfer','write_off_transfer') and not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=branch and n.can_receive) then raise exception 'Transfer branch permission denied' using errcode='42501';end if;
 end if;
 if not app_private.network_enabled(org) and coalesce((data->>'allBranches')::boolean,false) then raise exception 'Only the configured branch is enabled for this report.' using errcode='42501';end if;
end $$;

create function app_private.network_dashboard(org uuid,branch uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare allowed uuid[];
begin
 if not app_private.can_checkout(org,branch) then
  raise exception 'Sales reports access denied' using errcode='42501';
 end if;
 select array_agg(b.id) into allowed from public.branches b
 where b.organization_id=org and b.active and app_private.can_checkout(org,b.id);

 -- Rebuild the complete read model before returning any privileged legacy
 -- aggregate. Every amount/count/list uses the same approved membership scope.
 return app_private.exact_dashboard(jsonb_build_object(
  'grossSales',(select coalesce(sum(s.total),0) from public.sales s where s.organization_id=org and s.branch_id=any(allowed)),
  'transactions',(select count(*) from public.sales s where s.organization_id=org and s.branch_id=any(allowed)),
  'refunds',(select -coalesce(sum(p.amount),0) from public.payments p where p.organization_id=org and p.branch_id=any(allowed) and p.amount<0
   and (p.credit_entry_id is null or exists(select 1 from public.credit_entries ce where ce.id=p.credit_entry_id and ce.kind='credit_note'))),
  'refundRecoveries',(select coalesce(sum(p.amount),0) from public.payments p where p.organization_id=org and p.branch_id=any(allowed) and p.refund_correction_id is not null),
  'netRefunds',(select -coalesce(sum(p.amount),0) from public.payments p where p.organization_id=org and p.branch_id=any(allowed)
   and ((p.amount<0 and (p.credit_entry_id is null or exists(select 1 from public.credit_entries ce where ce.id=p.credit_entry_id and ce.kind='credit_note'))) or p.refund_correction_id is not null)),
  'inTransit',(select count(*) from public.stock_transfers t where t.organization_id=org and t.state='in_transit'
   and app_private.network_branch_allowed(org,t.branch_id) and app_private.network_branch_allowed(org,t.destination_branch_id)
   and (t.branch_id=any(allowed) or t.destination_branch_id=any(allowed))),
  'pendingCounts',(select count(*) from app_private.blind_counts c where c.organization_id=org and c.branch_id=any(allowed) and c.state not in('approved','cancelled'))
   +(select count(*) from public.stock_counts c where c.organization_id=org and c.branch_id=any(allowed) and c.state='pending' and c.count_method='legacy'),
  'openStockExceptions',(select count(*) from public.stock_exceptions e where e.organization_id=org and e.branch_id=any(allowed) and e.state='open'),
  'branchTotals',coalesce((select jsonb_agg(jsonb_build_object(
   'branchId',b.id,
   'total',(select coalesce(sum(s.total),0) from public.sales s where s.organization_id=org and s.branch_id=b.id),
   'lastSync',(select max(d.last_sync) from public.devices d where d.organization_id=org and d.branch_id=b.id and d.active)) order by b.code)
   from public.branches b where b.organization_id=org and b.id=any(allowed)),'[]'::jsonb)
 ));
end $$;
revoke all on function app_private.network_dashboard(uuid,uuid) from public,anon,authenticated;

alter function app_private.command(text,jsonb) rename to command_before_branch_network;
revoke all on function app_private.command_before_branch_network(text,jsonb),app_private.command_before_catalog_photos(text,jsonb),app_private.command_before_test_history_archive(text,jsonb) from public,anon,authenticated;
create function app_private.command(action text,data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;ack jsonb;
begin
 perform app_private.require_enabled_branch(action,data);
 ack:=app_private.network_original_ack(action,data);if ack is not null then return ack;end if;
 if action='branch_network' then return app_private.branch_network(org);end if;
 if action='dashboard' and app_private.network_managed(org) then return app_private.network_dashboard(org,branch);end if;
 if action='network_obligations' then
  if not app_private.network_reconciliation_allowed(org,branch,null) then raise exception 'No activated network obligations are available to this branch' using errcode='42501';end if;
  return jsonb_build_object('transfers',coalesce((select jsonb_agg(to_jsonb(t)) from public.stock_transfers t where t.organization_id=org and t.destination_branch_id=branch and t.state='in_transit' and app_private.network_reconciliation_allowed(org,branch,t.id)),'[]'::jsonb));
 end if;
 return app_private.command_before_branch_network(action,data);
end $$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;

-- New helpers are private by default; only RLS/gateway predicates need client
-- execution. The schema is not part of the PostgREST exposed schemas.
revoke all on function app_private.network_managed(uuid),app_private.network_enabled(uuid),app_private.network_hub(uuid),app_private.network_branch_allowed(uuid,uuid),app_private.mark_network_activation(),app_private.branch_network(uuid),app_private.network_reconciliation_allowed(uuid,uuid,uuid),app_private.network_original_ack(text,jsonb) from public,anon,authenticated;
grant execute on function app_private.network_branch_allowed(uuid,uuid) to authenticated;

-- Separate the operational network mode from the branch-management lock.
-- Both public and legacy branch administration remain fixed for managed orgs.
do $administration$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.guard_branch_configuration()'::regprocedure);
 anchor:='  exists(select 1 from public.branches b where b.organization_id=case when TG_OP=''DELETE'' then old.organization_id else new.organization_id end and b.active and b.management_locked)';
 if strpos(src,anchor)=0 then raise exception 'Branch configuration guard changed';end if;
 execute replace(src,anchor,anchor||E'\n  or exists(select 1 from app_private.branch_network_configuration c where c.organization_id=case when TG_OP=''DELETE'' then OLD.organization_id else NEW.organization_id end)');
 src:=pg_get_functiondef('app_private.fixed_branch_dashboard(uuid,uuid)'::regprocedure);
 anchor:='and b.active and b.management_locked';
 if strpos(src,anchor)=0 then raise exception 'Fixed dashboard authorization changed';end if;
 execute replace(src,anchor,'and b.active and b.id=app_private.network_hub(org) and app_private.network_managed(org) and not app_private.network_enabled(org)');
end $administration$;
-- The guard trigger must inspect private configuration even when invoked by an
-- authenticated legacy branch command (which itself runs as the function owner).
alter function app_private.guard_branch_configuration() security definer;

create or replace function public.agri_command(action text,data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform app_private.require_enabled_branch(action,data);
 if action='update_product_metadata' then return app_private.update_product_metadata(data);end if;
 if action in('archive_product','restore_product','hidden_products') then return app_private.owner_product_visibility(action,data);end if;
 if action='sales_analytics' then return app_private.sales_analytics(data);end if;
 if action in('create_branch','rename_branch') then return app_private.branch_command(action,data);end if;
 result:=app_private.command(action,data);
 return result;
end $$;
