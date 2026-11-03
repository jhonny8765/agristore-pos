-- Keep the deployed archive safeguard intact after its containing command was
-- renamed by the credit migration. A local variable survives later renames.
do $repair_archive_scope$
declare definition text;
begin
 if to_regprocedure('app_private.command_before_customer_credit(text,jsonb)') is null then
  raise exception 'Apply customer credit before its archive compatibility repair';
 end if;
 definition:=pg_get_functiondef('app_private.command_before_customer_credit(text,jsonb)'::regprocedure);
 if position('jsonb_each_text(command.data)' in definition)>0 then
  if position('archive_request_data jsonb:=data' in definition)=0 then
   if position('declare org uuid:=' in definition)=0 then
    raise exception 'Unrecognized archive command declaration. Preserve it for manual inspection';
   end if;
   definition:=replace(definition,'declare org uuid:=','declare archive_request_data jsonb:=data; org uuid:=');
  end if;
  definition:=replace(definition,'jsonb_each_text(command.data)','jsonb_each_text(archive_request_data)');
  if position('command.data' in definition)>0 then raise exception 'Unrepaired command parameter reference';end if;
  execute definition;
 end if;
end
$repair_archive_scope$;
