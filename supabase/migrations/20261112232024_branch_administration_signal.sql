-- Report the server's fixed-administration decision without exposing entitlement details.
do $fix$ declare src text; old text := 'return jsonb_build_object(''enabled'','; begin
 src:=pg_get_functiondef('app_private.branch_network(uuid)'::regprocedure);
 if strpos(src,old)=0 then raise exception 'Review branch administration response'; end if;
 execute replace(src,old,'return jsonb_build_object(''managed'',managed,''enabled'',');
end $fix$;
