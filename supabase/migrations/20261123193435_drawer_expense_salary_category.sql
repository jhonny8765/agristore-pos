-- Extend the category allowlists in the existing drawer validators. Preserve
-- drawer ownership, original-request handling, and the cash ledger rules.
do $migration$
declare
  validator regprocedure;
  definition text;
  existing_categories constant text := $list$'transport','fuel','meals','supplies','utilities','repairs','miscellaneous'$list$;
  salary_categories constant text := $list$'transport','fuel','meals','supplies','utilities','repairs','salary','miscellaneous'$list$;
begin
  foreach validator in array array[
    'app_private.expense_metadata(jsonb)'::regprocedure,
    'app_private.drawer_expense_command_before_owner(text,jsonb)'::regprocedure
  ]
  loop
    definition := pg_get_functiondef(validator);
    if strpos(definition, salary_categories) > 0 and strpos(definition, existing_categories) = 0 then
      continue;
    end if;
    if (length(definition) - length(replace(definition, existing_categories, ''))) <> length(existing_categories) then
      raise exception 'Expected one existing expense category list in %', validator;
    end if;
    execute replace(definition, existing_categories, salary_categories);
  end loop;
end
$migration$;
