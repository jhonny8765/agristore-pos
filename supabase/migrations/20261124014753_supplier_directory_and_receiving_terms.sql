alter table public.suppliers add column archived_at timestamptz;

-- Supplier identity is shared by historical documents. An archive only stops
-- new purchasing under that supplier and leaves its existing references intact.
create function app_private.supplier_directory_command(action text, data jsonb)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  org uuid := (data->>'organizationId')::uuid;
  branch uuid := (data->>'branchId')::uuid;
  supplier_id uuid := (data->>'supplierId')::uuid;
  request_id uuid := nullif(data->>'requestId','')::uuid;
  actor uuid := auth.uid();
  actor_role text;
  supplier_row public.suppliers;
  prior public.stock_control_events;
  next_name text := btrim(data->>'name');
  next_contact text := btrim(coalesce(data->>'contact',''));
  event_action text := case action when 'update_supplier' then 'supplier_directory_update'
    when 'archive_supplier' then 'supplier_directory_archive' end;
  result jsonb;
  events jsonb;
begin
  if actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    or not exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid
      and s.user_id=actor and (s.not_after is null or s.not_after>now())) then
    raise exception 'Sign in again before managing suppliers' using errcode='42501';
  end if;
  select m.role into actor_role
  from public.staff_memberships m
  where m.organization_id=org and m.user_id=actor and m.active
    and (m.role='owner' or m.branch_id=branch)
  order by (m.role='owner') desc limit 1 for share;
  if actor_role is null or actor_role not in ('owner','manager','stock_staff')
    or not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch and b.active) then
    raise exception 'You do not have access to this branch' using errcode='42501';
  end if;

  if action='supplier_profile' then
    select * into supplier_row from public.suppliers s where s.organization_id=org and s.id=supplier_id;
    if supplier_row.id is null then raise exception 'Supplier not found'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'action', case e.action when 'supplier_directory_update' then 'update_supplier' else 'archive_supplier' end,
      'name', e.details->'result'->>'name',
      'contact', e.details->'result'->>'contact', 'at', e.created_at
    ) order by e.created_at desc,e.id desc),'[]'::jsonb)
    into events
    from (
      select a.id,a.action,a.details,a.created_at
      from public.stock_control_events request
      join public.audit_events a on a.source_id=request.id and a.action=request.action
        and a.organization_id=request.organization_id and a.branch_id=request.branch_id
      where request.organization_id=org and request.source_id=supplier_id
        and request.action in ('supplier_directory_update','supplier_directory_archive')
      order by a.created_at desc,a.id desc limit 50
    ) e;
    return jsonb_build_object('id',supplier_row.id,'name',supplier_row.name,
      'contact',coalesce(supplier_row.contact,''),'archivedAt',supplier_row.archived_at,'history',events);
  end if;

  if action not in ('update_supplier','archive_supplier') or actor_role not in ('owner','manager') then
    raise exception 'Only an owner or manager can update suppliers' using errcode='42501';
  end if;
  if action='archive_supplier' and actor_role<>'owner' then
    raise exception 'Only the owner can archive suppliers' using errcode='42501';
  end if;
  if request_id is null or supplier_id is null then raise exception 'Supplier and permanent request ID are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  select * into prior from public.stock_control_events e where e.id=request_id;
  if prior.id is not null then
    if prior.organization_id<>org or prior.branch_id<>branch or prior.actor_id<>actor
      or prior.action<>event_action or prior.source_id is distinct from supplier_id or prior.payload<>data then
      raise exception 'Supplier request ID conflict';
    end if;
    select a.details->'result' into result from public.audit_events a where a.organization_id=org
      and a.branch_id=branch and a.source_id=request_id and a.action=event_action
      order by a.id desc limit 1;
    if result is null then raise exception 'The original supplier result needs verification'; end if;
    return result || jsonb_build_object('duplicate',true);
  end if;

  select * into supplier_row from public.suppliers s where s.organization_id=org and s.id=supplier_id for update;
  if supplier_row.id is null then raise exception 'Supplier not found'; end if;
  if supplier_row.archived_at is not null then raise exception 'This supplier is already archived'; end if;
  if data->>'expectedName' is distinct from supplier_row.name or not (data ? 'expectedContact')
    or coalesce(data->>'expectedContact','') is distinct from coalesce(supplier_row.contact,'') then
    raise exception 'Supplier details changed. Refresh and try again.';
  end if;
  if action='update_supplier' then
    if next_name is null or length(next_name) not between 1 and 180 or length(next_contact)>1000 then
      raise exception 'Enter a supplier name up to 180 characters and contact details up to 1,000 characters';
    end if;
    update public.suppliers s set name=next_name,contact=nullif(next_contact,'')
      where s.organization_id=org and s.id=supplier_id returning * into supplier_row;
  else
    update public.suppliers s set archived_at=clock_timestamp()
      where s.organization_id=org and s.id=supplier_id returning * into supplier_row;
  end if;
  result:=jsonb_build_object('id',supplier_row.id,'name',supplier_row.name,
    'contact',coalesce(supplier_row.contact,''),'archivedAt',supplier_row.archived_at,'duplicate',false);
  insert into public.stock_control_events(id,organization_id,branch_id,action,source_id,actor_id,payload)
    values(request_id,org,branch,event_action,supplier_id,actor,data);
  insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details)
    values(org,branch,actor,event_action,request_id,jsonb_build_object('supplierId',supplier_id,'result',result));
  return result;
