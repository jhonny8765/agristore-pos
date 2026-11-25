-- Owner resolutions preserve the original actor/payload separately from the real
-- authenticated owner. A no-payment resolution has no journal event at all.
create table app_private.drawer_expense_resolutions(
 id uuid primary key,organization_id uuid not null,branch_id uuid not null,
 original_id uuid,original_action text,original_actor_id uuid references auth.users(id),original_data jsonb,
 resolved_by uuid not null references auth.users(id),session_id uuid not null,
 resolution text not null check(resolution in('posted','no_payment')),event_id uuid references app_private.drawer_expense_events(id) deferrable initially deferred,
 payload jsonb not null,result jsonb not null,original_result jsonb,created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,original_id),foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 check((original_id is null and original_action is null and original_actor_id is null and original_data is null and original_result is null) or
 (original_id is not null and original_action is not null and original_actor_id is not null and original_data is not null and original_result is not null))
);
alter table app_private.drawer_expense_resolutions enable row level security;
revoke all on app_private.drawer_expense_resolutions from public,anon,authenticated;
create trigger immutable_expense_resolution before update or delete on app_private.drawer_expense_resolutions for each row execute function app_private.immutable();

alter function app_private.financial_original_ack(text,jsonb) rename to financial_original_ack_before_expense_resolutions;
create function app_private.financial_original_ack(action text,data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare answer jsonb;
begin
 if action in('record_drawer_expense','correct_drawer_expense','return_drawer_expense_cash','reconcile_drawer_expense') then
  if not app_private.membership_access((data->>'organizationId')::uuid,(data->>'branchId')::uuid)
  or not exists(select 1 from public.staff_memberships m where m.organization_id=(data->>'organizationId')::uuid and m.user_id=auth.uid() and m.active and (m.role='owner' or(m.role='cashier' and m.branch_id=(data->>'branchId')::uuid))) then return null;end if;
  select r.original_result||'{"duplicate":true}'::jsonb into answer from app_private.drawer_expense_resolutions r where r.organization_id=(data->>'organizationId')::uuid and r.branch_id=(data->>'branchId')::uuid and r.original_id=(data->>'requestId')::uuid and r.original_action=action and r.original_actor_id=auth.uid() and r.original_data=data;
  if answer is not null then return answer;end if;
  if action='reconcile_drawer_expense' then
   select r.result||'{"duplicate":true}'::jsonb into answer from app_private.drawer_expense_resolutions r where r.id=(data->>'requestId')::uuid and r.organization_id=(data->>'organizationId')::uuid and r.branch_id=(data->>'branchId')::uuid and r.resolved_by=auth.uid() and r.payload=data;
   if answer is not null then return answer;end if;
  end if;
 end if;
 return app_private.financial_original_ack_before_expense_resolutions(action,data);
end$$;
revoke all on function app_private.financial_original_ack_before_expense_resolutions(text,jsonb),app_private.financial_original_ack(text,jsonb) from public,anon,authenticated;

create function app_private.expense_amount(value jsonb) returns bigint language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(value) is distinct from 'number' or value::text!~'^[0-9]+$' or value::numeric not between 1 and 2147483647 then raise exception 'Enter a positive exact centavo amount';end if;return value::text::bigint;
end$$;
create function app_private.expense_metadata(data jsonb) returns jsonb language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(data->'category') is distinct from 'string' or data->>'category' not in('transport','fuel','meals','supplies','utilities','repairs','miscellaneous')
 or jsonb_typeof(data->'purpose') is distinct from 'string' or length(btrim(data->>'purpose')) not between 3 and 500
 or jsonb_typeof(data->'payee') is distinct from 'string' or length(btrim(data->>'payee')) not between 1 and 200
 or jsonb_typeof(data->'reference') is distinct from 'string' or length(btrim(data->>'reference'))>200 then raise exception 'Enter valid drawer expense details';end if;
 return jsonb_build_object('category',data->>'category','purpose',btrim(data->>'purpose'),'payee',btrim(data->>'payee'),'reference',btrim(data->>'reference'));
end$$;
revoke all on function app_private.expense_amount(jsonb),app_private.expense_metadata(jsonb) from public,anon,authenticated;

alter function app_private.drawer_expense_command(text,jsonb) rename to drawer_expense_command_before_owner;
create function app_private.drawer_expense_command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;ident uuid:=(data->>'requestId')::uuid;
 root app_private.drawer_expense_events;original_journal app_private.branch_original_acknowledgments;prior_resolution app_private.drawer_expense_resolutions;
 sh public.cashier_shifts;current_sh public.cashier_shifts;original_actor uuid;original_id uuid;original_action text;original_data jsonb;
 answer jsonb;original_answer jsonb;meta jsonb;recon jsonb:='{}';amount bigint:=0;delta bigint:=0;adjustment bigint:=0;actual_total bigint;returned bigint;
 outcome text;committed jsonb;committed_resolution app_private.drawer_expense_resolutions;original_closed_at timestamptz;
 at_time timestamptz:=clock_timestamp();recorded_time timestamptz:=clock_timestamp();num text;kind text;expense uuid;event_ident uuid;resolution text;late boolean:=false;
begin
 if action='record_drawer_expense' then return app_private.drawer_expense_command_before_owner(action,data);end if;
 if action not in('correct_drawer_expense','return_drawer_expense_cash','reconcile_drawer_expense') then raise exception 'Unknown drawer expense action';end if;
 if org is null or branch is null or ident is null or not app_private.membership_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner') then raise exception 'Only an active owner can reconcile drawer expenses' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':financial-original:'||ident::text,0));
 if exists(select 1 from app_private.branch_original_acknowledgments j where j.organization_id=org and j.original_id=ident) then
  answer:=app_private.exact_original_action_ack(action,data);if answer is null then raise exception 'The original expense identity or payload does not match' using errcode='42501';end if;return answer;
 end if;
 perform app_private.require_enabled_branch(action,data);
 if jsonb_typeof(data->'reason') is distinct from 'string' or length(btrim(data->>'reason')) not between 3 and 500 then raise exception 'Give a reason of 3 to 500 characters';end if;
 if action='reconcile_drawer_expense' then
  if jsonb_typeof(data->'actualPaid') is distinct from 'boolean' or jsonb_typeof(data->'payerEvidence') is distinct from 'string' or length(btrim(data->>'payerEvidence')) not between 3 and 500
  or jsonb_typeof(data->'reference') is distinct from 'string' or length(btrim(data->>'reference')) not between 1 and 200 then raise exception 'Payment evidence, reference and payment decision are required';end if;
  original_action:=data->>'originalAction';original_data:=data->'originalData';original_actor:=(data->>'originalActorId')::uuid;
  if data ?| array['originalAction','originalData','originalActorId'] then
   if original_action is null or original_actor is null or jsonb_typeof(original_data) is distinct from 'object' or original_action not in('record_drawer_expense','return_drawer_expense_cash','correct_drawer_expense','reconcile_drawer_expense') then raise exception 'An exact supported original identity is required' using errcode='42501';end if;
   original_id:=(original_data->>'requestId')::uuid;
   if original_id is null or original_id=ident or original_data->>'organizationId' is distinct from org::text or original_data->>'branchId' is distinct from branch::text
   or (original_action in('correct_drawer_expense','reconcile_drawer_expense') and (data->>'actualPaid')::boolean)
   or (original_action='reconcile_drawer_expense' and (original_data->'originalData'->>'requestId') in(ident::text,original_id::text)) then raise exception 'The original identity or payment decision does not match' using errcode='42501';end if;
   -- Never execute or lock an original nested inside a rejected reconciliation.
   if not pg_try_advisory_xact_lock(hashtextextended(org::text||':financial-original:'||original_id::text,0)) then raise exception 'The original is being processed; preserve it and retry reconciliation' using errcode='40001';end if;
   select * into prior_resolution from app_private.drawer_expense_resolutions r where r.organization_id=org and r.original_id=original_id;
   if found then raise exception 'This original already has an immutable resolution' using errcode='42501';end if;
   select * into original_journal from app_private.branch_original_acknowledgments j where j.organization_id=org and j.original_id=original_id;
   if found and (original_journal.action<>original_action or original_journal.actor_id<>original_actor or original_journal.payload<>original_data) then raise exception 'The exact original action, actor and payload must match' using errcode='42501';end if;
  elsif not (data->>'actualPaid')::boolean then raise exception 'No-payment resolution requires an exact original' using errcode='42501';end if;
  select s.* into sh from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.id=(data->>'originalShiftId')::uuid and s.device_id=(data->>'originalDeviceId')::uuid;
  if sh.id is null then raise exception 'Select the actual original drawer' using errcode='42501';end if;
  if original_id is not null and (data->>'actualPaid')::boolean and original_action in('record_drawer_expense','return_drawer_expense_cash','correct_drawer_expense') and (original_data->>'shiftId' is distinct from sh.id::text or original_data->>'deviceId' is distinct from sh.device_id::text
   or (original_action='record_drawer_expense' and original_actor<>sh.cashier_id)) then raise exception 'The original actor and drawer identity must match' using errcode='42501';end if;
  if original_id is not null and not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=original_actor and (m.role='owner' or(m.role='cashier' and original_action='record_drawer_expense' and m.branch_id=branch))) then raise exception 'Original actor is not eligible for this action' using errcode='42501';end if;
  if original_action='return_drawer_expense_cash' and original_journal.original_id is null and (data->>'actualPaid')::boolean then
   select * into root from app_private.drawer_expense_events e where e.id=(original_data->>'expenseId')::uuid and e.organization_id=org and e.branch_id=branch and e.id=e.expense_id;
   if root.id is null then raise exception 'Select the original expense' using errcode='42501';end if;
  end if;
  perform 1 from public.cashier_shifts s where s.organization_id=org and s.id in(sh.id,root.shift_id) order by s.id for update;
  select s.* into sh from public.cashier_shifts s where s.id=sh.id;
  -- A committed exact result always wins over a proposed never-paid outcome.
  if original_journal.original_id is not null then
   -- A confirmation id is not necessarily a physical event id. In particular,
   -- a committed no-payment or link-only reconciliation owns no new event.
   if original_journal.action='reconcile_drawer_expense' then
    select r.* into committed_resolution from app_private.drawer_expense_resolutions r where r.id=original_journal.original_id and r.organization_id=org and r.branch_id=branch and r.resolved_by=original_actor and r.payload=original_data;
    if committed_resolution.id is null then raise exception 'The committed reconciliation proof is missing' using errcode='42501';end if;
    event_ident:=committed_resolution.event_id;resolution:=committed_resolution.resolution;
   else
    select e.id into event_ident from app_private.drawer_expense_events e where e.id=original_journal.original_id and e.organization_id=org and e.branch_id=branch and e.actor_id=original_actor and e.action=original_action and e.payload=original_data;
    if event_ident is null then raise exception 'The committed event proof is missing' using errcode='42501';end if;
    resolution:='posted';
   end if;
   expense:=(original_journal.result->>'expenseId')::uuid;
   amount:=coalesce((original_journal.result->>'amount')::bigint,0);original_answer:=original_journal.result;
   outcome:='committed_original';
   committed:=jsonb_build_object('action',original_action,'data',original_data,'actorId',original_actor,'result',original_answer,'eventId',event_ident);
   kind:='resolution';meta:='{}';
  elsif not (data->>'actualPaid')::boolean then
   resolution:='no_payment';outcome:='no_payment';kind:='resolution';meta:='{}';expense:=null;
  else
   if jsonb_typeof(data->'occurredAt') is distinct from 'string' or data->>'occurredAt'!~'T.*(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Give the actual payment time with timezone';end if;
   at_time:=(data->>'occurredAt')::timestamptz;
   if at_time<sh.opened_at or at_time>recorded_time or (sh.closed_at is not null and at_time>sh.closed_at) then raise exception 'Actual payment time must be within the original shift and not in the future';end if;
   if original_action='record_drawer_expense' then
    perform app_private.expense_amount(original_data->'amount');perform app_private.expense_metadata(original_data);
    if original_data->'confirmedPaid' is distinct from 'true'::jsonb then raise exception 'Malformed rejected originals can only resolve as not applied';end if;
   elsif original_action='return_drawer_expense_cash' then
    perform app_private.expense_amount(original_data->'amount');
    if original_actor<>sh.cashier_id then raise exception 'The original return drawer belongs to another actor' using errcode='42501';end if;
   end if;
   late:=sh.closed_at is not null;amount:=app_private.expense_amount(data->'amount');meta:=app_private.expense_metadata(data);kind:='expense';expense:=ident;event_ident:=ident;
   if original_action='return_drawer_expense_cash' then
    select * into root from app_private.drawer_expense_events e where e.id=(original_data->>'expenseId')::uuid and e.organization_id=org and e.branch_id=branch and e.id=e.expense_id;
    if root.id is null then raise exception 'Select the original expense' using errcode='42501';end if;
    -- Re-lock both drawer rows in order; initial lock above is safe for expense
    -- reconciliation. Returns need the root lock before any drawer lock below.
    kind:='return';expense:=root.id;
   end if;
   outcome:=case when kind='return' then 'new_return' else 'new_expense' end;original_closed_at:=case when late then sh.closed_at else null end;
   resolution:='posted';delta:=case when late then 0 when kind='return' then amount else -amount end;
   recon:=jsonb_build_object('late',late,'physicalCashDelta',case when kind='return' then amount else -amount end,'payerEvidence',data->>'payerEvidence','originalAction',original_action,'originalData',original_data,'originalActorId',original_actor);
  end if;
 else
  select * into root from app_private.drawer_expense_events e where e.id=(data->>'expenseId')::uuid and e.organization_id=org and e.branch_id=branch and e.id=e.expense_id;
  if root.id is null then raise exception 'Select the original expense' using errcode='42501';end if;
  select * into sh from public.cashier_shifts s where s.id=root.shift_id;
 end if;
 -- One deterministic drawer-lock order also serializes every return/correction
 -- against the original drawer, including returns into different owner drawers.
 if root.id is not null then
  perform 1 from public.cashier_shifts s where s.organization_id=org and s.id in(root.shift_id,sh.id,case when action='return_drawer_expense_cash' then (data->>'shiftId')::uuid else null end) order by s.id for update;
  perform 1 from app_private.drawer_expense_events e where e.id=root.id for update;
  select s.* into sh from public.cashier_shifts s where s.id=sh.id;
  select root.amount+coalesce(sum(e.report_adjustment) filter(where e.kind in('amount','report')),0),coalesce(sum(e.amount) filter(where e.kind='return'),0) into actual_total,returned from app_private.drawer_expense_events e where e.organization_id=org and e.expense_id=root.id;
  if action='return_drawer_expense_cash' or (action='reconcile_drawer_expense' and kind='return') then
   if action='return_drawer_expense_cash' then
    amount:=app_private.expense_amount(data->'amount');
    select s.* into current_sh from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.id=(data->>'shiftId')::uuid and s.device_id=(data->>'deviceId')::uuid and s.cashier_id=auth.uid() and s.closed_at is null;
    if current_sh.id is null or not exists(select 1 from public.shift_authorizations a where a.shift_id=current_sh.id and now() between a.issued_at and a.expires_at) or not exists(select 1 from public.devices d where d.id=current_sh.device_id and d.active) then raise exception 'Open or renew your own current authorized drawer' using errcode='42501';end if;
    sh:=current_sh;kind:='return';expense:=root.id;event_ident:=ident;delta:=amount;meta:=root.metadata;
   end if;
   if amount>actual_total-returned then raise exception 'Amount exceeds remaining returnable expense';end if;
  elsif action='correct_drawer_expense' then
   if data->>'mode' not in('metadata','amount','report') or data->>'mode' is null then raise exception 'Choose metadata, actual amount or closed reporting correction';end if;
   if data->>'shiftId' is distinct from sh.id::text or data->>'deviceId' is distinct from sh.device_id::text then raise exception 'Correction must identify the original drawer' using errcode='42501';end if;
   kind:=data->>'mode';expense:=root.id;event_ident:=ident;meta:=root.metadata;
   if kind='metadata' then meta:=app_private.expense_metadata(data);
   else
    -- Only a verified recording/report total can be zero. Physical cash remains positive.
    if jsonb_typeof(data->'amount') is distinct from 'number' or (data->'amount')::text!~'^[0-9]+$' or (data->>'amount')::numeric not between 0 and 2147483647 then raise exception 'Enter a nonnegative exact centavo total';end if;
    amount:=(data->>'amount')::bigint;adjustment:=amount-actual_total;
    if amount<returned then raise exception 'Amount exceeds remaining returnable expense';end if;
    if kind='amount' then
     if sh.closed_at is not null or not exists(select 1 from public.shift_authorizations a where a.shift_id=sh.id and now() between a.issued_at and a.expires_at) then raise exception 'Actual amount correction requires the same open authorized shift' using errcode='42501';end if;delta:=-adjustment;
    else
     if sh.closed_at is null then raise exception 'Use actual amount correction while the original shift is open';end if;
     at_time:=root.occurred_at;
    end if;
   end if;
  end if;
 end if;
 num:='EXP-'||nextval('app_private.drawer_expense_number');
 answer:=jsonb_build_object('id',ident,'expenseId',expense,'organizationId',org,'branchId',branch,'shiftId',sh.id,'deviceId',sh.device_id,'actorId',auth.uid(),'action',action,'kind',kind,'amount',amount,'cashDelta',delta,'reportAdjustment',adjustment::text,'number',num,'occurredAt',at_time,'recordedAt',recorded_time,'businessDate',(at_time at time zone 'Asia/Manila')::date,'duplicate',false);
 if action='reconcile_drawer_expense' then
  answer:=answer||jsonb_build_object('resolution',resolution,'resolutionId',ident,'resolvedBy',auth.uid(),'originalAction',original_action,'originalData',original_data,'originalActorId',original_actor,'originalRequestId',original_id,'outcome',outcome,'eventId',event_ident,'originalClosedAt',original_closed_at,'committedOriginal',committed);
  if original_id is not null then
   if original_answer is null then
    original_answer:=answer||jsonb_build_object('id',original_id,'actorId',original_actor,'action',original_action,'kind','resolution','duplicate',true,'shiftId',coalesce(original_data->>'shiftId',original_data->>'originalShiftId'),'deviceId',coalesce(original_data->>'deviceId',original_data->>'originalDeviceId'),'resolutionData',data,'resolutionAcknowledgement',answer);
   end if;
   insert into app_private.branch_original_acknowledgments(organization_id,branch_id,original_id,action,actor_id,payload,result) values(org,branch,original_id,original_action,original_actor,original_data,original_answer) on conflict do nothing;
  end if;
  insert into app_private.drawer_expense_resolutions(id,organization_id,branch_id,original_id,original_action,original_actor_id,original_data,resolved_by,session_id,resolution,event_id,payload,result,original_result) values(ident,org,branch,original_id,original_action,original_actor,original_data,auth.uid(),(auth.jwt()->>'session_id')::uuid,resolution,event_ident,data,answer,original_answer);
 end if;
 if event_ident=ident then
  insert into app_private.drawer_expense_events(id,expense_id,organization_id,branch_id,shift_id,device_id,actor_id,session_id,action,kind,amount,cash_delta,report_adjustment,number,occurred_at,recorded_at,business_date,metadata,reason,reconciliation,payload,result)
  values(ident,expense,org,branch,sh.id,sh.device_id,auth.uid(),(auth.jwt()->>'session_id')::uuid,action,kind,amount,delta,adjustment,num,at_time,recorded_time,(at_time at time zone 'Asia/Manila')::date,meta,btrim(data->>'reason'),recon,data,answer);
 end if;
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,auth.uid(),action,ident,answer||jsonb_build_object('reason',btrim(data->>'reason'),'closingRestatement',app_private.drawer_closing_restatement(org,sh.id)));
 return answer;
