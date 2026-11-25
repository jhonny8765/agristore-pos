-- Permit a custom number of calendar days for newly issued credit invoices.
-- Contact defaults, authorization and original request handling stay in their existing paths.
DO $migration$
BEGIN
  IF md5(replace(pg_get_functiondef('app_private.credit_command(text,jsonb)'::regprocedure), chr(13), '')) <> '1d0518d274a67a9ff386a52204288e5d' THEN
    RAISE EXCEPTION 'Review the existing credit command before applying this migration';
  END IF;
END;
$migration$;

ALTER TABLE public.credit_invoices
  DROP CONSTRAINT credit_invoices_term_check,
  ADD CONSTRAINT credit_invoices_term_check CHECK (term BETWEEN 1 AND 365);

CREATE OR REPLACE FUNCTION app_private.credit_command(action text, data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
 org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;uid uuid:=auth.uid();
 m public.staff_memberships;client public.credit_clients;sh public.cashier_shifts;inv public.credit_invoices;s public.sales;prod public.products;un public.product_units;pr public.unit_prices;
 ident uuid;row_item jsonb;r jsonb;prior public.stock_control_events;original public.credit_entries;
 amount bigint;paid bigint;balance bigint;sum_total bigint:=0;q numeric;factor numeric;available numeric;b_id uuid;
 term integer;at_time timestamptz:=clock_timestamp();today date:=(now() at time zone 'Asia/Manila')::date;
 plan jsonb;quote jsonb;cash_refund bigint;debt_reduction bigint;ref text;offset_n integer:=coalesce((data->>'offset')::integer,0);client_filter uuid:=(data->>'clientId')::uuid;
begin
 if org is null or branch is null or not app_private.can_checkout(org,branch) or not exists(select 1 from public.branches b where b.id=branch and b.organization_id=org and b.active) then raise exception 'Only authorized sales staff can access client credit' using errcode='42501';end if;
 select * into m from public.staff_memberships where organization_id=org and user_id=uid and active and (role='owner' or branch_id=branch) order by (role='owner') desc limit 1 for share;
 if m.id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in again to use client credit' using errcode='42501';end if;
 if action='credit_book' then
  if offset_n<0 or offset_n>1000000 then raise exception 'Invalid credit history page';end if;
  if data ? 'includeHistory' and jsonb_typeof(data->'includeHistory') is distinct from 'boolean' then raise exception 'Choose a valid credit history view';end if;
  if data->>'includeHistory'='false' then
   if client_filter is not null or offset_n<>0 then raise exception 'The account register does not have invoice pages';end if;
   return app_private.credit_book_snapshot(org,branch,null::uuid,0,false);
  end if;
  return app_private.credit_book_snapshot(org,branch,client_filter,offset_n);
 end if;
 ident:=(data->>'requestId')::uuid;
 if ident is null then raise exception 'A permanent credit request ID is required';end if;
 -- Serialize the same request across sessions before checking retained original payload.
 perform pg_advisory_xact_lock(hashtextextended(ident::text,0));
 select * into prior from public.stock_control_events where id=ident;
 if prior.id is not null then
  if prior.organization_id=org and prior.branch_id=branch and prior.actor_id=uid and prior.action=action and prior.payload=data then return jsonb_build_object('id',ident,'sourceId',prior.source_id,'duplicate',true);end if;
  raise exception 'Credit request ID conflict';
 end if;
 if action='save_credit_contact' then
  if m.role<>'owner' then raise exception 'Only the owner can add or edit clients' using errcode='42501';end if;
  select * into client from public.credit_clients where organization_id=org and branch_id=branch and id=client_filter for update;
  if (client.id is null and coalesce((data->>'expectedVersion')::integer,0)<>0) or (client.id is not null and (data->>'expectedVersion')::integer is distinct from client.version) then raise exception 'Client details changed. Refresh before saving';end if;
  if client_filter is null or length(btrim(coalesce(data->>'name',''))) not between 1 and 180 or length(coalesce(data->>'phone',''))>100 or length(coalesce(data->>'address',''))>500 or length(coalesce(data->>'tin',''))>50 then raise exception 'Enter a client name and valid contact details';end if;
  if data ? 'clientType' and coalesce(data->>'clientType','') not in ('normal','distributor','owner') then raise exception 'Choose Normal customer, Distributor or Owner';end if;
  insert into public.credit_clients(id,organization_id,branch_id,name,phone,address,tin,client_type) values(client_filter,org,branch,btrim(data->>'name'),coalesce(data->>'phone',''),coalesce(data->>'address',''),coalesce(data->>'tin',''),coalesce(data->>'clientType','normal'))
  on conflict(id) do update set name=excluded.name,phone=excluded.phone,address=excluded.address,tin=excluded.tin,client_type=case when data ? 'clientType' then excluded.client_type else credit_clients.client_type end,version=credit_clients.version+1 where credit_clients.organization_id=org and credit_clients.branch_id=branch;
  if not found then raise exception 'Client identity belongs to another branch' using errcode='42501';end if;
  insert into public.stock_control_events values(ident,org,branch,action,client_filter,uid,data,at_time);
  insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,client_filter,data);
  return jsonb_build_object('id',ident,'sourceId',client_filter);
 end if;
 if action='save_credit_client' then
  if m.role<>'owner' then raise exception 'Only the owner can approve or change client credit' using errcode='42501';end if;
  select * into client from public.credit_clients where organization_id=org and branch_id=branch and id=client_filter for update;
  if (client.id is null and coalesce((data->>'expectedVersion')::integer,0)<>0) or (client.id is not null and (data->>'expectedVersion')::integer is distinct from client.version) then raise exception 'Client details changed. Refresh before saving';end if;
  if client_filter is null or length(btrim(coalesce(data->>'name',''))) not between 1 and 180 or jsonb_typeof(data->'terms') is distinct from 'array' or not coalesce((data->>'approved')::boolean,false) then raise exception 'Enter client details, permitted terms and confirm owner approval';end if;
  if length(btrim(coalesce(data->>'reason','')))<3 then raise exception 'Record the reason for this credit policy';end if;
  insert into public.credit_clients(id,organization_id,branch_id,name,phone,address,tin,enabled,credit_limit,terms) values(client_filter,org,branch,btrim(data->>'name'),coalesce(data->>'phone',''),coalesce(data->>'address',''),coalesce(data->>'tin',''),coalesce((data->>'enabled')::boolean,false),(data->>'limit')::bigint,array(select value::integer from jsonb_array_elements_text(data->'terms')))
  on conflict(id) do update set name=excluded.name,phone=excluded.phone,address=excluded.address,tin=excluded.tin,enabled=excluded.enabled,credit_limit=excluded.credit_limit,terms=excluded.terms,version=credit_clients.version+1 where credit_clients.organization_id=org and credit_clients.branch_id=branch;
  if not found then raise exception 'Client identity belongs to another branch' using errcode='42501';end if;
  insert into public.stock_control_events values(ident,org,branch,action,client_filter,uid,data,at_time);
  insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,client_filter,data);
  return jsonb_build_object('id',ident,'sourceId',client_filter);
 end if;
 if action='record_credit_sale' then
  select * into client from public.credit_clients where id=client_filter and organization_id=org and branch_id=branch for update;
 else
  select * into inv from public.credit_invoices where organization_id=org and branch_id=branch and sale_id=(data->>'saleId')::uuid;
  if inv.sale_id is null then raise exception 'Credit invoice not found';end if;
  select * into client from public.credit_clients where organization_id=org and id=inv.client_id for update;
 end if;
 if client.id is null then raise exception 'Select an authorized client';end if;
 if action='set_credit_due_date' then
  if m.role<>'owner' then raise exception 'Only the owner can confirm a historical due date' using errcode='42501';end if;
  if inv.source<>'opening' or (data->>'dueOn') is null or length(btrim(coalesce(data->>'reference','')))<3 or length(btrim(coalesce(data->>'reason','')))<3 then raise exception 'Select an opening invoice and document its agreed due date';end if;
  if (data->>'expectedDueOn')::date is distinct from app_private.credit_due(org,inv.sale_id) then raise exception 'The due date changed. Refresh the original invoice';end if;
  insert into public.credit_due_history values(ident,org,branch,inv.sale_id,(data->>'dueOn')::date,btrim(data->>'reference'),btrim(data->>'reason'),uid,at_time);
  insert into public.stock_control_events values(ident,org,branch,action,inv.sale_id,uid,data,at_time);
  insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,ident,data);
  return jsonb_build_object('id',ident);
 end if;
 select * into sh from public.cashier_shifts where organization_id=org and branch_id=branch and id=(data->>'shiftId')::uuid and cashier_id=uid and closed_at is null for update;
 if sh.id is null or not exists(select 1 from public.devices d where d.organization_id=org and d.id=sh.device_id and d.active) or not exists(select 1 from public.shift_authorizations a where a.shift_id=sh.id and now() between a.issued_at and a.expires_at) then raise exception 'Open or renew your own authorized shift online before changing credit';end if;
 if action='record_credit_sale' then
  if (data->>'version')::integer is distinct from 2 or data->>'cashierId' is distinct from uid::text or data->>'deviceId' is distinct from sh.device_id::text then raise exception 'Invalid credit sale identity';end if;
  term:=(data->>'term')::integer;paid:=(data->>'cashReceived')::bigint;ref:=upper(btrim(data->>'officialReference'));
  if term is null or term not between 1 and 365 then raise exception 'Choose a payment term from 1 to 365 calendar days';end if;
  if length(coalesce(ref,'')) not between 3 and 100 then raise exception 'Enter the actual authorized booklet invoice number';end if;
  if (data->>'manualInvoiceConfirmed')::boolean is distinct from true then raise exception 'Confirm the official manual invoice and agreed due date';end if;
  if (data->>'expectedDueOn')::date is distinct from today+term then raise exception 'The issue date changed. Review the due date and manual invoice again';end if;

  -- Missing historical due dates remain unknown; new invoices get their own agreed due date.
  if exists(select 1 from public.credit_invoices i where i.organization_id=org and upper(i.official_reference)=ref) then raise exception 'This official booklet invoice reference is already recorded';end if;
  -- Overdue debt stays visible in the account and checkout warning.
  if jsonb_typeof(data->'items') is distinct from 'array' or jsonb_array_length(data->'items') not between 1 and 100 then raise exception 'Add 1 to 100 valid sale lines';end if;
  for row_item in select value from jsonb_array_elements(data->'items') order by value->>'productId',value->>'batchId' loop
   select * into prod from public.products where organization_id=org and id=(row_item->>'productId')::uuid;
   select * into un from public.product_units where organization_id=org and id=(row_item->>'unitId')::uuid and product_id=prod.id;
   select * into pr from public.unit_prices where organization_id=org and unit_id=un.id and version=(row_item->>'priceVersion')::integer;
   q:=(row_item->>'quantity')::numeric;factor:=(row_item->>'factor')::numeric;b_id:=(row_item->>'batchId')::uuid;
   if prod.id is null or not prod.active or un.id is null or pr.unit_id is null or pr.version<>un.price_version or q is null or q<=0 or q>=1000000000000 or scale(trim_scale(q))>6 or factor is distinct from un.factor or scale(trim_scale(q*factor))>6 or (prod.base_unit='piece' and q*factor<>trunc(q*factor)) or (row_item->>'unitPrice')::bigint is distinct from app_private.branch_sale_price(org,branch,row_item) or (row_item->>'unitCost')::bigint is distinct from pr.cost then raise exception 'Product, quantity, conversion or price changed. Refresh and review';end if;
   if (prod.price_pending and row_item->>'branchPriceId' is null) or prod.setup_pending then raise exception 'Confirm the product price and selling unit before selling';end if;
   if (b_id is null and prod.tracks_expiry) or (b_id is not null and not exists(select 1 from public.product_batches b where b.organization_id=org and b.id=b_id and b.product_id=prod.id and (b.expires_on is null or b.expires_on>=today))) then raise exception 'Choose a valid unexpired lot';end if;
   amount:=app_private.discounted_sale_line(row_item,q,app_private.branch_sale_price(org,branch,row_item),org,branch);if amount is distinct from (row_item->>'lineTotal')::bigint then raise exception 'Sale line amount does not match its original price';end if;
   sum_total:=sum_total+amount;
  end loop;
  if sum_total<=0 or sum_total>9007199254740991 or sum_total is distinct from (data->>'total')::bigint or paid is null or paid<0 or paid>=sum_total then raise exception 'Credit requires a valid total and a smaller cash payment; use cash checkout for full payment';end if;
  -- Credit limits are no longer required for checkout.
  -- Reserve exact aggregated quantities, including repeated lines of the same lot.
  for r in select jsonb_build_object('product',x->>'productId','batch',x->>'batchId','quantity',sum((x->>'quantity')::numeric*(x->>'factor')::numeric)) from jsonb_array_elements(data->'items')x group by x->>'productId',x->>'batchId' order by x->>'productId',x->>'batchId' loop
   select quantity into available from public.branch_inventory where organization_id=org and branch_id=branch and product_id=(r->>'product')::uuid and batch_id is not distinct from (r->>'batch')::uuid for update;
   if coalesce(available,0)<(r->>'quantity')::numeric then raise exception 'Not enough confirmed saleable stock for this credit sale';end if;
  end loop;
  insert into public.sales(id,organization_id,branch_id,device_id,cashier_id,shift_id,occurred_at,total,cash_received,receipt,payload,payment_mode) values(ident,org,branch,sh.device_id,uid,sh.id,at_time,sum_total,paid,'CR-'||upper(replace(ident::text,'-','')),data,'credit');
  insert into public.credit_invoices(sale_id,organization_id,branch_id,client_id,term,due_on,official_reference,client_snapshot,seller_name,actual_sale_id,amount,issued_at,payload) values(ident,org,branch,client.id,term,today+term,ref,jsonb_build_object('name',client.name,'phone',client.phone,'address',client.address,'tin',client.tin),(select name from public.organizations where id=org),ident,sum_total,at_time,data);
  for row_item in select value from jsonb_array_elements(data->'items') loop
   insert into public.sale_items(organization_id,sale_id,product_id,unit_id,batch_id,quantity,factor,price,cost,line_total,price_version,branch_id,branch_price_id,branch_price_version) values(org,ident,(row_item->>'productId')::uuid,(row_item->>'unitId')::uuid,(row_item->>'batchId')::uuid,(row_item->>'quantity')::numeric,(row_item->>'factor')::numeric,(row_item->>'unitPrice')::bigint,(row_item->>'unitCost')::bigint,(row_item->>'lineTotal')::bigint,(row_item->>'priceVersion')::integer,(row_item->>'branchId')::uuid,(row_item->>'branchPriceId')::uuid,(row_item->>'branchPriceVersion')::integer);
   insert into public.inventory_movements(organization_id,branch_id,product_id,batch_id,quantity,kind,source_id,created_by) values(org,branch,(row_item->>'productId')::uuid,(row_item->>'batchId')::uuid,-(row_item->>'quantity')::numeric*(row_item->>'factor')::numeric,'sale',ident,uid);
  end loop;
  if paid>0 then insert into public.payments(organization_id,branch_id,sale_id,shift_id,amount) values(org,branch,ident,sh.id,paid);end if;
  balance:=sum_total-paid;
 elsif action in ('collect_credit_payment','reverse_credit_collection','credit_refund') then
  select * into s from public.sales where organization_id=org and id=inv.actual_sale_id for update;
  balance:=app_private.credit_balance(org,inv.sale_id);
  ref:=btrim(data->>'reference');
  if length(coalesce(ref,'')) not between 3 and 200 or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000 then raise exception 'Enter a payment/document reference and reason with at least three characters';end if;
  if action='collect_credit_payment' then
   amount:=(data->>'amount')::bigint;
   if amount is null or amount<=0 or amount>balance then raise exception 'Payment must be positive and no greater than the current unpaid balance';end if;
   insert into public.credit_entries values(ident,org,branch,inv.sale_id,'collection',amount,amount,ref,btrim(data->>'reason'),null,uid,at_time);
   insert into public.payments(organization_id,branch_id,sale_id,shift_id,amount,credit_entry_id,credit_invoice_id) values(org,branch,inv.actual_sale_id,sh.id,amount,ident,inv.sale_id);
  elsif action='reverse_credit_collection' then
   if m.role<>'owner' then raise exception 'Only the owner can reverse a collection' using errcode='42501';end if;
   select * into original from public.credit_entries where id=(data->>'collectionId')::uuid and organization_id=org and invoice_id=inv.sale_id and kind='collection';
   if original.id is null or exists(select 1 from public.credit_entries where reverses=original.id) or (data->>'cashConfirmed')::boolean is distinct from true then raise exception 'Select an unreversed collection and confirm the cash handover';end if;
   amount:=original.cash;
   if balance+amount>inv.amount-coalesce((select sum(e.amount) from public.credit_entries e where e.organization_id=org and e.invoice_id=inv.sale_id and e.kind='credit_note'),0) then raise exception 'Dependent credit activity prevents this reversal';end if;
   select app_private.drawer_cash_balance(org,sh.id) into paid;
   if paid<amount then raise exception 'Not enough recorded drawer cash for this reversal';end if;
   insert into public.credit_entries values(ident,org,branch,inv.sale_id,'collection_reversal',amount,amount,ref,btrim(data->>'reason'),original.id,uid,at_time);
   insert into public.payments(organization_id,branch_id,sale_id,shift_id,amount,credit_entry_id,credit_invoice_id) values(org,branch,inv.actual_sale_id,sh.id,-amount,ident,inv.sale_id);
  else
   if inv.source='opening' then raise exception 'Opening balances do not contain original goods or payment details. Preserve the source and use documented owner reconciliation';end if;
   if m.role<>'owner' then raise exception 'Only the owner can approve credit returns' using errcode='42501';end if;
   plan:=app_private.partial_refund_plan(org,branch,inv.sale_id);quote:=app_private.partial_refund_quote(plan,data->'items');amount:=(quote->>'amount')::bigint;
   if (data->>'expectedRefundVersion')::integer is distinct from (plan->>'version')::integer or (data->>'expectedAmount')::bigint is distinct from amount or (data->>'expectedBalance')::bigint is distinct from balance or (data->>'physicalConfirmed')::boolean is distinct from true then raise exception 'The return or balance changed. Review again and confirm physical quantities';end if;
   debt_reduction:=least(balance,amount);cash_refund:=amount-debt_reduction;
   select app_private.drawer_cash_balance(org,sh.id) into paid;
   if paid<cash_refund then raise exception 'Not enough recorded drawer cash for the paid portion of this return';end if;
   insert into public.credit_entries values(ident,org,branch,inv.sale_id,'credit_note',amount,cash_refund,ref,btrim(data->>'reason'),null,uid,at_time);
   insert into public.sale_partial_refunds values(ident,org,branch,inv.sale_id,sh.id,amount,ref,btrim(data->>'reason'),uid,at_time);
   for r in select value from jsonb_array_elements(quote->'items') loop
    insert into app_private.partial_refund_lines values(org,ident,(r->>'lineIndex')::integer,(r->>'quantity')::numeric,(r->>'returnedQuantity')::numeric,(r->>'saleableQuantity')::numeric,(r->>'heldQuantity')::numeric,(r->>'amount')::bigint);
    if (r->>'saleableQuantity')::numeric>0 then insert into public.inventory_movements(organization_id,branch_id,product_id,batch_id,quantity,kind,source_id,created_by) values(org,branch,(r->>'productId')::uuid,(r->>'batchId')::uuid,(r->>'saleableQuantity')::numeric*(r->>'factor')::numeric,'refund',ident,uid);end if;
    if (r->>'heldQuantity')::numeric>0 then insert into public.stock_holds(organization_id,branch_id,product_id,batch_id,quantity,remaining,reason,source_id) values(org,branch,(r->>'productId')::uuid,(r->>'batchId')::uuid,(r->>'heldQuantity')::numeric*(r->>'factor')::numeric,(r->>'heldQuantity')::numeric*(r->>'factor')::numeric,btrim(data->>'reason'),ident);end if;
    if (r->>'returnedQuantity')::numeric<>(r->>'quantity')::numeric or (r->>'heldQuantity')::numeric>0 then insert into public.stock_exceptions(organization_id,branch_id,kind,source_id,details) values(org,branch,'return_review',ident,jsonb_build_object('saleId',inv.sale_id,'reason',data->>'reason')) on conflict do nothing;end if;
   end loop;
   if cash_refund>0 then insert into public.payments(organization_id,branch_id,sale_id,shift_id,amount,partial_refund_id,credit_entry_id) values(org,branch,inv.sale_id,sh.id,-cash_refund,ident,ident);end if;
  end if;
  balance:=app_private.credit_balance(org,inv.sale_id);
  if balance<0 then raise exception 'Credit balance would become negative';end if;
 else raise exception 'Unknown credit action';end if;
 insert into public.stock_control_events values(ident,org,branch,action,coalesce(s.id,ident),uid,data,at_time);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,ident,jsonb_build_object('balance',balance,'reference',ref));
 return jsonb_build_object('id',ident,'balance',balance,'dueOn',case when action='record_credit_sale' then today+term else inv.due_on end,'duplicate',false);
end$function$;
