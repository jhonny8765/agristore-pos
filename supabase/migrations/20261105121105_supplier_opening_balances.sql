-- An unpaid-bills report supplies a remaining opening balance, not original
-- invoice gross or earlier payment history. Normal invoice entry stays strict.
alter table public.supplier_bills
 add column source text not null default 'invoice' check(source in('invoice','opening')),
 add column opening_as_of date,
 add column source_details jsonb,
 alter column term drop not null,
 alter column due_on drop not null,
 drop constraint supplier_bills_term_check,
 drop constraint supplier_bills_check;
alter table public.supplier_bills add constraint supplier_bill_source_contract check((
 case when source='invoice' then
  term is not null and term in(0,30,60,90) and due_on is not null and due_on=issued_on+term
  and opening_as_of is null and source_details is null
 else
  opening_as_of is not null and issued_on<=opening_as_of and (term is null or term>=0)
  and receipt_id is null and replaces_id is null and jsonb_typeof(source_details)='object'
  and jsonb_typeof(source_details->'file')='string' and length(source_details->>'file') between 1 and 255
  and (source_details->>'sha256')~'^[a-f0-9]{64}$'
  and (source_details->>'page')~'^[1-9][0-9]{0,8}$' and (source_details->>'row')~'^[1-9][0-9]{0,8}$'
  and jsonb_typeof(source_details->'termsText') in('string','null')
 end) is true);
create unique index supplier_opening_source_once on public.supplier_bills
 (organization_id,(source_details->>'sha256'),(source_details->>'page'),(source_details->>'row')) where source='opening';

create or replace function app_private.supplier_bill_state(org uuid,bill uuid) returns jsonb language sql stable set search_path='' as $$
 with totals as(select coalesce(sum(case when kind='payment' then amount when kind='payment_reversal' then -amount else 0 end),0) paid,
 coalesce(sum(case when kind='credit_note' then amount when kind='credit_reversal' then -amount else 0 end),0) credited,
 coalesce(bool_or(kind='void'),false) voided,count(*) version from public.supplier_bill_entries where organization_id=org and bill_id=bill)
 select jsonb_build_object('id',b.id,'supplierId',b.supplier_id,'supplierName',b.supplier_name,'reference',b.reference,'issuedOn',b.issued_on,'term',b.term,'dueOn',b.due_on,
 'amount',b.amount,'paid',t.paid,'credited',t.credited,'balance',case when t.voided then 0 else b.amount-t.paid-t.credited end,'voided',t.voided,'version',t.version,
 'description',b.description,'receiptId',b.receipt_id,'replacesId',b.replaces_id,'recordedAt',b.created_at,
 'source',b.source,'openingAsOf',b.opening_as_of,'sourceDetails',b.source_details)
 from public.supplier_bills b cross join totals t where b.organization_id=org and b.id=bill
$$;
revoke all on function app_private.supplier_bill_state(uuid,uuid) from public,anon,authenticated;

