-- Read-only register mode shares the existing account calculations and permission gate.
-- Legacy callers keep the four-argument snapshot and its invoice-history behavior.
do $register_snapshot$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.credit_book_snapshot(uuid,uuid,uuid,integer)'::regprocedure);
 anchor:='credit_book_snapshot(org uuid, branch uuid, client_filter uuid, offset_n integer)';
 if position(anchor in src)=0 then raise exception 'Credit snapshot signature changed';end if;
 src:=replace(src,anchor,'credit_book_snapshot(org uuid, branch uuid, client_filter uuid, offset_n integer, include_history boolean)');
 anchor:='limit 50 offset offset_n';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit history page changed';end if;
 src:=replace(src,anchor,'limit (case when include_history then 50 else 0 end) offset offset_n');
 anchor:='case when n>offset_n+50 then offset_n+50 else null end';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit history cursor changed';end if;
 execute replace(src,anchor,'case when include_history and n>offset_n+50 then offset_n+50 else null end');
 src:=pg_get_functiondef('app_private.credit_command(text,jsonb)'::regprocedure);
 anchor:='  return app_private.credit_book_snapshot(org,branch,client_filter,offset_n);';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Credit read permission route changed';end if;
 execute replace(src,anchor,$route$  if data ? 'includeHistory' and jsonb_typeof(data->'includeHistory') is distinct from 'boolean' then raise exception 'Choose a valid credit history view';end if;
  if data->>'includeHistory'='false' then
   if client_filter is not null or offset_n<>0 then raise exception 'The account register does not have invoice pages';end if;
   return app_private.credit_book_snapshot(org,branch,null::uuid,0,false);
  end if;
  return app_private.credit_book_snapshot(org,branch,client_filter,offset_n);$route$);
end$register_snapshot$;
revoke all on function app_private.credit_book_snapshot(uuid,uuid,uuid,integer,boolean) from public,anon,authenticated;
