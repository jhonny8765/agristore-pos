-- Supplier accounts payable are separate from customer receivables, stock and tills.
-- Only the owner records verified invoices and payments already made externally.
create unique index supplier_receipt_scope on public.purchase_receipts(organization_id,id);
create table public.supplier_bills(
 id uuid primary key,organization_id uuid not null,branch_id uuid not null,supplier_id uuid not null,
 supplier_name text not null,reference text not null check(length(reference) between 1 and 150),
 issued_on date not null,term integer not null check(term in(0,30,60,90)),due_on date not null,
 amount bigint not null check(amount between 1 and 9007199254740991),description text not null check(length(description) between 3 and 2000),
 receipt_id uuid,replaces_id uuid references public.supplier_bills(id),created_by uuid not null references auth.users,created_at timestamptz not null default now(),
 unique(organization_id,id),foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,supplier_id) references public.suppliers(organization_id,id),
 foreign key(organization_id,receipt_id) references public.purchase_receipts(organization_id,id),check(due_on=issued_on+term)
);
create unique index supplier_bill_replaced_once on public.supplier_bills(replaces_id) where replaces_id is not null;
create index supplier_bill_scope on public.supplier_bills(organization_id,branch_id,supplier_id,due_on,id);
create table public.supplier_bill_entries(
 id uuid primary key,organization_id uuid not null,branch_id uuid not null,bill_id uuid not null,
 kind text not null check(kind in('invoice','payment','payment_reversal','credit_note','credit_reversal','void')),
 amount bigint not null check(amount between 0 and 9007199254740991),method text check(method in('bank','owner_cash','cheque')),
 happened_on date not null,reference text not null check(length(reference) between 1 and 200),reason text not null check(length(reason) between 3 and 2000),
 reverses uuid references public.supplier_bill_entries(id),created_by uuid not null references auth.users,created_at timestamptz not null default now(),
 foreign key(organization_id,bill_id) references public.supplier_bills(organization_id,id),foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 check((kind in('payment','payment_reversal') and method is not null) or (kind not in('payment','payment_reversal') and method is null)),
 check((kind in('payment_reversal','credit_reversal'))=(reverses is not null)),check((kind='void' and amount=0) or (kind<>'void' and amount>0))
);
create unique index supplier_entry_reversed_once on public.supplier_bill_entries(reverses) where reverses is not null;
create unique index supplier_bill_voided_once on public.supplier_bill_entries(bill_id) where kind='void';
create index supplier_entry_history on public.supplier_bill_entries(organization_id,bill_id,created_at,id);
do $$declare t text;begin foreach t in array array['supplier_bills','supplier_bill_entries'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('create policy command_only on public.%I as restrictive for all to authenticated using(false) with check(false)',t);
 execute format('create trigger immutable_history before update or delete on public.%I for each row execute function app_private.immutable()',t);
end loop;end$$;
create function app_private.can_supplier_accounts(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from auth.sessions s where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>now()))
 and exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner')