do $opening_guards$declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.supplier_account_command(text,jsonb)'::regprocedure);
 anchor:=' if action=''supplier_invoice_history'' then';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier history route changed';end if;
 src:=replace(src,anchor,anchor||E'\n  if data->''openingBalancesSupported'' is distinct from ''true''::jsonb and exists(select 1 from public.supplier_bills b where b.organization_id=org and b.branch_id=branch and b.id=(data->>''billId'')::uuid and b.source=''opening'') then raise exception ''Update the app to view imported opening supplier balances accurately'';end if;');
 anchor:=' if action=''supplier_record_invoice'' then';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier invoice route changed';end if;
 src:=replace(src,anchor,anchor||E'\n   if data ? ''source'' and data->>''source'' is distinct from ''invoice'' then raise exception ''Opening balances require a reviewed maintenance import'';end if;');
 anchor:='   select * into old_bill from public.supplier_bills b where b.id=replaces and b.organization_id=org and b.branch_id=branch for update;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier replacement route changed';end if;
 src:=replace(src,anchor,anchor||E'\n    if old_bill.source=''opening'' then raise exception ''Opening balances need a reviewed opening correction, not a new invoice'';end if;');
 anchor:='  if happened>today then raise exception ''Future payments cannot be marked paid'';end if;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier settlement date guard changed';end if;
 src:=replace(src,anchor,anchor||E'\n   if bill.source=''opening'' and happened<bill.opening_as_of then raise exception ''Record only activity on or after the opening balance date'';end if;');
 execute src;

 src:=pg_get_functiondef('app_private.link_supplier_receipt(uuid,uuid,uuid,uuid)'::regprocedure);
 anchor:=' select * into b from public.supplier_bills where organization_id=org and branch_id=branch and id=billid for update;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier receipt lookup changed';end if;
 execute replace(src,anchor,anchor||E'\n  if b.source=''opening'' then raise exception ''Opening balances cannot be linked to stock receipts'';end if;');

 src:=pg_get_functiondef('app_private.supplier_account_book(uuid,uuid,jsonb)'::regprocedure);
 anchor:=' if offset_n<0 or offset_n>1000000 or length(q)>180';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier book validation changed';end if;
 src:=replace(src,anchor,E' if data->''openingBalancesSupported'' is distinct from ''true''::jsonb and exists(select 1 from public.supplier_bills b where b.organization_id=org and b.branch_id=branch and b.source=''opening'' and (supplier is null or b.supplier_id=supplier)) then raise exception ''Update the app to view imported opening supplier balances accurately'';end if;\n'||anchor);
 anchor:='''paidCount'',(select count(*) from scope where not (doc->>''voided'')::boolean and (doc->>''balance'')::bigint=0)';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier total projection changed';end if;
 execute replace(src,anchor,anchor||',''unconfirmedDue'',coalesce((select sum((doc->>''balance'')::bigint) from scope where doc->>''dueOn'' is null),0)::text');

 src:=pg_get_functiondef('app_private.supplier_purchase_receipts(jsonb)'::regprocedure);
 anchor:=' if off<0 or off>1000000 then';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier linked-receipt validation changed';end if;
 execute replace(src,anchor,E' if data->''openingBalancesSupported'' is distinct from ''true''::jsonb and exists(select 1 from public.supplier_bills b where b.organization_id=org and b.branch_id=branch and b.id=bill and b.source=''opening'') then raise exception ''Update the app to view imported opening supplier balances accurately'';end if;\n'||anchor);

 src:=pg_get_functiondef('app_private.record_report(jsonb)'::regprocedure);
 anchor:='''amount'',b.amount::text,''paid'',s.doc->>''paid''';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier report amount projection changed';end if;
 src:=replace(src,anchor,'''source'',b.source,''openingAsOf'',b.opening_as_of,''sourceTerms'',b.source_details->>''termsText'','||anchor);
 anchor:='''type'',e.kind,''amount'',e.amount::text,''method'',e.method';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier activity report changed';end if;
 src:=replace(src,anchor,'''type'',case when b.source=''opening'' and e.kind=''invoice'' then ''opening'' else e.kind end,''amount'',e.amount::text,''method'',e.method,''source'',b.source');
 anchor:='result:=result||jsonb_build_object(''entityId'',coalesce(entity::text,''''));';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier report result boundary changed';end if;
 execute replace(src,anchor,anchor||E'\n if kind in(''supplier_invoices'',''supplier_payments'') and data->''openingBalancesSupported'' is distinct from ''true''::jsonb and exists(select 1 from jsonb_array_elements(result->''rows'') r where r.value->>''source''=''opening'') then raise exception ''Update the app to view imported opening supplier balances accurately'';end if;');
end$opening_guards$;
-- Existing RLS, owner/session checks, immutable triggers and private-function
-- grants are retained. Opening rows are created only by reviewed maintenance.
