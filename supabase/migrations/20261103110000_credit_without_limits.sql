-- Saved clients can buy on a chosen 30/60/90-day invoice. Existing legacy
-- policy values and every historical invoice/payment remain untouched.
create policy credit_contact_event_privacy on public.stock_control_events as restrictive for select to authenticated using(action<>'save_credit_contact' or app_private.can_checkout(organization_id,branch_id));
create policy credit_contact_audit_privacy on public.audit_events as restrictive for select to authenticated using(action<>'save_credit_contact' or app_private.can_checkout(organization_id,branch_id));
do $credit_checkout$declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.credit_command(text,jsonb)'::regprocedure);
 anchor:='  if not client.enabled or term is null or not term=any(client.terms) then raise exception ''Client credit is suspended or this term is not approved'';end if;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit term guard changed';end if;
 src:=replace(src,anchor,'  if term is null or term not in(30,60,90) then raise exception ''Choose 30, 60 or 90 calendar days'';end if;');
 anchor:='  if outstanding+sum_total-paid>client.credit_limit then raise exception ''This purchase exceeds the remaining approved credit limit'';end if;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit limit guard changed';end if;
 src:=replace(src,anchor,'  -- Credit limits are no longer required for checkout.');
 anchor:='  if overdue>0 then raise exception ''This client has overdue debt. The owner must resolve it before further credit'';end if;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Overdue credit guard changed';end if;
 src:=replace(src,anchor,'  -- Overdue debt stays visible in the account and checkout warning.');
 anchor:='  if exists(select 1 from public.credit_invoices i where i.organization_id=org and i.client_id=client.id and app_private.credit_due(org,i.sale_id) is null and app_private.credit_balance(org,i.sale_id)>0) then raise exception ''Confirm the historical invoice due dates before approving another credit purchase'';end if;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Historical due-date guard changed';end if;
 src:=replace(src,anchor,'  -- Missing historical due dates remain unknown; new invoices get their own agreed due date.');
 anchor:='outstanding bigint;overdue bigint;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Legacy balance declarations changed';end if;
 src:=replace(src,anchor,'');
 anchor:='  select coalesce(sum(app_private.credit_balance(org,i.sale_id)),0),coalesce(sum(app_private.credit_balance(org,i.sale_id)) filter(where app_private.credit_due(org,i.sale_id)<today),0) into outstanding,overdue from public.credit_invoices i where i.organization_id=org and i.client_id=client.id;';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Legacy credit limit aggregate changed';end if;
 src:=replace(src,anchor,'');
 anchor:=' if action=''save_credit_client'' then';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Client save route changed';end if;
 src:=replace(src,anchor,$contact$ if action='save_credit_contact' then
  if m.role<>'owner' then raise exception 'Only the owner can add or edit clients' using errcode='42501';end if;
  select * into client from public.credit_clients where organization_id=org and branch_id=branch and id=client_filter for update;
  if (client.id is null and coalesce((data->>'expectedVersion')::integer,0)<>0) or (client.id is not null and (data->>'expectedVersion')::integer is distinct from client.version) then raise exception 'Client details changed. Refresh before saving';end if;
  if client_filter is null or length(btrim(coalesce(data->>'name',''))) not between 1 and 180 or length(coalesce(data->>'phone',''))>100 or length(coalesce(data->>'address',''))>500 or length(coalesce(data->>'tin',''))>50 then raise exception 'Enter a client name and valid contact details';end if;
  insert into public.credit_clients(id,organization_id,branch_id,name,phone,address,tin) values(client_filter,org,branch,btrim(data->>'name'),coalesce(data->>'phone',''),coalesce(data->>'address',''),coalesce(data->>'tin',''))
  on conflict(id) do update set name=excluded.name,phone=excluded.phone,address=excluded.address,tin=excluded.tin,version=credit_clients.version+1 where credit_clients.organization_id=org and credit_clients.branch_id=branch;
  if not found then raise exception 'Client identity belongs to another branch' using errcode='42501';end if;
  insert into public.stock_control_events values(ident,org,branch,action,client_filter,uid,data,at_time);
  insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,action,client_filter,data);
  return jsonb_build_object('id',ident,'sourceId',client_filter);
 end if;
$contact$||anchor);
 execute src;
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 anchor:=' if action in (''credit_book'',''save_credit_client''';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit dispatcher changed';end if;
 execute replace(src,anchor,' if action in (''save_credit_contact'',''credit_book'',''save_credit_client''');
end$credit_checkout$;

-- Count unconfirmed dates over the entire account, beyond the loaded page.
do $date_warning$declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.credit_book_snapshot(uuid,uuid,uuid,integer)'::regprocedure);
 anchor:=' clients as(select c.*,';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit client aggregate changed';end if;
 src:=replace(src,anchor,' clients as(select c.*,count(d.sale_id) filter(where d.effective_due is null and d.balance>0) unconfirmed_invoices,');
 anchor:='''version'',version,''outstanding'',outstanding,''overdue'',overdue';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit client snapshot changed';end if;
 execute replace(src,anchor,'''version'',version,''unconfirmedInvoices'',unconfirmed_invoices,''outstanding'',outstanding,''overdue'',overdue');
end$date_warning$;
