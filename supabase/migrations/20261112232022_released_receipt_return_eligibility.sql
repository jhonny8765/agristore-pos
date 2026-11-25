-- Only releases from destination receipt holds for this original line add
-- returnable shelf custody. Disposals and source compensation are excluded.
do $fix$
declare src text; old text := 'if base_q>t.received_quantity-prior_return then'; replacement text := $sql$if base_q>t.received_quantity + coalesce((
    select sum((d.payload->>'quantity')::numeric)
    from public.stock_holds receipt_hold
    join public.stock_control_events receipt on receipt.id=receipt_hold.source_id
    join public.stock_control_events d on d.organization_id=receipt_hold.organization_id
      and d.source_id=receipt_hold.id and d.action='disposition_hold'
      and d.payload->>'disposition'='release'
    where receipt_hold.organization_id=org and receipt_hold.branch_id=src
      and receipt.organization_id=org and receipt.action='receive_transfer'
      and receipt.source_id=l.id
   ),0)-prior_return then$sql$;
begin
 src:=pg_get_functiondef('app_private.return_branch_shipment(jsonb)'::regprocedure);
 if strpos(src,old)=0 then raise exception 'Review return eligibility'; end if;
 execute replace(src,old,replacement);
end $fix$;
