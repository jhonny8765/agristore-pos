-- Classifications do not change credit permissions, balances or terms.
alter table public.credit_clients add column client_type text not null default 'normal'
 check(client_type in ('normal','distributor','owner'));
do $types$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.credit_command(text,jsonb)'::regprocedure);
 anchor:='  insert into public.credit_clients(id,organization_id,branch_id,name,phone,address,tin) values(client_filter,org,branch,btrim(data->>''name''),coalesce(data->>''phone'',''''),coalesce(data->>''address'',''''),coalesce(data->>''tin'',''''))';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Contact insert changed';end if;
 src:=replace(src,anchor,$new$  if data ? 'clientType' and coalesce(data->>'clientType','') not in ('normal','distributor','owner') then raise exception 'Choose Normal customer, Distributor or Owner';end if;
  insert into public.credit_clients(id,organization_id,branch_id,name,phone,address,tin,client_type) values(client_filter,org,branch,btrim(data->>'name'),coalesce(data->>'phone',''),coalesce(data->>'address',''),coalesce(data->>'tin',''),coalesce(data->>'clientType','normal'))$new$);
 anchor:='on conflict(id) do update set name=excluded.name,phone=excluded.phone,address=excluded.address,tin=excluded.tin,version=credit_clients.version+1';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Contact update changed';end if;
 execute replace(src,anchor,'on conflict(id) do update set name=excluded.name,phone=excluded.phone,address=excluded.address,tin=excluded.tin,client_type=case when data ? ''clientType'' then excluded.client_type else credit_clients.client_type end,version=credit_clients.version+1');
 src:=pg_get_functiondef('app_private.credit_book_snapshot(uuid,uuid,uuid,integer)'::regprocedure);
 anchor:='''version'',version,''unconfirmedInvoices''';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Client snapshot changed';end if;
 execute replace(src,anchor,'''version'',version,''clientType'',client_type,''unconfirmedInvoices''');
end$types$;

-- Append-only links allow several physical drops under one original invoice.
create table app_private.supplier_receipt_links(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,
 bill_id uuid not null,receipt_id uuid not null,created_by uuid not null references auth.users,
 created_at timestamptz not null default clock_timestamp(),unique(bill_id,receipt_id),
 foreign key(organization_id,bill_id) references public.supplier_bills(organization_id,id),
 foreign key(organization_id,receipt_id) references public.purchase_receipts(organization_id,id),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
alter table app_private.supplier_receipt_links enable row level security;
revoke all on app_private.supplier_receipt_links from public,anon,authenticated;
create index supplier_link_receipt on app_private.supplier_receipt_links(organization_id,receipt_id);
create index supplier_link_history on app_private.supplier_receipt_links(organization_id,bill_id,created_at,id);
create trigger immutable_history before update or delete on app_private.supplier_receipt_links for each row execute function app_private.immutable();
insert into app_private.supplier_receipt_links(organization_id,branch_id,bill_id,receipt_id,created_by)
 select organization_id,branch_id,id,receipt_id,created_by from public.supplier_bills where receipt_id is not null;

create function app_private.link_supplier_receipt(org uuid,branch uuid,billid uuid,receipt uuid) returns void
 language plpgsql set search_path='' as $$
declare b public.supplier_bills;begin
 if not app_private.can_supplier_accounts(org) then raise exception 'Only the owner can link supplier invoices' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':supplier-receipt:'||receipt::text,0));
 select * into b from public.supplier_bills where organization_id=org and branch_id=branch and id=billid for update;
 if b.id is null or exists(select 1 from public.supplier_bill_entries where bill_id=billid and kind='void') then raise exception 'Select an active supplier invoice in this branch';end if;
 if not exists(select 1 from public.purchase_receipts r where r.organization_id=org and r.branch_id=branch and r.id=receipt and r.source='purchase' and r.supplier_id=b.supplier_id) then raise exception 'The delivery and invoice must belong to the same supplier and branch';end if;
 if exists(select 1 from app_private.delivery_reversals d where d.organization_id=org and d.inspection_id=receipt) then raise exception 'Do not link a reversed delivery. Link its corrected receiving record instead';end if;
 if exists(select 1 from public.supplier_bills other where other.organization_id=org and other.id<>billid and not exists(select 1 from public.supplier_bill_entries e where e.bill_id=other.id and e.kind='void') and (other.receipt_id=receipt or exists(select 1 from app_private.supplier_receipt_links l where l.bill_id=other.id and l.receipt_id=receipt))) then raise exception 'This delivery already links to another active supplier invoice';end if;
 insert into app_private.supplier_receipt_links(organization_id,branch_id,bill_id,receipt_id,created_by) values(org,branch,billid,receipt,auth.uid()) on conflict(bill_id,receipt_id) do nothing;
end$$;
revoke all on function app_private.link_supplier_receipt(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create function app_private.normalized_purchase_quote(ordered jsonb,quote jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
declare item jsonb;cost jsonb;total numeric:=0;complete boolean:=true;begin
 if jsonb_typeof(quote) is distinct from 'object' or coalesce(quote->>'paymentMode','') not in ('cash','credit') or (quote->>'paymentMode'='cash' and coalesce(quote->>'term','')<>'0') or (quote->>'paymentMode'='credit' and coalesce(quote->>'term','') not in ('30','60','90')) then raise exception 'Choose proposed Cash or Credit payment terms';end if;
 if jsonb_typeof(quote->'unitCosts') is distinct from 'object' or jsonb_typeof(ordered->'items') is distinct from 'array' then raise exception 'Check the quoted order lines';end if;
 for item in select value from jsonb_array_elements(ordered->'items') loop
  cost:=quote->'unitCosts'->(item->>'lineId');
  if cost is null or cost='null'::jsonb then complete:=false;else
   if jsonb_typeof(cost)<>'number' or cost::text!~'^[0-9]{1,16}$' or (cost::text)::numeric not between 1 and 9007199254740991 then raise exception 'Quoted costs must be positive exact centavos, or left unconfirmed';end if;
   total:=total+round(app_private.purchasing_quantity(item->>'quantity')*(cost::text)::numeric);
  end if;
 end loop;
 if total>9007199254740991 then raise exception 'Quoted total exceeds the supported amount';end if;
 return quote||jsonb_build_object('quotedTotal',case when complete then total else null end);
end$$;
revoke all on function app_private.normalized_purchase_quote(jsonb,jsonb) from public,anon,authenticated;

create function app_private.supplier_purchase_receipts(data jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;bill uuid:=(data->>'billId')::uuid;off integer:=coalesce((data->>'offset')::integer,0);total bigint;rows jsonb;begin
 if not app_private.can_supplier_accounts(org) or not exists(select 1 from public.supplier_bills b where b.id=bill and b.organization_id=org and b.branch_id=branch) then raise exception 'Only the owner can read this supplier invoice' using errcode='42501';end if;
 if off<0 or off>1000000 then raise exception 'Invalid linked receiving page';end if;
 select count(*) into total from app_private.supplier_receipt_links l where l.organization_id=org and l.bill_id=bill;
 select coalesce(jsonb_agg(to_jsonb(x) order by x."linkedAt" desc,x."linkId" desc),'[]'::jsonb) into rows from(
  select l.id as "linkId",r.id,r.reference,r.created_at as "recordedAt",l.created_at as "linkedAt",exists(select 1 from app_private.delivery_reversals d where d.organization_id=org and d.inspection_id=r.id) as reversed
  from app_private.supplier_receipt_links l join public.purchase_receipts r on r.organization_id=org and r.id=l.receipt_id where l.organization_id=org and l.bill_id=bill order by l.created_at desc,l.id desc limit 50 offset off)x;
 return jsonb_build_object('rows',rows,'total',total,'next',case when total>off+50 then off+50 else null end);
end$$;
revoke all on function app_private.supplier_purchase_receipts(jsonb) from public,anon,authenticated;

create function app_private.purchasing_finance_context(result jsonb,org uuid,branch uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare rows jsonb;begin
 if not app_private.can_supplier_accounts(org) then return result;end if;
 select coalesce(jsonb_agg(o.value||jsonb_build_object('commercial',(select app_private.normalized_purchase_quote(e.payload->'order',e.payload->'commercial') from public.stock_control_events e where e.organization_id=org and e.branch_id=branch and e.action='supplier_create_order' and e.source_id=(o.value->>'id')::uuid)) order by o.ordinality),'[]'::jsonb) into rows from jsonb_array_elements(result->'orders') with ordinality o;
 result:=jsonb_set(result,'{orders}',rows);
 select coalesce(jsonb_agg(d.value||jsonb_build_object('supplierBill',(select jsonb_build_object('id',b.id,'reference',b.reference) from app_private.supplier_receipt_links l join public.supplier_bills b on b.id=l.bill_id and b.organization_id=org where l.organization_id=org and l.receipt_id=(d.value->>'id')::uuid and not exists(select 1 from public.supplier_bill_entries e where e.bill_id=b.id and e.kind='void') order by l.created_at desc,l.id desc limit 1)) order by d.ordinality),'[]'::jsonb) into rows from jsonb_array_elements(result->'deliveries') with ordinality d;
 return jsonb_set(result,'{deliveries}',rows);
end$$;
revoke all on function app_private.purchasing_finance_context(jsonb,uuid,uuid) from public,anon,authenticated;

-- Child writes share this transaction. A lost response retries the same saved
-- IDs and returns the original result rather than receiving or paying twice.
create unique index supplier_order_commercial_identity on public.stock_control_events(organization_id,source_id) where action='supplier_create_order';

create function app_private.supplier_purchase_command(action text,data jsonb) returns jsonb language plpgsql set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;ident uuid:=(data->>'requestId')::uuid;uid uuid:=auth.uid();prior public.stock_control_events;result jsonb;received jsonb;invoice jsonb;state jsonb;quote jsonb;receipt uuid;bill uuid;paymentid uuid;child uuid;supplier uuid;paid bigint:=0;begin
 if not app_private.can_supplier_accounts(org) or not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch and b.active) then raise exception 'Only the owner can record supplier purchasing amounts in this branch' using errcode='42501';end if;
 if ident is null then raise exception 'A permanent purchasing request ID is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':supplier-purchase:'||ident::text,0));
 select * into prior from public.stock_control_events e where e.id=ident;
 if prior.id is not null then
  if prior.organization_id<>org or prior.branch_id<>branch or prior.actor_id<>uid or prior.action<>action or prior.payload<>data then raise exception 'Purchasing request ID conflict';end if;
  select a.details->'result' into result from public.audit_events a where a.organization_id=org and a.action=supplier_purchase_command.action and a.source_id=ident order by a.id desc limit 1;
  if result is null then raise exception 'The original result needs owner verification; preserve its request';end if;
  return result||jsonb_build_object('duplicate',true);
 end if;
 if action='supplier_create_order' then
  child:=(data->'order'->>'purchaseOrderId')::uuid;if child is null or child=ident then raise exception 'Keep distinct permanent order and request IDs';end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text||':supplier-order:'||child::text,0));
  if exists(select 1 from public.stock_control_events e where e.organization_id=org and e.action='supplier_create_order' and e.source_id=child) then raise exception 'This order already has its original commercial request';end if;
  quote:=app_private.normalized_purchase_quote(data->'order',data->'commercial');
  received:=app_private.command('create_purchase_order',data->'order'||jsonb_build_object('organizationId',org,'branchId',branch));
  if received->>'duplicate'='true' then raise exception 'Retry the original order request; do not attach another quote';end if;
  result:=jsonb_build_object('id',ident,'purchaseOrderId',child,'commercial',quote,'duplicate',false);
 elsif action='supplier_receive_purchase' then
  if coalesce(data->>'receiptAction','') not in ('inspect_delivery','receive_stock') or jsonb_typeof(data->'delivery') is distinct from 'object' or jsonb_typeof(data->'invoice') is distinct from 'object' then raise exception 'Choose a supported receiving and supplier invoice workflow';end if;
  receipt:=(data->'delivery'->>'receiptId')::uuid;invoice:=data->'invoice';
  if receipt is null or receipt=ident then raise exception 'Keep distinct permanent receipt and request IDs';end if;
  received:=app_private.command(data->>'receiptAction',data->'delivery'||jsonb_build_object('organizationId',org,'branchId',branch,'source','purchase'));
  if received->>'duplicate'='true' then raise exception 'Retry the original receiving request; do not enter the delivery twice';end if;
  select r.supplier_id into supplier from public.purchase_receipts r where r.organization_id=org and r.branch_id=branch and r.id=receipt and r.source='purchase';
  if supplier is null then raise exception 'A supplier is required for the receiving and invoice';end if;
  if invoice->>'mode'='new' then
   bill:=(invoice->>'requestId')::uuid;
   if bill is null or bill in(ident,receipt) then raise exception 'Keep distinct permanent bill, receipt and request IDs';end if;
   if coalesce(invoice->>'paymentMode','') not in ('cash','credit') or (invoice->>'paymentMode'='cash' and coalesce(invoice->>'term','')<>'0') then raise exception 'Choose the actual supplier Cash or Credit terms';end if;
   if invoice->>'paymentMode'='credit' and coalesce(invoice->>'term','') not in ('30','60','90') then raise exception 'Choose the actual agreed credit term';end if;
   received:=app_private.supplier_account_command('supplier_record_invoice',invoice||jsonb_build_object('organizationId',org,'branchId',branch,'supplierId',supplier,'receiptId',receipt));
   state:=app_private.supplier_bill_state(org,bill);
   if jsonb_typeof(invoice->'paidAmount') is distinct from 'number' or coalesce(invoice->>'paidAmount','')!~'^[0-9]{1,16}$' then raise exception 'Enter the exact amount already paid, or zero';end if;
   paid:=(invoice->>'paidAmount')::bigint;
   if paid<0 or paid>(state->>'amount')::bigint or (invoice->>'paymentMode'='cash' and paid<>(state->>'amount')::bigint) then raise exception 'Cash means paid in full; credit may retain an unpaid balance';end if;
   if paid>0 then
    paymentid:=(invoice->>'paymentId')::uuid;
    if paymentid is null or paymentid in(ident,receipt,bill) then raise exception 'Keep distinct permanent payment and invoice IDs';end if;
    received:=app_private.supplier_account_command('supplier_record_payment',jsonb_build_object('organizationId',org,'branchId',branch,'requestId',paymentid,'billId',bill,'expectedVersion',(state->>'version')::integer,'expectedBalance',(state->>'balance')::bigint,'amount',paid,'paidOn',invoice->>'paidOn','method','owner_cash','reference',invoice->>'paymentReference','reason',invoice->>'reason','confirmed',(invoice->>'paymentConfirmed')::boolean));
   end if;
  elsif invoice->>'mode'='existing' then
   bill:=(invoice->>'billId')::uuid;if bill is null then raise exception 'Choose the original supplier invoice';end if;
  else raise exception 'Choose a new supplier invoice or link an existing one';end if;
  perform app_private.link_supplier_receipt(org,branch,bill,receipt);
  state:=app_private.supplier_bill_state(org,bill);
  result:=jsonb_build_object('id',ident,'receiptId',receipt,'billId',bill,'paymentId',paymentid,'paidAmount',paid,'invoice',state,'duplicate',false);
 else raise exception 'Unknown supplier purchasing action';end if;
 insert into public.stock_control_events(id,organization_id,branch_id,action,source_id,actor_id,payload) values(ident,org,branch,action,coalesce(child,receipt),uid,data);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,ident,jsonb_build_object('result',result));
 return result;
end$$;
revoke all on function app_private.supplier_purchase_command(text,jsonb) from public,anon,authenticated;

-- Copy rather than rename the entry point: every existing handler and replay
-- branch retains its definition. New amounts remain owner-only supplier data.
do $copy$declare src text;anchor text:='CREATE OR REPLACE FUNCTION app_private.command(action text, data jsonb)';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if strpos(src,anchor)<>1 then raise exception 'Command entry signature changed';end if;
 execute replace(src,anchor,'CREATE OR REPLACE FUNCTION app_private.command_before_supplier_purchases(action text, data jsonb)');
end$copy$;
revoke all on function app_private.command_before_supplier_purchases(text,jsonb) from public,anon,authenticated;
create or replace function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;links jsonb;org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;begin
 if action in('supplier_create_order','supplier_receive_purchase') then return app_private.supplier_purchase_command(action,data);end if;
 if action='supplier_bill_receipts' then return app_private.supplier_purchase_receipts(data);end if;
 result:=app_private.command_before_supplier_purchases(action,data);
 if action='purchasing_workspace' then return app_private.purchasing_finance_context(result,org,branch);end if;
 if action='supplier_record_invoice' and result->>'duplicate'='false' and nullif(data->>'receiptId','') is not null then perform app_private.link_supplier_receipt(org,branch,(result->>'billId')::uuid,(data->>'receiptId')::uuid);end if;
 if action='supplier_invoice_history' then
  links:=app_private.supplier_purchase_receipts(data);
  result:=result||jsonb_build_object('receipts',links->'rows','receiptNext',links->'next','receiptTotal',links->'total');
 end if;
 return result;
end$$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;