end$$;
revoke all on function app_private.drawer_expense_command(text,jsonb),app_private.drawer_expense_command_before_owner(text,jsonb) from public,anon,authenticated;

-- Physical evidence discovered after close and verified reporting corrections
-- explain the historical discrepancy; original stored values remain untouched.
create or replace function app_private.drawer_closing_restatement(org uuid,shift uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sh public.cashier_shifts;restated bigint;
begin
 select s.* into sh from public.cashier_shifts s where s.organization_id=$1 and s.id=$2;
 if sh.id is null or sh.closed_at is null then return null;end if;
 restated:=app_private.drawer_cash_balance(org,shift)+coalesce((select sum((e.reconciliation->>'physicalCashDelta')::bigint) from app_private.drawer_expense_events e where e.organization_id=org and e.shift_id=shift and e.reconciliation->>'late'='true'),0)-coalesce((select sum(e.report_adjustment) from app_private.drawer_expense_events e where e.organization_id=org and e.shift_id=shift and e.kind='report'),0);
 return jsonb_build_object('shiftId',sh.id,'closedAt',sh.closed_at,'originalExpectedCash',sh.expected_cash,'countedCash',sh.counted_cash,'originalDifference',sh.counted_cash-sh.expected_cash,'restatedExpectedCash',restated,'restatedDifference',sh.counted_cash-restated);
end$$;
revoke all on function app_private.drawer_closing_restatement(uuid,uuid) from public,anon,authenticated;

-- Paged annotations share the cutoff. The content fence below also detects late commits.
create function app_private.drawer_closing_restatement_at(org uuid,shift uuid,asof timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sh public.cashier_shifts;restated bigint;
begin
 select s.* into sh from public.cashier_shifts s where s.organization_id=$1 and s.id=$2;
 if sh.id is null or sh.closed_at is null or sh.closed_at>asof then return null;end if;
 select sh.opening_cash+coalesce((select sum(p.amount) from public.payments p where p.organization_id=org and p.shift_id=shift and p.created_at<=asof),0)+coalesce(sum(e.cash_delta),0)+coalesce(sum((e.reconciliation->>'physicalCashDelta')::bigint) filter(where e.reconciliation->>'late'='true'),0)-coalesce(sum(e.report_adjustment) filter(where e.kind='report'),0) into restated from app_private.drawer_expense_events e where e.organization_id=org and e.shift_id=shift and e.recorded_at<=asof;
 return jsonb_build_object('shiftId',sh.id,'closedAt',sh.closed_at,'originalExpectedCash',sh.expected_cash,'countedCash',sh.counted_cash,'originalDifference',sh.counted_cash-sh.expected_cash,'restatedExpectedCash',restated,'restatedDifference',sh.counted_cash-restated);
end$$;
revoke all on function app_private.drawer_closing_restatement_at(uuid,uuid,timestamptz) from public,anon,authenticated;

-- Clone the owning analytics query with an explicit private snapshot parameter.
-- The public analytics contract stays unchanged; subsequent expense pages reuse
-- the first page cutoff rather than merging independent report snapshots.
do $snapshot$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.sales_analytics(jsonb)'::regprocedure);
 src:=replace(src,'FUNCTION app_private.sales_analytics(data jsonb)','FUNCTION app_private.drawer_expense_sales_analytics(data jsonb, snapshot timestamptz)');
 anchor:='v_asof timestamptz:=statement_timestamp();';
 if(length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review expense analytics snapshot owner';end if;
 execute replace(src,anchor,'v_asof timestamptz:=snapshot;');
end $snapshot$;
revoke all on function app_private.drawer_expense_sales_analytics(jsonb,timestamptz) from public,anon,authenticated;

-- Original: timely physical events, including signed open amount amendments.
-- Restated: also late physical events on their actual day, and noncash report
-- amendments on the root expense day. Returns belong to the day actually received.
create function app_private.drawer_expense_records(data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;owner_access boolean;v_from date;v_to date;v_view text:=data->>'view';asof timestamptz:=statement_timestamp();page_size integer:=coalesce((data->>'limit')::integer,100);answer jsonb;sales jsonb;context jsonb;fence text;cursor jsonb:=data->'cursor';export_all boolean:=coalesce((data->>'export')::boolean,false);
begin
 owner_access:=exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner');
 if org is null or branch is null or not app_private.membership_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or(m.role='cashier' and m.branch_id=branch))) then raise exception 'Drawer records access denied' using errcode='42501';end if;
 if coalesce(data->>'fromDate','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(data->>'throughDate','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v_view not in('original','restated') or v_view is null or page_size not between 1 and 200 then raise exception 'Choose valid expense dates, view and page size';end if;
 v_from:=(data->>'fromDate')::date;v_to:=(data->>'throughDate')::date;
 if v_to<v_from or v_to-v_from>365 or v_to>(asof at time zone 'Asia/Manila')::date then raise exception 'Choose an ordered range of at most 366 days, without future dates';end if;
 context:=jsonb_build_object('organizationId',org,'branchId',branch,'fromDate',v_from,'throughDate',v_to,'view',v_view,'shiftId',data->>'shiftId','actorId',auth.uid(),'scope',case when owner_access then 'branch' else 'cashier' end);
 if cursor is not null and cursor<>'null'::jsonb then
  if export_all or jsonb_typeof(cursor)<>'object' or cursor->'context' is distinct from context or cursor->>'id' is null or cursor->>'occurredAt' is null or cursor->>'asOf' is null or coalesce(cursor->>'snapshotFence','')!~'^[0-9a-f]{32}$' then raise exception 'Invalid expense records cursor';end if;
  asof:=(cursor->>'asOf')::timestamptz;
  if asof>statement_timestamp() or (cursor->>'occurredAt')::timestamptz>asof then raise exception 'Invalid expense records snapshot';end if;
 end if;
 if export_all then page_size:=10000;end if;
 with scoped as materialized(
  select e.*,r.number root_number,s.cashier_id root_cashier,r.shift_id root_shift,r.device_id root_device from app_private.drawer_expense_events e join app_private.drawer_expense_events r on r.id=e.expense_id join public.cashier_shifts s on s.id=r.shift_id
  where e.organization_id=org and e.branch_id=branch and e.business_date between v_from and v_to and e.recorded_at<=asof and e.occurred_at<=asof
  and(owner_access or s.cashier_id=auth.uid()) and(data->>'shiftId' is null or e.shift_id=(data->>'shiftId')::uuid)
  and(v_view='restated' or(e.kind<>'report' and coalesce(e.reconciliation->>'late','false')<>'true'))
 ),rendered as materialized(select e.*,jsonb_build_object('id',id,'expenseId',expense_id,'organizationId',organization_id,'branchId',branch_id,'shiftId',shift_id,'deviceId',device_id,'actorId',actor_id,'rootCashierId',root_cashier,'action',action,'kind',kind,'amount',amount,'cashDelta',cash_delta,'reportAdjustment',report_adjustment::text,'number',number,'rootNumber',root_number,'occurredAt',occurred_at,'recordedAt',recorded_at,'businessDate',business_date,'metadata',metadata,'reason',reason,'late',coalesce((reconciliation->>'late')::boolean,false),'closingRestatement',app_private.drawer_closing_restatement_at(org,shift_id,asof),'rootContext',jsonb_build_object('expenseId',expense_id,'shiftId',root_shift,'deviceId',root_device,'closingRestatement',app_private.drawer_closing_restatement_at(org,root_shift,asof))) record from scoped e),
 page as(select * from rendered e where data->'cursor' is null or data->'cursor'='null'::jsonb or(e.occurred_at,e.id)>((data->'cursor'->>'occurredAt')::timestamptz,(data->'cursor'->>'id')::uuid) order by e.occurred_at,e.id limit page_size+1),
 rows as(select * from page order by occurred_at,id limit page_size),
 totals as(select coalesce(sum(case when kind='expense' then amount when kind='amount' then report_adjustment else 0 end),0) gross,coalesce(sum(amount) filter(where kind='return'),0) returns,coalesce(sum(report_adjustment) filter(where kind='report'),0) noncash from scoped)
 select jsonb_build_object('version',1,'organizationId',org,'branchId',branch,'exportComplete',export_all,'shiftId',data->>'shiftId','fromDate',v_from,'throughDate',v_to,'view',v_view,'scope',case when owner_access then 'branch' else 'cashier' end,'actorId',auth.uid(),'asOf',asof,
 'snapshotFence',(select md5(coalesce(string_agg(md5(record::text),'' order by occurred_at,id),'')) from rendered),
 'records',coalesce((select jsonb_agg(record order by occurred_at,id) from rows),'[]'),
 'nextCursor',case when(select count(*) from page)>page_size then(select jsonb_build_object('occurredAt',occurred_at,'id',id,'asOf',asof,'context',context) from rows order by occurred_at desc,id desc limit 1) else null end,
 'totals',jsonb_build_object('grossExpenses',gross::text,'cashReturns',returns::text,'nonCashCorrections',noncash::text,'netExpenses',(gross-returns+noncash)::text)) into answer from totals;
 if export_all and answer->'nextCursor'<>'null'::jsonb then raise exception 'Expense export exceeds 10,000 records; narrow the dates';end if;
 -- A shift-filtered report is not a whole-branch sales period. No mixed scope.
 if owner_access and data->>'shiftId' is null then
  sales:=app_private.drawer_expense_sales_analytics(jsonb_build_object('organizationId',org,'branchId',branch,'period','custom','interval','day','fromDate',v_from,'throughDate',v_to),asof);
  answer:=answer||jsonb_build_object('salesAnalytics',sales,'salesAfterExpenses',((sales->'totals'->>'netCash')::numeric-(answer->'totals'->>'netExpenses')::numeric)::text);
 else answer:=answer||'{"salesAnalytics":null,"salesAfterExpenses":null}'::jsonb;end if;
 -- STABLE reads one MVCC statement snapshot. A cutoff alone cannot fence a late
 -- commit with an earlier timestamp: hash ALL matched row content/annotations,
 -- totals and same-snapshot sales output, independent of the consumed page.
 fence:=md5(jsonb_build_object('context',context,'asOf',asof,'expenses',answer->>'snapshotFence','totals',answer->'totals','sales',answer->'salesAnalytics','salesAfterExpenses',answer->'salesAfterExpenses')::text);
 if cursor is not null and cursor<>'null'::jsonb and cursor->>'snapshotFence' is distinct from fence then raise exception 'Expense report changed since it was checked. Refresh expense records to start a fresh report.';end if;
 answer:=answer||jsonb_build_object('snapshotFence',fence);
 if answer->'nextCursor'<>'null'::jsonb then answer:=jsonb_set(answer,'{nextCursor,snapshotFence}',to_jsonb(fence));end if;
 return answer;
end$$;
revoke all on function app_private.drawer_expense_records(jsonb) from public,anon,authenticated;

do $route$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 anchor:='if action=''record_drawer_expense'' then';
 if(length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review expense owner action dispatcher';end if;
 src:=replace(src,anchor,'if action in(''record_drawer_expense'',''correct_drawer_expense'',''return_drawer_expense_cash'',''reconcile_drawer_expense'') then');
 anchor:='elsif action=''drawer_expense_summary'' then';
 if(length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review expense report dispatcher';end if;
 execute replace(src,anchor,'elsif action=''drawer_expense_records'' then answer:=app_private.drawer_expense_records(data);'||anchor);
end $route$;
-- Correcting a mistaken amount is not a physical return. The outflow is the
-- verified actual expense total; returned cash is solely separate return events.
do $summary$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.drawer_expense_summary(jsonb)'::regprocedure);
 anchor:='and e.cash_delta<0';
 if(length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review corrected drawer expense outflow summary';end if;
 src:=replace(src,anchor,'and e.kind<>''return''');
 anchor:='and e.cash_delta>0';
 if(length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review actual drawer cash return summary';end if;
 execute replace(src,anchor,'and e.kind=''return''');
end $summary$;
