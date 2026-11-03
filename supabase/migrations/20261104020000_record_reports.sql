-- Read-only owner registers. Export is one statement snapshot, never a download
-- of whichever UI pages happen to be loaded. No transaction/history is moved.
create function app_private.record_report(data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;kind text:=data->>'kind';q text:=btrim(coalesce(data->>'query',''));status text:=coalesce(data->>'status','all');from_day date;to_day date;offset_n integer:=coalesce((data->>'offset')::integer,0);exporting boolean:=coalesce((data->>'export')::boolean,false);result jsonb;entity uuid:=nullif(data->>'entityId','')::uuid;today date:=(statement_timestamp() at time zone 'Asia/Manila')::date;
begin
 if not app_private.can_supplier_accounts(org) or not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch and b.active) then raise exception 'Only an owner with access to this active branch can read or export these records' using errcode='42501';end if;
 if kind is null or kind not in('receipts','credit_invoices','credit_payments','supplier_invoices','supplier_payments','stock','purchases','audit') or length(q)>180 or offset_n<0 or offset_n>1000000 or status not in('all','outstanding','paid','overdue','unconfirmed','voided','completed','partial','refunded','corrected','review') then raise exception 'Choose valid record filters';end if;
 if coalesce(data->>'from','')<>'' then
  if data->>'from'!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Enter a valid starting date';end if;from_day:=(data->>'from')::date;
 end if;
 if coalesce(data->>'to','')<>'' then
  if data->>'to'!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Enter a valid ending date';end if;to_day:=(data->>'to')::date;
 end if;
 if from_day>to_day then raise exception 'The ending date must be on or after the starting date';end if;
 if exporting and offset_n<>0 then raise exception 'Export the complete selection from its beginning';end if;
 if entity is not null and kind not in('credit_invoices','credit_payments','supplier_invoices','supplier_payments') then raise exception 'An account filter is only valid for customer or supplier records';end if;
 with source as materialized(
  select s.id::text id,s.occurred_at at,jsonb_build_object('reference',s.receipt,'party',coalesce((select i.client_snapshot->>'name' from public.credit_invoices i where i.sale_id=s.id),''),'mode',s.payment_mode,'amount',s.total::text,'cash',case when s.payment_mode='cash' then s.total::text else s.cash_received::text end,'tender',case when s.payment_mode='cash' then s.cash_received::text else null end,'change',case when s.payment_mode='cash' then (s.cash_received-s.total)::text else null end,'status',case when exists(select 1 from public.sale_refund_corrections r where r.sale_id=s.id) then 'corrected' when exists(select 1 from public.sale_reversals r where r.sale_id=s.id) then 'refunded' when exists(select 1 from public.sale_partial_refunds r where r.sale_id=s.id) then 'partial' when cardinality(s.flags)>0 then 'review' else 'completed' end) doc
  from public.sales s where kind='receipts' and s.organization_id=org and s.branch_id=branch
  union all
  select i.sale_id::text,i.issued_at,jsonb_build_object('reference',i.official_reference,'party',i.client_snapshot->>'name','source',i.source,'due',app_private.credit_due(org,i.sale_id),'amount',i.amount::text,'paid',(i.amount-app_private.credit_balance(org,i.sale_id)-c.credited)::text,'credited',c.credited::text,'balance',app_private.credit_balance(org,i.sale_id)::text,'status',case when app_private.credit_balance(org,i.sale_id)=0 then 'paid' when app_private.credit_balance(org,i.sale_id)<i.amount then 'partial' else 'unpaid' end)
  from public.credit_invoices i cross join lateral(select coalesce(sum(e.amount),0) credited from public.credit_entries e where e.organization_id=org and e.invoice_id=i.sale_id and e.kind='credit_note')c where kind='credit_invoices' and i.organization_id=org and i.branch_id=branch and (entity is null or i.client_id=entity)
  union all
  select e.id::text,e.created_at,jsonb_build_object('reference',e.reference,'party',i.client_snapshot->>'name','invoice',i.official_reference,'type',e.kind,'amount',e.amount::text,'cash',(select coalesce(sum(p.amount),0)::text from public.payments p where p.organization_id=org and p.credit_entry_id=e.id),'description',e.reason,'status',e.kind)
  from public.credit_entries e join public.credit_invoices i on i.organization_id=e.organization_id and i.sale_id=e.invoice_id where kind='credit_payments' and e.organization_id=org and e.branch_id=branch and (entity is null or i.client_id=entity)
  union all
  select b.id::text,b.issued_on::timestamp at time zone 'Asia/Manila',jsonb_build_object('reference',b.reference,'party',b.supplier_name,'due',b.due_on,'amount',b.amount::text,'paid',s.doc->>'paid','credited',s.doc->>'credited','balance',s.doc->>'balance','description',b.description,'status',case when (s.doc->>'voided')::boolean then 'voided' when (s.doc->>'balance')::numeric=0 then 'paid' when (s.doc->>'paid')::numeric>0 or (s.doc->>'credited')::numeric>0 then 'partial' else 'unpaid' end)
  from public.supplier_bills b cross join lateral(select app_private.supplier_bill_state(org,b.id) doc)s where kind='supplier_invoices' and b.organization_id=org and b.branch_id=branch and (entity is null or b.supplier_id=entity)
  union all
  select e.id::text,e.happened_on::timestamp at time zone 'Asia/Manila',jsonb_build_object('reference',e.reference,'party',b.supplier_name,'invoice',b.reference,'type',e.kind,'amount',e.amount::text,'method',e.method,'description',e.reason,'recordedAt',e.created_at,'status',e.kind)
  from public.supplier_bill_entries e join public.supplier_bills b on b.organization_id=e.organization_id and b.id=e.bill_id where kind='supplier_payments' and e.organization_id=org and e.branch_id=branch and (entity is null or b.supplier_id=entity)
  union all
  select m.id::text,m.created_at,jsonb_build_object('reference',m.source_id,'party',p.name,'sku',p.sku,'type',m.kind,'quantity',m.quantity::text,'unit',p.base_unit,'lot',b.lot,'status',m.kind)
  from public.inventory_movements m join public.products p on p.organization_id=m.organization_id and p.id=m.product_id left join public.product_batches b on b.organization_id=m.organization_id and b.id=m.batch_id where kind='stock' and m.organization_id=org and m.branch_id=branch
  union all
  select r.id::text,r.created_at,jsonb_build_object('reference',r.reference,'party',coalesce(s.name,''),'type',r.source,'description',(select string_agg(x->>'name',', ') from jsonb_array_elements(r.payload->'items')x),'status',r.source)
  from public.purchase_receipts r left join public.suppliers s on s.organization_id=r.organization_id and s.id=r.supplier_id where kind='purchases' and r.organization_id=org and r.branch_id=branch
  union all
  select a.id::text,a.created_at,jsonb_build_object('reference',a.source_id,'type',a.action,'party',coalesce((select m.name from public.staff_memberships m where m.organization_id=org and m.user_id=a.actor_id order by m.active desc limit 1),a.actor_id::text),'description',coalesce(a.details->>'reason',''),'status',a.action)
  from public.audit_events a where kind='audit' and a.organization_id=org and (a.branch_id=branch or a.branch_id is null)
 ), filtered as materialized(
  select id,at,doc||jsonb_build_object('id',id,'at',at) doc from source
  where (from_day is null or at>=from_day::timestamp at time zone 'Asia/Manila') and (to_day is null or at<(to_day+1)::timestamp at time zone 'Asia/Manila')
  and (q='' or position(lower(q) in lower(concat_ws(' ',id,doc->>'reference',doc->>'party',doc->>'invoice',doc->>'sku',doc->>'description')))>0)
  and (status='all' or status='outstanding' and (doc->>'balance')::numeric>0 or status='paid' and doc->>'status'='paid' or status='overdue' and (doc->>'balance')::numeric>0 and (doc->>'due')::date<today or status='unconfirmed' and (doc->>'balance')::numeric>0 and doc->>'due' is null or status not in('outstanding','paid','overdue','unconfirmed') and doc->>'status'=status)
 ), page as(select doc,at,id from filtered order by at desc,id desc limit case when exporting then 10001 else 25 end offset offset_n)
 select jsonb_build_object('organizationId',org,'branchId',branch,'kind',kind,'asOf',statement_timestamp(),'filters',jsonb_build_object('query',q,'status',status,'from',coalesce(from_day::text,''),'to',coalesce(to_day::text,'')),'rows',coalesce((select jsonb_agg(doc order by at desc,id desc) from page),'[]'::jsonb),'total',(select count(*) from filtered),'next',case when not exporting and (select count(*) from filtered)>offset_n+25 then offset_n+25 else null end,'complete',exporting) into result;
 result:=result||jsonb_build_object('entityId',coalesce(entity::text,''));
 if exporting and (result->>'total')::bigint>10000 then raise exception 'This selection exceeds 10,000 records. Choose a shorter date range or a more specific search; no partial file was exported';end if;
 return result;
end$$;

do $$declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.supplier_account_book(uuid,uuid,jsonb)'::regprocedure);
 anchor:='status not in(''all'',''unpaid''';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier status validation changed';end if;
 src:=replace(src,anchor,'status not in(''all'',''outstanding'',''unpaid''');
 anchor:='when ''unpaid'' then';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Supplier outstanding filter changed';end if;
 src:=replace(src,anchor,E'when ''outstanding'' then not (doc->>''voided'')::boolean and (doc->>''balance'')::bigint>0\n '||anchor);
 execute src;
end$$;
revoke all on function app_private.record_report(jsonb) from public,anon,authenticated;

do $$declare src text;anchor text:=' if action not in (''configure_cashier_pcs''';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Cashier command dispatcher changed';end if;
 src:=replace(src,anchor,E' if action=''record_report'' then return app_private.record_report(data);end if;\n'||anchor);
 execute src;
end$$;
