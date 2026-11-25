-- Immediate paid-cash evidence; historical expenses intentionally start empty.
create sequence app_private.drawer_expense_number;
revoke all on sequence app_private.drawer_expense_number from public,anon,authenticated;
create table app_private.drawer_expense_events(
 id uuid primary key,expense_id uuid not null references app_private.drawer_expense_events(id) deferrable initially deferred,
 organization_id uuid not null,branch_id uuid not null,shift_id uuid not null,device_id uuid not null,
 actor_id uuid not null references auth.users(id),session_id uuid not null,
 action text not null,kind text not null,amount bigint not null check(amount between 0 and 2147483647),
 cash_delta bigint not null,report_adjustment bigint not null default 0,
 number text not null,occurred_at timestamptz not null,recorded_at timestamptz not null,
 business_date date not null,metadata jsonb not null,reason text,reconciliation jsonb not null default '{}',
 payload jsonb not null,result jsonb not null,
 unique(organization_id,number),foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,shift_id) references public.cashier_shifts(organization_id,id),
 foreign key(organization_id,device_id) references public.devices(organization_id,id)
);
create index drawer_expense_shift on app_private.drawer_expense_events(organization_id,shift_id);
create index drawer_expense_day on app_private.drawer_expense_events(organization_id,branch_id,business_date,id);
alter table app_private.drawer_expense_events enable row level security;
revoke all on app_private.drawer_expense_events from public,anon,authenticated;
create trigger immutable_drawer_expense before update or delete on app_private.drawer_expense_events for each row execute function app_private.immutable();

-- All eligible drawer cash lives in payments today (including debt collections,
-- refund corrections and negative refunds); supplier payments have no rows here.
-- Future expense returns/corrections append signed deltas in the private journal.
create function app_private.drawer_cash_balance(org uuid,shift uuid) returns bigint
language sql stable security definer set search_path='' as $$
 select s.opening_cash+coalesce((select sum(p.amount) from public.payments p where p.organization_id=$1 and p.shift_id=$2),0)
 +coalesce((select sum(e.cash_delta) from app_private.drawer_expense_events e where e.organization_id=$1 and e.shift_id=$2),0)
 from public.cashier_shifts s where s.organization_id=$1 and s.id=$2
$$;
revoke all on function app_private.drawer_cash_balance(uuid,uuid) from public,anon,authenticated;

-- Extend exact immutable registry identities. Existing action contracts unchanged.
alter function app_private.financial_original_id(text,jsonb) rename to financial_original_id_before_expenses;
create function app_private.financial_original_id(action text,data jsonb) returns uuid language plpgsql immutable set search_path='' as $$begin
 if action in('record_drawer_expense','correct_drawer_expense','return_drawer_expense_cash','reconcile_drawer_expense') then return (data->>'requestId')::uuid;end if;
 return app_private.financial_original_id_before_expenses(action,data);
end$$;
alter function app_private.financial_original_ack(text,jsonb) rename to financial_original_ack_before_expenses;
create function app_private.financial_original_ack(action text,data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
begin
 if action in('record_drawer_expense','correct_drawer_expense','return_drawer_expense_cash','reconcile_drawer_expense') then
  if not app_private.membership_access((data->>'organizationId')::uuid,(data->>'branchId')::uuid)
  or not exists(select 1 from public.staff_memberships m where m.organization_id=(data->>'organizationId')::uuid and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.role='cashier' and m.branch_id=(data->>'branchId')::uuid))) then return null;end if;
  return (select e.result||'{"duplicate":true}'::jsonb from app_private.drawer_expense_events e
   where e.id=app_private.financial_original_id(action,data) and e.action=action and e.organization_id=(data->>'organizationId')::uuid and e.branch_id=(data->>'branchId')::uuid and e.actor_id=auth.uid() and e.payload=data);
 end if;
 return app_private.financial_original_ack_before_expenses(action,data);
end$$;
revoke all on function app_private.financial_original_id(text,jsonb),app_private.financial_original_id_before_expenses(text,jsonb),app_private.financial_original_ack(text,jsonb),app_private.financial_original_ack_before_expenses(text,jsonb) from public,anon,authenticated;

create function app_private.drawer_expense_command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;ident uuid:=(data->>'requestId')::uuid;
 sh public.cashier_shifts;answer jsonb;amount bigint;at_time timestamptz;num text;balance bigint;