$$;
revoke all on function app_private.can_supplier_accounts(uuid) from public,anon;
grant execute on function app_private.can_supplier_accounts(uuid) to authenticated;
create policy supplier_event_access on public.stock_control_events as restrictive for select to authenticated using(action not like 'supplier\_%' escape '\' or app_private.can_supplier_accounts(organization_id));
create policy supplier_audit_access on public.audit_events as restrictive for select to authenticated using(action not like 'supplier\_%' escape '\' or app_private.can_supplier_accounts(organization_id));

create function app_private.supplier_bill_state(org uuid,bill uuid) returns jsonb language sql stable set search_path='' as $$
 with totals as(select coalesce(sum(case when kind='payment' then amount when kind='payment_reversal' then -amount else 0 end),0) paid,
 coalesce(sum(case when kind='credit_note' then amount when kind='credit_reversal' then -amount else 0 end),0) credited,
 coalesce(bool_or(kind='void'),false) voided,count(*) version from public.supplier_bill_entries where organization_id=org and bill_id=bill)
 select jsonb_build_object('id',b.id,'supplierId',b.supplier_id,'supplierName',b.supplier_name,'reference',b.reference,'issuedOn',b.issued_on,'term',b.term,'dueOn',b.due_on,
 'amount',b.amount,'paid',t.paid,'credited',t.credited,'balance',case when t.voided then 0 else b.amount-t.paid-t.credited end,'voided',t.voided,'version',t.version,
 'description',b.description,'receiptId',b.receipt_id,'replacesId',b.replaces_id,'recordedAt',b.created_at)
 from public.supplier_bills b cross join totals t where b.organization_id=org and b.id=bill
$$;
revoke all on function app_private.supplier_bill_state(uuid,uuid) from public,anon,authenticated;

create function app_private.supplier_account_book(org uuid,branch uuid,data jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare supplier uuid:=(data->>'supplierId')::uuid;offset_n integer:=coalesce((data->>'offset')::integer,0);q text:=btrim(coalesce(data->>'query',''));status text:=coalesce(data->>'status','all');term_n text:=coalesce(data->>'term','all');today date:=(now() at time zone 'Asia/Manila')::date;result jsonb;
begin
 if offset_n<0 or offset_n>1000000 or length(q)>180 or status not in('all','unpaid','partial','paid','overdue','dueSoon','voided') or term_n not in('all','0','30','60','90') then raise exception 'Invalid supplier account filter';end if;
 with scope as materialized(select app_private.supplier_bill_state(org,b.id) doc from public.supplier_bills b where b.organization_id=org and b.branch_id=branch and (supplier is null or b.supplier_id=supplier)),
 filtered as materialized(select doc from scope where (q='' or position(lower(q) in lower((doc->>'reference')||' '||(doc->>'supplierName')||' '||(doc->>'description')))>0)
 and (term_n='all' or doc->>'term'=term_n) and (status='all' or case status when 'voided' then (doc->>'voided')::boolean when 'paid' then not (doc->>'voided')::boolean and (doc->>'balance')::bigint=0
 when 'unpaid' then not (doc->>'voided')::boolean and (doc->>'balance')::bigint>0 and (doc->>'paid')::bigint=0
 when 'partial' then not (doc->>'voided')::boolean and (doc->>'balance')::bigint>0 and (doc->>'paid')::bigint>0
 when 'overdue' then (doc->>'balance')::bigint>0 and (doc->>'dueOn')::date<today
 when 'dueSoon' then (doc->>'balance')::bigint>0 and (doc->>'dueOn')::date between today and today+7 else false end)),
 page as(select doc from filtered order by ((doc->>'balance')::bigint>0) desc,(doc->>'dueOn')::date,(doc->>'recordedAt')::timestamptz desc,doc->>'id' limit 50 offset offset_n)
 select jsonb_build_object('asOf',statement_timestamp(),'suppliers',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name,s.id) from public.suppliers s where s.organization_id=org),'[]'),
 'invoices',coalesce((select jsonb_agg(doc order by ((doc->>'balance')::bigint>0) desc,(doc->>'dueOn')::date,(doc->>'recordedAt')::timestamptz desc,doc->>'id') from page),'[]'),
 'matchingTotal',(select count(*) from filtered),'next',case when (select count(*) from filtered)>offset_n+50 then offset_n+50 else null end,
 'receipts',coalesce((select jsonb_agg(to_jsonb(r)) from(select p.id,p.reference,p.supplier_id as "supplierId" from public.purchase_receipts p where p.organization_id=org and p.branch_id=branch and p.source='purchase' order by p.created_at desc,p.id desc limit 100) r),'[]'),
 'outstanding',coalesce((select sum((doc->>'balance')::bigint) from scope),0)::text,'overdue',coalesce((select sum((doc->>'balance')::bigint) from scope where (doc->>'dueOn')::date<today),0)::text,
 'dueSoon',coalesce((select sum((doc->>'balance')::bigint) from scope where (doc->>'dueOn')::date between today and today+7),0)::text,
 'paidCount',(select count(*) from scope where not (doc->>'voided')::boolean and (doc->>'balance')::bigint=0)) into result;
 return result;
