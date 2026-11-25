-- Page offsets alone cannot prove that earlier invoice balances still match.
-- Hash the complete read model in the same statement snapshot as each page.
-- Includes effective balances/dates, all entries (not just the current page),
-- client profiles and the Manila day used by the aging calculations.
-- No stored business data or authorization routes are changed.
do $credit_revision$ declare signature text;src text;anchor text;replacement text;begin
 anchor:='select jsonb_build_object(''asOf'',statement_timestamp(),''clients''';
 replacement:=$revision$select jsonb_build_object('asOf',statement_timestamp(),'snapshotRevision',md5(jsonb_build_object(
  'day',(now() at time zone 'Asia/Manila')::date,
  'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by d.sale_id),'[]'::jsonb) from docs d),
  'clients',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb) from clients c),
  'entries',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) from public.credit_entries e where e.organization_id=org and e.branch_id=branch and e.invoice_id in(select sale_id from docs))
 )::text),'clients'$revision$;
 foreach signature in array array['app_private.credit_book_snapshot(uuid,uuid,uuid,integer)','app_private.credit_book_snapshot(uuid,uuid,uuid,integer,boolean)'] loop
  src:=pg_get_functiondef(signature::regprocedure);
  if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit snapshot read model changed: %',signature;end if;
  if signature='app_private.credit_book_snapshot(uuid,uuid,uuid,integer,boolean)' then
   execute replace(src,anchor,replace(replace(replacement,'''snapshotRevision'',md5','''snapshotRevision'',case when include_history then md5'),')::text),''clients''',')::text) else null end,''clients'''));
  else execute replace(src,anchor,replacement);end if;
 end loop;
end$credit_revision$;
