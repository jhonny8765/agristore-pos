-- Exact retries are acknowledgments of a saved original, even after its branch
-- is disabled. The original handler still checks session, membership, payload,
-- organization, branch and cashier identity. No new inactive-branch sale is allowed.
do $inactive_original_retry$
declare definition text;anchor text:=' select b.multi_pc into enabled';
begin
 definition:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
  raise exception 'Multiple-PC dispatcher changed; review the retry boundary';
 end if;
 definition:=replace(definition,anchor,E' if action=''record_sale'' and exists(select 1 from public.sales s where s.id=(data->>''transactionId'')::uuid and s.organization_id=org and s.branch_id=branch and s.cashier_id=uid and s.payload=data) then return app_private.command_before_multiple_pcs(action,data);end if;\n'||anchor);
 execute definition;
end $inactive_original_retry$;