begin
 if action<>'record_drawer_expense' then raise exception 'Unknown drawer expense action';end if;
 if not app_private.membership_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.role='cashier' and m.branch_id=branch))) then raise exception 'Only a signed-in owner or cashier can record drawer expenses' using errcode='42501';end if;
 -- Lock order is shared with the exact registry and Task2 owner reconciliation:
 -- 1 org:financial-original:requestId seed0 advisory, 2 original shift row FOR UPDATE.
 -- Never lock a current/return drawer before its original request lock.
 perform pg_advisory_xact_lock(hashtextextended(org::text||':financial-original:'||ident::text,0));
 if exists(select 1 from app_private.branch_original_acknowledgments j where j.organization_id=org and j.original_id=ident) then
  answer:=app_private.exact_original_action_ack(action,data);
  if answer is null then raise exception 'The original expense identity or payload does not match' using errcode='42501';end if;return answer;
 end if;
 perform app_private.require_enabled_branch(action,data);
 if org is null or branch is null or ident is null or data->>'deviceId' is null or data->>'shiftId' is null then raise exception 'Your own current drawer is required' using errcode='42501';end if;
 select s.* into sh from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.id=(data->>'shiftId')::uuid and s.device_id=(data->>'deviceId')::uuid and s.cashier_id=auth.uid() and s.closed_at is null for update;
 if sh.id is null or not exists(select 1 from public.devices d where d.id=sh.device_id and d.organization_id=org and d.branch_id=branch and d.active)
 or not exists(select 1 from public.shift_authorizations a where a.shift_id=sh.id and now() between a.issued_at and a.expires_at) then raise exception 'Open or renew your own current authorized drawer' using errcode='42501';end if;
 if jsonb_typeof(data->'amount') is distinct from 'number' or coalesce(data->>'amount','') !~ '^[0-9]+$' then raise exception 'Enter valid drawer expense details';end if;
 if (data->>'amount')::numeric not between 1 and 2147483647
 or coalesce(data->>'category','') not in('transport','fuel','meals','supplies','utilities','repairs','miscellaneous')
 or jsonb_typeof(data->'purpose') is distinct from 'string' or length(btrim(coalesce(data->>'purpose',''))) not between 3 and 500
 or jsonb_typeof(data->'payee') is distinct from 'string' or length(btrim(coalesce(data->>'payee',''))) not between 1 and 200
 or jsonb_typeof(data->'reference') is distinct from 'string' or length(btrim(coalesce(data->>'reference',''))) >200
 or data->'confirmedPaid' is distinct from 'true'::jsonb then raise exception 'Enter valid drawer expense details';end if;
 amount:=(data->>'amount')::bigint;at_time:=clock_timestamp();num:='EXP-'||nextval('app_private.drawer_expense_number');
 balance:=app_private.drawer_cash_balance(org,sh.id)-amount;
 answer:=jsonb_build_object('id',ident,'expenseId',ident,'organizationId',org,'branchId',branch,'shiftId',sh.id,'deviceId',sh.device_id,'actorId',auth.uid(),'action',action,'kind','expense','amount',amount,'cashDelta',-amount,'number',num,'occurredAt',at_time,'recordedAt',at_time,'businessDate',(at_time at time zone 'Asia/Manila')::date,'duplicate',false,'negativeBalance',balance<0,'warning',case when balance<0 then 'Recorded cash already paid. Drawer balance is negative; ask the owner to reconcile the discrepancy.' else null end);
 insert into app_private.drawer_expense_events(id,expense_id,organization_id,branch_id,shift_id,device_id,actor_id,session_id,action,kind,amount,cash_delta,number,occurred_at,recorded_at,business_date,metadata,payload,result)
 values(ident,ident,org,branch,sh.id,sh.device_id,auth.uid(),(auth.jwt()->>'session_id')::uuid,action,'expense',amount,-amount,num,at_time,at_time,(at_time at time zone 'Asia/Manila')::date,jsonb_build_object('category',data->>'category','purpose',btrim(data->>'purpose'),'payee',btrim(data->>'payee'),'reference',btrim(data->>'reference')),data,answer);
 return answer;
end$$;
revoke all on function app_private.drawer_expense_command(text,jsonb) from public,anon,authenticated;