end
$function$;

-- A shared supplier lock serializes a new purchase with archiving that supplier.
create function app_private.require_active_purchase_supplier(org uuid, supplier_id uuid)
returns void
language plpgsql
set search_path to ''
as $function$
declare archived timestamptz;
begin
  select s.archived_at into archived from public.suppliers s
  where s.organization_id=org and s.id=supplier_id for share;
  if not found then raise exception 'Select a supplier from this business'; end if;
  if archived is not null then raise exception 'This supplier is archived. Select an active supplier.'; end if;
end
$function$;

create function app_private.valid_supplier_term(value text, minimum integer)
returns boolean
language sql immutable set search_path to ''
as $function$
  select case when value ~ '^(0|[1-9][0-9]{0,2})$' then value::integer between minimum and 365 else false end
$function$;

revoke execute on function app_private.supplier_directory_command(text,jsonb),
  app_private.require_active_purchase_supplier(uuid,uuid),
  app_private.valid_supplier_term(text,integer) from public,anon,authenticated;

-- Update the live function bodies at checked, narrow anchors. Preserve the
-- original role checks, immutable request replay, and evidence validation.
do $migration$
declare
  patch record;
  definition text;
  constraint_definition text;
  term_check constant text := '(term = ANY (ARRAY[0, 30, 60, 90]))';
