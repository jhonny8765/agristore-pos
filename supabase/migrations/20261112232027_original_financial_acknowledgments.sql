-- Exact acknowledgments are reconstructed only from existing immutable journals.
-- No history is guessed or backfilled and no new commercial operation is run.
create function app_private.financial_original_ack(action text,data jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;
 ident uuid; e public.stock_control_events; r app_private.branch_price_requests; saved jsonb; owner_access boolean;
begin
 if org is null or branch is null or not app_private.membership_access(org,branch)
 or not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch) then return null;end if;
 owner_access:=exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and m.role='owner');
 if action in('publish_branch_unit_price','copy_branch_unit_prices') then
  if not owner_access then return null;end if;
  ident:=(data->>'requestId')::uuid;
  select * into r from app_private.branch_price_requests x where x.id=ident and x.organization_id=org and x.actor_id=auth.uid() and x.payload=data and (x.payload->>'branchId')::uuid=branch;
  if found and ((action='publish_branch_unit_price' and r.result ? 'branchPriceId') or (action='copy_branch_unit_prices' and r.result ? 'count')) then return r.result||'{"duplicate":true}'::jsonb;end if;
  return null;
 end if;
 if action in('record_credit_sale','collect_credit_payment','reverse_credit_collection','credit_refund','set_credit_due_date','save_credit_client',
  'supplier_record_invoice','supplier_record_payment','supplier_credit_note','supplier_reverse_entry','supplier_void_invoice','supplier_create_order','supplier_receive_purchase','review_product_price','review_import_setup') then
  ident:=(data->>'requestId')::uuid;
 elsif action in('refund_sale','partial_refund_sale') then ident:=(data->>'refundId')::uuid;
 elsif action='correct_refund' then ident:=(data->>'correctionId')::uuid;
 else return null;end if;
 if ident is null then return null;end if;
 if action in('record_credit_sale','collect_credit_payment') then
  if not app_private.membership_checkout(org,branch) then return null;end if;
 elsif not owner_access then return null;end if;
 select * into e from public.stock_control_events x where x.id=ident and x.organization_id=org and x.branch_id=branch and x.actor_id=auth.uid() and x.action=action and x.payload=data;
 if not found then return null;end if;
 if action in('supplier_create_order','supplier_receive_purchase') then
  select a.details->'result' into saved from public.audit_events a where a.organization_id=org and a.branch_id=branch and a.actor_id=auth.uid() and a.action=action and a.source_id=ident order by a.id desc limit 1;
  return case when saved is null then null else saved||'{"duplicate":true}'::jsonb end;
 elsif action in('supplier_record_invoice','supplier_record_payment','supplier_credit_note','supplier_reverse_entry','supplier_void_invoice') then
  return jsonb_build_object('id',ident,'billId',e.source_id,'duplicate',true);
 elsif action in('record_credit_sale','collect_credit_payment','reverse_credit_collection','credit_refund','set_credit_due_date','save_credit_client') then
  return jsonb_build_object('id',ident,'sourceId',e.source_id,'duplicate',true);
 elsif action='partial_refund_sale' then
  select jsonb_build_object('id',ident,'amount',p.amount,'duplicate',true) into saved from public.sale_partial_refunds p where p.id=ident and p.organization_id=org and p.branch_id=branch and p.sale_id=e.source_id;
  return saved;
 else return jsonb_build_object('id',ident,'duplicate',true);end if;
end $$;
revoke all on function app_private.financial_original_ack(text,jsonb) from public,anon,authenticated;

-- A dedicated read-only route allows a signed-in original actor to reconcile
-- only an exact saved financial/price result, even when branch trading is off.
create function app_private.recover_financial_original(data jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a text:=data->>'originalAction'; original jsonb:=data->'originalData'; answer jsonb;
begin
 if jsonb_typeof(original)<>'object' or data->>'organizationId' is distinct from original->>'organizationId' or data->>'branchId' is distinct from original->>'branchId' then raise exception 'Original request scope is required' using errcode='42501';end if;
 if a in('record_sale','record_online_sale') then answer:=app_private.network_original_ack(a,original);
 else answer:=app_private.financial_original_ack(a,original);end if;
 if answer is null then raise exception 'No eligible committed original can be confirmed. Preserve the original.' using errcode='42501';end if;
 return answer;
end $$;
revoke all on function app_private.recover_financial_original(jsonb) from public,anon,authenticated;

do $route$ declare src text; anchor text;begin
 src:=pg_get_functiondef('app_private.network_original_ack(text,jsonb)'::regprocedure);
 anchor:='begin';
 if strpos(src,anchor)=0 then raise exception 'Review financial acknowledgment gateway';end if;
 src:=replace(src,anchor,anchor||E'\n  if app_private.financial_original_ack(action,data) is not null then return app_private.financial_original_ack(action,data);end if;');
 execute src;
 src:=pg_get_functiondef('app_private.require_enabled_branch(text,jsonb)'::regprocedure);
 anchor:='begin';if strpos(src,anchor)=0 then raise exception 'Review recovery gate';end if;
 execute replace(src,anchor,anchor||E'\n if action=''recover_financial_original'' then return;end if;');
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 anchor:='begin';if strpos(src,anchor)=0 then raise exception 'Review recovery dispatcher';end if;
 execute replace(src,anchor,anchor||E'\n if action=''recover_financial_original'' then return app_private.recover_financial_original(data);end if;');
end $route$;
