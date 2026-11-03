-- Multiple drawers share server-confirmed stock. Single-PC branches retain their
-- existing offline outbox. Activation requires a closed branch, never a reset.
alter table public.branches add column multi_pc boolean not null default false;
-- Keep the fixed Magpet identity immutable; PC mode is a separate owner command.
create or replace function app_private.guard_branch_configuration() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and (to_jsonb(new)-'multi_pc')=(to_jsonb(old)-'multi_pc') then return new;end if;
 if auth.uid() is not null and (
  exists(select 1 from public.branches b where b.organization_id=case when TG_OP='DELETE' then old.organization_id else new.organization_id end and b.active and b.management_locked)
  or (TG_OP='UPDATE' and old.management_locked)
 ) then raise exception 'Branch configuration is fixed. Contact your service provider.' using errcode='42501';end if;
 if TG_OP='DELETE' then return old;end if;return new;
end$$;
drop index public.one_active_device_per_branch;
create function app_private.guard_cashier_pc() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text||new.branch_id::text,1));
 if new.active and not (select b.multi_pc from public.branches b where b.organization_id=new.organization_id and b.id=new.branch_id)
 and exists(select 1 from public.devices d where d.organization_id=new.organization_id and d.branch_id=new.branch_id and d.active and d.id<>new.id) then
  raise exception 'A cashier PC is already registered for this branch' using errcode='23505',constraint='one_active_device_per_branch';
 end if;
 return new;
end$$;
revoke all on function app_private.guard_cashier_pc() from public,anon,authenticated;
create trigger cashier_pc_policy before insert or update of active,branch_id,organization_id on public.devices for each row execute function app_private.guard_cashier_pc();

alter function app_private.command(text,jsonb) rename to command_before_multiple_pcs;
revoke all on function app_private.command_before_multiple_pcs(text,jsonb) from public,anon,authenticated;
create function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;uid uuid:=auth.uid();enabled boolean;result jsonb;row_item jsonb;available numeric;sh public.cashier_shifts;
begin
 if action not in ('configure_cashier_pcs','record_online_sale','record_sale','register_device','open_shift','renew_shift') then return app_private.command_before_multiple_pcs(action,data);end if;
 if not app_private.can_access(org,branch) then raise exception 'Sign in with access to this branch' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||coalesce(branch::text,''),1));
 select b.multi_pc into enabled from public.branches b where b.organization_id=org and b.id=branch and b.active;
 if enabled is null then raise exception 'Select an active branch';end if;
 if action='configure_cashier_pcs' then
  if not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=uid and m.active and m.role='owner') then raise exception 'Only the owner can change cashier PC mode' using errcode='42501';end if;
  if jsonb_typeof(data->'enabled') is distinct from 'boolean' or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000 then raise exception 'Confirm the PC mode and enter a reason';end if;
  if enabled=(data->>'enabled')::boolean then return jsonb_build_object('multiPc',enabled);end if;
  if exists(select 1 from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.closed_at is null) then raise exception 'Close and synchronize every branch shift before changing cashier PC mode';end if;
  if not (data->>'enabled')::boolean and (select count(*) from public.devices d where d.organization_id=org and d.branch_id=branch and d.active)>1 then raise exception 'Retire extra cashier PCs before returning to single-PC mode';end if;
  update public.branches b set multi_pc=(data->>'enabled')::boolean where b.organization_id=org and b.id=branch;
  insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,branch,jsonb_build_object('multiPc',(data->>'enabled')::boolean,'reason',btrim(data->>'reason')));
  return jsonb_build_object('multiPc',(data->>'enabled')::boolean);
 elsif action='record_sale' and enabled then
  -- Preserve an original acknowledged retry; never accept a new offline sale.
  if exists(select 1 from public.sales s where s.id=(data->>'transactionId')::uuid and s.organization_id=org and s.branch_id=branch and s.cashier_id=uid and s.payload=data) then return app_private.command_before_multiple_pcs(action,data);end if;
  raise exception 'Multiple-PC checkout requires online confirmation. Update this app and retry the original request; do not re-enter an uncertain sale';
 elsif action='record_online_sale' then
  if not enabled then raise exception 'This branch uses the single-PC cash checkout';end if;
  if not app_private.can_checkout(org,branch) then raise exception 'Sales access denied' using errcode='42501';end if;
  if exists(select 1 from public.sales s where s.id=(data->>'transactionId')::uuid) then
   result:=app_private.command_before_multiple_pcs('record_sale',data);
  else
   select * into sh from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.id=(data->>'shiftId')::uuid and s.device_id=(data->>'deviceId')::uuid and s.cashier_id=uid and s.closed_at is null for update;
   if sh.id is null or not exists(select 1 from public.shift_authorizations a where a.shift_id=sh.id and now() between a.issued_at and a.expires_at) then raise exception 'Open or renew your own authorized shift online';end if;
   if jsonb_typeof(data->'items') is distinct from 'array' or jsonb_array_length(data->'items') not between 1 and 100 then raise exception 'Add between 1 and 100 valid product lines';end if;
   for row_item in select jsonb_build_object('product',x->>'productId','batch',x->>'batchId','quantity',sum((x->>'quantity')::numeric*(x->>'factor')::numeric)) from jsonb_array_elements(data->'items') x group by x->>'productId',x->>'batchId' order by x->>'productId',x->>'batchId' loop
    select i.quantity into available from public.branch_inventory i where i.organization_id=org and i.branch_id=branch and i.product_id=(row_item->>'product')::uuid and i.batch_id is not distinct from (row_item->>'batch')::uuid for update;
    if coalesce(available,0)<(row_item->>'quantity')::numeric then raise exception 'Not enough confirmed saleable stock. Refresh and review this basket; no sale was recorded';end if;
   end loop;
   result:=app_private.command_before_multiple_pcs('record_sale',data);
   if (result->'flags') ?| array['price_changed','product_inactive','stock_shortage'] then raise exception 'Stock or catalog changed. Refresh and review this basket; no sale was recorded';end if;
  end if;
  if result->>'status' not in ('created','duplicate') then raise exception 'The original sale reference contains different details. Preserve the record and ask the owner to review';end if;
  return result;
 end if;
 if enabled and action in ('open_shift','renew_shift') and data->>'pcProtocol' is distinct from '1' then raise exception 'Update this POS app before opening a multiple-PC shift. Saved records must be preserved';end if;
 result:=app_private.command_before_multiple_pcs(action,data);
 if action in ('open_shift','renew_shift') then result:=result||jsonb_build_object('onlineOnly',enabled);end if;
 return result;
end$$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;