begin
  select pg_get_constraintdef(c.oid) into strict constraint_definition
  from pg_catalog.pg_constraint c
  where c.conrelid='public.supplier_bills'::regclass and c.conname='supplier_bill_source_contract';
  if strpos(constraint_definition,term_check)=0 then raise exception 'Expected the current supplier bill term constraint'; end if;
  alter table public.supplier_bills drop constraint supplier_bill_source_contract;
  execute 'alter table public.supplier_bills add constraint supplier_bill_source_contract ' ||
    replace(constraint_definition,term_check,'(term between 0 and 365)');

  for patch in select * from (values
    ('app_private.command(text,jsonb)',
      $old$ perform app_private.require_enabled_branch(action,data);$old$,
      $new$ perform app_private.require_enabled_branch(action,data);
 if action in ('supplier_profile','update_supplier','archive_supplier') then
  return app_private.supplier_directory_command(action,data);
 end if;$new$),
    ('app_private.supplier_account_book(uuid,uuid,jsonb)',
      $old$term_n not in('all','0','30','60','90')$old$,
      $new$(term_n<>'all' and not app_private.valid_supplier_term(term_n,0))$new$),
    ('app_private.supplier_account_book(uuid,uuid,jsonb)',
      $old$jsonb_build_object('id',s.id,'name',s.name) order by s.name,s.id$old$,
      $new$jsonb_build_object('id',s.id,'name',s.name,'archivedAt',s.archived_at) order by s.name,s.id$new$),
    ('app_private.supplier_account_command(text,jsonb)',
      $old$if coalesce(data->>'term','') not in('0','30','60','90') then raise exception 'Choose due now or 30, 60 or 90 days';end if;$old$,
      $new$if not app_private.valid_supplier_term(data->>'term',0) then raise exception 'Choose due now or a supplier term from 1 to 365 days';end if;$new$),
    ('app_private.supplier_account_command(text,jsonb)',
      $old$  if exists(select 1 from public.supplier_bills b where b.organization_id=org and b.supplier_id=supplier and lower(btrim(b.reference))=lower(ref) and not exists(select 1 from public.supplier_bill_entries e where e.bill_id=b.id and e.kind='void')) then raise exception 'This supplier invoice is already recorded';end if;$old$,
      $new$  if receipt is null and (replaces is null or old_bill.supplier_id is distinct from supplier) then
   perform app_private.require_active_purchase_supplier(org,supplier);
  end if;
  if exists(select 1 from public.supplier_bills b where b.organization_id=org and b.supplier_id=supplier and lower(btrim(b.reference))=lower(ref) and not exists(select 1 from public.supplier_bill_entries e where e.bill_id=b.id and e.kind='void')) then raise exception 'This supplier invoice is already recorded';end if;$new$),
    ('app_private.supplier_purchase_command(text,jsonb)',
      $old$coalesce(invoice->>'term','') not in ('30','60','90')$old$,
      $new$not app_private.valid_supplier_term(invoice->>'term',1)$new$),
    ('app_private.command_before_delivery_reversals(text,jsonb)',
      $old$   if member.role='stock_staff' then raise exception 'Stock staff must inspect an owner-approved purchase order' using errcode='42501';end if;$old$,
      $new$   if member.role='stock_staff' then raise exception 'Stock staff must inspect an owner-approved purchase order' using errcode='42501';end if;
   if nullif(data->>'supplierId','') is not null then
    perform app_private.require_active_purchase_supplier(org,(data->>'supplierId')::uuid);
   end if;
   if jsonb_typeof(data->'items')='array' and exists(
    select 1 from jsonb_array_elements(data->'items') line
    where line->'unitCost' is not null and line->'unitCost'<>'null'::jsonb
      and not (case when jsonb_typeof(line->'unitCost')='number' and (line->>'unitCost') ~ '^[0-9]{1,16}$'
          then (line->>'unitCost')::numeric <= 9007199254740991 else false end)
   ) then raise exception 'Enter the unit cost as exact centavos';end if;$new$),
    ('app_private.command_before_delivery_reversals(text,jsonb)',
      $old$  if not exists(select 1 from public.suppliers s where s.id=supplier and s.organization_id=org) then raise exception 'Select a supplier from this business';end if;
  if length(coalesce(v_reference,'')) not between 3 and 200 then raise exception 'Enter an order reference of 3 to 200 characters';end if;$old$,
      $new$  perform app_private.require_active_purchase_supplier(org,supplier);
  if length(coalesce(v_reference,'')) not between 3 and 200 then raise exception 'Enter an order reference of 3 to 200 characters';end if;$new$),
    ('app_private.command_before_delivery_reversals(text,jsonb)',
      $old$   if not exists(select 1 from public.suppliers s where s.id=supplier and s.organization_id=org) then raise exception 'Select a supplier from this business';end if;
  end if;
  if length(coalesce(v_reference,'')) not between 3 and 200 then raise exception 'Enter a supplier document reference of 3 to 200 characters';end if;$old$,
      $new$   if nullif(data->>'correctsInspectionId','') is null then
    perform app_private.require_active_purchase_supplier(org,supplier);
   else
    if not exists(select 1 from app_private.delivery_inspections d where d.organization_id=org
      and d.branch_id=branch and d.supplier_id=supplier and d.id=(data->>'correctsInspectionId')::uuid) then
      raise exception 'The correction supplier must match the original inspection';
    end if;
   end if;
  end if;
  if length(coalesce(v_reference,'')) not between 3 and 200 then raise exception 'Enter a supplier document reference of 3 to 200 characters';end if;$new$)
  ) changes(routine,old_text,new_text)
  loop
    definition:=replace(pg_get_functiondef(patch.routine::regprocedure),chr(13)||chr(10),chr(10));
    if length(definition)-length(replace(definition,patch.old_text,''))<>length(patch.old_text) then
      raise exception 'Expected one matching supplier migration anchor in %', patch.routine;
    end if;
    execute replace(definition,patch.old_text,patch.new_text);
  end loop;
end
$migration$;