end$$;
revoke all on function app_private.supplier_account_book(uuid,uuid,jsonb) from public,anon,authenticated;

create function app_private.supplier_account_command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;uid uuid:=auth.uid();ident uuid;bill public.supplier_bills;prior public.stock_control_events;original public.supplier_bill_entries;old_bill public.supplier_bills;
 state jsonb;amount bigint;term_n integer;issued date;happened date;today date:=(now() at time zone 'Asia/Manila')::date;supplier uuid;receipt uuid;replaces uuid;ref text;reason text;method text;entry_kind text;off integer;result jsonb;
begin
 if not app_private.can_supplier_accounts(org) or not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch and b.active) then raise exception 'Only the signed-in owner can manage supplier accounts' using errcode='42501';end if;
 if action='supplier_account_book' then return app_private.supplier_account_book(org,branch,data);end if;
 if action='supplier_invoice_history' then
  select * into bill from public.supplier_bills b where b.id=(data->>'billId')::uuid and b.organization_id=org and b.branch_id=branch;
  if bill.id is null then raise exception 'Supplier invoice not found in this branch';end if;
  off:=coalesce((data->>'offset')::integer,0);if off<0 or off>1000000 then raise exception 'Invalid supplier history page';end if;
  select jsonb_build_object('invoice',app_private.supplier_bill_state(org,bill.id),'entries',coalesce((select jsonb_agg(row order by at desc,id desc) from(
   select e.id,e.kind,e.amount,e.method,e.happened_on as "paidOn",e.reference,e.reason,e.created_at as at,e.reverses,
   (select r.id from public.supplier_bill_entries r where r.reverses=e.id) as "reversedBy",(select m.name from public.staff_memberships m where m.organization_id=org and m.user_id=e.created_by and m.role='owner' order by m.id limit 1) as "actorName"
   from public.supplier_bill_entries e
   where e.organization_id=org and e.bill_id=bill.id order by e.created_at desc,e.id desc limit 50 offset off) row),'[]'),
   'next',case when (select count(*) from public.supplier_bill_entries e where e.organization_id=org and e.bill_id=bill.id)>off+50 then off+50 else null end,
   'receipt',case when bill.receipt_id is null then null else(select jsonb_build_object('id',r.id,'reference',r.reference,'recordedAt',r.created_at,'items',r.payload->'items') from public.purchase_receipts r where r.organization_id=org and r.id=bill.receipt_id) end) into result;return result;
 end if;
 if action not in('supplier_record_invoice','supplier_record_payment','supplier_credit_note','supplier_reverse_entry','supplier_void_invoice') then raise exception 'Unknown supplier account action';end if;
 ident:=(data->>'requestId')::uuid;if ident is null then raise exception 'A permanent supplier request ID is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':supplier-request:'||ident::text,0));
 select * into prior from public.stock_control_events e where e.id=ident;
 if prior.id is not null then
  if prior.organization_id<>org or prior.branch_id<>branch or prior.actor_id<>uid or prior.action<>action or prior.payload<>data then raise exception 'Supplier request ID conflict';end if;
  return jsonb_build_object('id',ident,'billId',prior.source_id,'duplicate',true);
 end if;
 reason:=btrim(data->>'reason');ref:=btrim(data->>'reference');
 if reason is null or length(reason) not between 3 and 2000 or ref is null or length(ref) not between 1 and 200 then raise exception 'Enter the document reference and a clear payment or invoice note';end if;
 if (data->>'confirmed')::boolean is distinct from true then raise exception 'Confirm the original supplier document or completed external payment';end if;
 if action='supplier_record_invoice' then
  if jsonb_typeof(data->'amount') is distinct from 'number' or (data->>'amount')!~'^\d{1,16}$' or (data->>'amount')::numeric not between 1 and 9007199254740991 then raise exception 'Enter a positive invoice amount in exact centavos';end if;
  amount:=(data->>'amount')::bigint;
  if coalesce(data->>'term','') not in('0','30','60','90') then raise exception 'Choose due now or 30, 60 or 90 days';end if;term_n:=(data->>'term')::integer;
  if coalesce(data->>'issuedOn','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Enter the supplier invoice date';end if;issued:=(data->>'issuedOn')::date;
  if issued>today or (data->>'expectedDueOn')::date is distinct from issued+term_n then raise exception 'Check the supplier invoice date and agreed due date';end if;
  if length(ref)>150 then raise exception 'Supplier invoice reference is too long';end if;
  supplier:=(data->>'supplierId')::uuid;receipt:=(data->>'receiptId')::uuid;replaces:=(data->>'replacesId')::uuid;
  if not exists(select 1 from public.suppliers s where s.organization_id=org and s.id=supplier) then raise exception 'Select a supplier in this business';end if;
  if receipt is not null and not exists(select 1 from public.purchase_receipts r where r.id=receipt and r.organization_id=org and r.branch_id=branch and r.source='purchase' and r.supplier_id=supplier) then raise exception 'Delivery must belong to this supplier and branch';end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text||':supplier-invoice:'||supplier::text||':'||lower(ref),0));
  if receipt is not null then perform pg_advisory_xact_lock(hashtextextended(org::text||':supplier-receipt:'||receipt::text,0));end if;
  if replaces is not null then
   select * into old_bill from public.supplier_bills b where b.id=replaces and b.organization_id=org and b.branch_id=branch for update;
   if old_bill.id is null or not exists(select 1 from public.supplier_bill_entries e where e.bill_id=replaces and e.kind='void') or exists(select 1 from public.supplier_bills b where b.replaces_id=replaces) then raise exception 'Only a voided invoice without a replacement can be replaced';end if;
  end if;
  if exists(select 1 from public.supplier_bills b where b.organization_id=org and b.supplier_id=supplier and lower(btrim(b.reference))=lower(ref) and not exists(select 1 from public.supplier_bill_entries e where e.bill_id=b.id and e.kind='void')) then raise exception 'This supplier invoice is already recorded';end if;
  if exists(select 1 from public.supplier_bills b where b.organization_id=org and b.supplier_id=supplier and lower(btrim(b.reference))=lower(ref)) and replaces is null then raise exception 'Use Replace voided invoice to preserve the original history';end if;
  if receipt is not null and exists(select 1 from public.supplier_bills b where b.organization_id=org and b.receipt_id=receipt and not exists(select 1 from public.supplier_bill_entries e where e.bill_id=b.id and e.kind='void')) then raise exception 'This delivery is already linked to a supplier invoice';end if;
  insert into public.supplier_bills(id,organization_id,branch_id,supplier_id,supplier_name,reference,issued_on,term,due_on,amount,description,receipt_id,replaces_id,created_by)
  select ident,org,branch,supplier,s.name,ref,issued,term_n,issued+term_n,amount,reason,receipt,replaces,uid from public.suppliers s where s.id=supplier;
  insert into public.supplier_bill_entries(id,organization_id,branch_id,bill_id,kind,amount,happened_on,reference,reason,created_by) values(ident,org,branch,ident,'invoice',amount,issued,ref,reason,uid);
  bill.id:=ident;
 else
  select * into bill from public.supplier_bills b where b.id=(data->>'billId')::uuid and b.organization_id=org and b.branch_id=branch for update;
  if bill.id is null then raise exception 'Supplier invoice not found in this branch';end if;
  state:=app_private.supplier_bill_state(org,bill.id);
  if (state->>'voided')::boolean then raise exception 'This supplier invoice was voided';end if;
  if (data->>'expectedVersion')::bigint is distinct from (state->>'version')::bigint or (data->>'expectedBalance')::bigint is distinct from (state->>'balance')::bigint then raise exception 'Supplier balance changed. Refresh and check this invoice again';end if;
  if coalesce(data->>'paidOn','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Enter the actual payment or document date';end if;happened:=(data->>'paidOn')::date;
  if happened>today then raise exception 'Future payments cannot be marked paid';end if;
  if action='supplier_void_invoice' then
   if (state->>'paid')::bigint<>0 or (state->>'credited')::bigint<>0 then raise exception 'Reverse applied payments and credits before voiding an invoice';end if;
   entry_kind:='void';amount:=0;
  elsif action='supplier_reverse_entry' then
   select * into original from public.supplier_bill_entries e where e.id=(data->>'entryId')::uuid and e.organization_id=org and e.branch_id=branch and e.bill_id=bill.id and e.kind in('payment','credit_note');
   if original.id is null or exists(select 1 from public.supplier_bill_entries e where e.reverses=original.id) then raise exception 'Select an original payment or credit that has not been reversed';end if;
   entry_kind:=case when original.kind='payment' then 'payment_reversal' else 'credit_reversal' end;amount:=original.amount;method:=original.method;
  else
   if jsonb_typeof(data->'amount') is distinct from 'number' or (data->>'amount')!~'^\d{1,16}$' or (data->>'amount')::numeric not between 1 and 9007199254740991 then raise exception 'Enter a positive payment amount in exact centavos';end if;
   amount:=(data->>'amount')::bigint;if amount>(state->>'balance')::bigint then raise exception 'Payment or credit cannot exceed the current unpaid balance';end if;
   entry_kind:=case when action='supplier_record_payment' then 'payment' else 'credit_note' end;
   if exists(select 1 from public.supplier_bill_entries e where e.bill_id=bill.id and e.kind=entry_kind and lower(btrim(e.reference))=lower(ref) and not exists(select 1 from public.supplier_bill_entries r where r.reverses=e.id)) then raise exception 'This payment or credit reference is already applied to this invoice';end if;
   if entry_kind='payment' then method:=data->>'method';if method is null or method not in('bank','owner_cash','cheque') then raise exception 'Select the verified external payment method';end if;end if;
  end if;
  insert into public.supplier_bill_entries(id,organization_id,branch_id,bill_id,kind,amount,method,happened_on,reference,reason,reverses,created_by)
   values(ident,org,branch,bill.id,entry_kind,amount,method,happened,ref,reason,original.id,uid);
 end if;
 insert into public.stock_control_events(id,organization_id,branch_id,action,source_id,actor_id,payload) values(ident,org,branch,action,bill.id,uid,data);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,bill.id,jsonb_build_object('entryId',ident,'reference',ref));
 return jsonb_build_object('id',ident,'billId',bill.id,'duplicate',false,'invoice',app_private.supplier_bill_state(org,bill.id));
end$$;
revoke all on function app_private.supplier_account_command(text,jsonb) from public,anon,authenticated;

-- Extend the existing dispatcher in place: do not rename any function or alter
-- the cash, customer-credit or repaired archive branches.
do $supplier_route$declare src text;anchor text:=' if action in (''credit_book''';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier dispatcher anchor changed; stop and inspect';end if;
 src:=replace(src,anchor,E' if action in (''supplier_account_book'',''supplier_invoice_history'',''supplier_record_invoice'',''supplier_record_payment'',''supplier_credit_note'',''supplier_reverse_entry'',''supplier_void_invoice'') then return app_private.supplier_account_command(action,data);end if;\n'||anchor);
 execute src;
end$supplier_route$;
