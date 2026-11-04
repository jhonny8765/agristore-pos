-- Refresh exact decimal strings after the fixed-branch projection has selected its scope.
-- No business rows, authorization, queries, or numeric values are changed.
do $fixed_branch_exact_totals$
declare definition text;
begin
 definition:=pg_get_functiondef('app_private.fixed_branch_dashboard(uuid,uuid)'::regprocedure);
 if (length(definition)-length(replace(definition,'return jsonb_build_object(','')))/length('return jsonb_build_object(')<>1
    or (length(definition)-length(replace(definition,E' );\nend','')))/length(E' );\nend')<>1 then
  raise exception 'Fixed branch dashboard shape changed; review before applying';
 end if;
 definition:=replace(definition,'return jsonb_build_object(','return app_private.exact_dashboard(jsonb_build_object(');
 definition:=replace(definition,E' );\nend',E' ));\nend');
 execute definition;
end $fixed_branch_exact_totals$;