-- Closed cash counts stay historical. Recovered sale/payment/stock evidence is
-- accepted normally; this separately named comparison exposes current knowledge.
create function app_private.drawer_closing_restatement(org uuid,shift uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sh public.cashier_shifts;restated bigint;
begin
 select s.* into sh from public.cashier_shifts s where s.organization_id=$1 and s.id=$2;
 if sh.id is null or sh.closed_at is null then return null;end if;
 restated:=app_private.drawer_cash_balance(org,shift);
 return jsonb_build_object('shiftId',sh.id,'closedAt',sh.closed_at,'originalExpectedCash',sh.expected_cash,'countedCash',sh.counted_cash,'originalDifference',sh.counted_cash-sh.expected_cash,'restatedExpectedCash',restated,'restatedDifference',sh.counted_cash-restated);
end$$;
revoke all on function app_private.drawer_closing_restatement(uuid,uuid) from public,anon,authenticated;

create function app_private.drawer_expense_summary(data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;sh public.cashier_shifts;balance bigint;
begin
 if not app_private.membership_access(org,branch) or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.role='cashier' and m.branch_id=branch))) then raise exception 'Drawer records access denied' using errcode='42501';end if;
 select s.* into sh from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.id=(data->>'shiftId')::uuid and (s.cashier_id=auth.uid() or exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner'));
 if sh.id is null then raise exception 'Select a permitted drawer' using errcode='42501';end if;
 balance:=case when sh.closed_at is not null then sh.expected_cash else app_private.drawer_cash_balance(org,sh.id) end;
 return jsonb_build_object('shiftId',sh.id,'openingCash',sh.opening_cash,'paymentCash',coalesce((select sum(p.amount) from public.payments p where p.organization_id=org and p.shift_id=sh.id),0),'expenseCashOut',coalesce((select -sum(e.cash_delta) from app_private.drawer_expense_events e where e.organization_id=org and e.shift_id=sh.id and e.cash_delta<0),0),'expenseCashReturned',coalesce((select sum(e.cash_delta) from app_private.drawer_expense_events e where e.organization_id=org and e.shift_id=sh.id and e.cash_delta>0),0),'expectedCash',balance,'negativeBalance',balance<0,'closingRestatement',app_private.drawer_closing_restatement(org,sh.id));
end$$;
revoke all on function app_private.drawer_expense_summary(jsonb) from public,anon,authenticated;

-- Patch only the three actual owners. Exact anchor/count checks fail migration
-- safely if upstream dispatcher definitions drift; no legacy file is rewritten.
do $cash$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.command_legacy(text,jsonb)'::regprocedure);
 anchor:='select sh.opening_cash+coalesce(sum(public.payments.amount),0) into drawer_expected from public.payments where shift_id=sh.id;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review close-shift cash owner';end if;
 src:=replace(src,anchor,'select app_private.drawer_cash_balance(org,sh.id) into drawer_expected;');
 anchor:='if sh.closed_at is not null then update public.cashier_shifts s set expected_cash=s.opening_cash+(select coalesce(sum(p.amount),0) from public.payments p where p.shift_id=sh.id) where s.id=sh.id; end if;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review recovered-sale historical close owner';end if;
 src:=replace(src,anchor,'-- Preserve original closed expected/count/difference; audit separate restatement below.');
 anchor:='jsonb_build_object(''reason'',recovery_reason,''original_cashier'',uid)';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review recovered-sale restatement audit';end if;
 src:=replace(src,anchor,'jsonb_build_object(''reason'',recovery_reason,''original_cashier'',uid,''shiftId'',sh.id,''closingRestatement'',app_private.drawer_closing_restatement(org,sh.id))');
 anchor:='  update public.cashier_shifts s set closed_at=now(),counted_cash=(data->>''countedCash'')::bigint,expected_cash=s.opening_cash+(select coalesce(sum(p.amount),0) from public.payments p where p.shift_id=s.id) where s.device_id=dev.id and s.closed_at is null;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review device-retirement cash owner';end if;
 src:=replace(src,anchor,'  perform 1 from public.cashier_shifts s where s.device_id=dev.id and s.closed_at is null for update;'||E'\n'||replace(anchor,'s.opening_cash+(select coalesce(sum(p.amount),0) from public.payments p where p.shift_id=s.id)','app_private.drawer_cash_balance(org,s.id)'));
 execute src;
 src:=pg_get_functiondef('app_private.command_before_refund_corrections(text,jsonb)'::regprocedure);
 anchor:='select sh.opening_cash+coalesce(sum(p.amount),0) into v_cash from public.payments p where p.organization_id=org and p.branch_id=branch and p.shift_id=sh.id;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review partial/full cash-refund owner';end if;
 execute replace(src,anchor,'select app_private.drawer_cash_balance(org,sh.id) into v_cash;');
 src:=pg_get_functiondef('app_private.credit_command(text,jsonb)'::regprocedure);
 anchor:='select sh.opening_cash+coalesce(sum(p.amount),0) into paid from public.payments p where p.organization_id=org and p.shift_id=sh.id;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>2 then raise exception 'Review credit reversal and refund cash owners';end if;
 execute replace(src,anchor,'select app_private.drawer_cash_balance(org,sh.id) into paid;');
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 anchor:='answer:=app_private.command_before_original_action_journal(action,data);';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review exact original expense dispatcher';end if;
 execute replace(src,anchor,'if action=''record_drawer_expense'' then answer:=app_private.drawer_expense_command(action,data);elsif action=''drawer_expense_summary'' then answer:=app_private.drawer_expense_summary(data);else '||anchor||'end if;');
end $cash$;
