-- Capture the public action, full original payload and result atomically for
-- new stable financial requests. Never manufacture entries for legacy retries.
create table app_private.branch_original_acknowledgments(
 organization_id uuid not null,branch_id uuid not null,original_id uuid not null,action text not null,
 actor_id uuid not null references auth.users(id),payload jsonb not null,result jsonb not null,created_at timestamptz not null default now(),
 primary key(organization_id,action,original_id),foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
create unique index original_ack_identity on app_private.branch_original_acknowledgments(organization_id,original_id);
alter table app_private.branch_original_acknowledgments enable row level security;
revoke all on app_private.branch_original_acknowledgments from public,anon,authenticated;
create trigger immutable_original_ack before update or delete on app_private.branch_original_acknowledgments for each row execute function app_private.immutable();

create function app_private.financial_original_id(action text,data jsonb) returns uuid language plpgsql immutable set search_path='' as $$begin
 if action in('record_sale','record_online_sale') then return (data->>'transactionId')::uuid;
 elsif action in('refund_sale','partial_refund_sale') then return (data->>'refundId')::uuid;
 elsif action='correct_refund' then return (data->>'correctionId')::uuid;
 elsif action in('record_credit_sale','collect_credit_payment','reverse_credit_collection','credit_refund','set_credit_due_date','save_credit_client','supplier_record_invoice','supplier_record_payment','supplier_credit_note','supplier_reverse_entry','supplier_void_invoice','supplier_create_order','supplier_receive_purchase','review_product_price','review_import_setup','publish_branch_unit_price','copy_branch_unit_prices') then return (data->>'requestId')::uuid;
 end if;return null;
end$$;
create function app_private.has_original_action_journal(action text,data jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.branch_original_acknowledgments j where j.organization_id=($2->>'organizationId')::uuid and j.original_id=app_private.financial_original_id($1,$2)
)
$$;
create function app_private.exact_original_action_ack(action text,data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare j app_private.branch_original_acknowledgments;result jsonb;
begin
 select x.* into j from app_private.branch_original_acknowledgments x where x.organization_id=(data->>'organizationId')::uuid and x.branch_id=(data->>'branchId')::uuid and x.original_id=app_private.financial_original_id(action,data) and x.action=action and x.actor_id=auth.uid() and x.payload=data;
 if j.original_id is null or not app_private.membership_access(j.organization_id,j.branch_id) then return null;end if;
 if action in('record_sale','record_online_sale') then
  if not app_private.membership_checkout(j.organization_id,j.branch_id) then return null;end if;
  return j.result||'{"status":"duplicate"}'::jsonb;
 end if;
 -- Existing immutable event journals retain action-specific duplicate contracts.
 result:=app_private.financial_original_ack(action,data);
 return result;
end$$;
revoke all on function app_private.financial_original_id(text,jsonb),app_private.has_original_action_journal(text,jsonb),app_private.exact_original_action_ack(text,jsonb) from public,anon,authenticated;

do $guard$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.network_original_ack(text,jsonb)'::regprocedure);
 anchor:='if app_private.financial_original_ack(action,data) is not null then';
 if strpos(src,anchor)=0 then raise exception 'Review journal acknowledgment routing';end if;
 execute replace(src,anchor,'if app_private.has_original_action_journal(action,data) then return app_private.exact_original_action_ack(action,data);end if;'||E'\n  '||anchor);
 src:=pg_get_functiondef('app_private.recover_financial_original(jsonb)'::regprocedure);
 anchor:='if a in(''record_sale'',''record_online_sale'') then';
 if strpos(src,anchor)=0 then raise exception 'Review journal recovery routing';end if;
 execute replace(src,anchor,'if app_private.has_original_action_journal(a,original) then answer:=app_private.exact_original_action_ack(a,original);'||E'\n elsif a in(''record_sale'',''record_online_sale'') then');
end $guard$;

alter function app_private.command(text,jsonb) rename to command_before_original_action_journal;
revoke all on function app_private.command_before_original_action_journal(text,jsonb) from public,anon,authenticated;
create function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare ident uuid;org uuid;branch uuid;answer jsonb;
begin
 perform app_private.require_enabled_branch(action,data);
 ident:=app_private.financial_original_id(action,data);
 if ident is not null then
  org:=(data->>'organizationId')::uuid;branch:=(data->>'branchId')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(org::text||':financial-original:'||ident::text,0));
  if exists(select 1 from app_private.branch_original_acknowledgments j where j.organization_id=org and j.original_id=ident and j.action<>command.action) then
   raise exception 'The original action does not match the saved request' using errcode='42501';end if;
 end if;
 answer:=app_private.command_before_original_action_journal(action,data);
 if ident is not null and coalesce(answer->>'duplicate','false')<>'true'
 and (action not in('record_sale','record_online_sale') or answer->>'status'='created') then
  insert into app_private.branch_original_acknowledgments(organization_id,branch_id,original_id,action,actor_id,payload,result) values(org,branch,ident,action,auth.uid(),data,answer);
 end if;
 return answer;
end$$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;
