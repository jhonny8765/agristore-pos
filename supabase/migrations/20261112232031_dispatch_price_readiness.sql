-- Dispatchers can see readiness, never destination prices or price history.
create function app_private.dispatch_price_readiness(data jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;src uuid:=(data->>'branchId')::uuid;dst uuid:=(data->>'destinationBranchId')::uuid; answer jsonb;requested integer;
begin
 if not app_private.network_enabled(org) or not app_private.can_access(org,src) or src is distinct from app_private.network_hub(org) or dst=src
 or not app_private.network_branch_allowed(org,dst)
 or not exists(select 1 from app_private.branch_network_branches n where n.organization_id=org and n.branch_id=dst and n.can_receive)
 or not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.role='manager' and m.branch_id=src))) then raise exception 'Dispatch price readiness is unavailable' using errcode='42501';end if;
 if jsonb_typeof(data->'unitIds') is distinct from 'array' or jsonb_array_length(data->'unitIds') not between 1 and 100 or exists(select 1 from jsonb_array_elements(data->'unitIds') x where jsonb_typeof(x)<>'string' or (x#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Choose valid shipment units' using errcode='22023';end if;
 select count(distinct (x#>>'{}')::uuid) into requested from jsonb_array_elements(data->'unitIds') x;
 if requested<>(select count(*) from public.product_units u join public.products p on p.id=u.product_id and p.organization_id=u.organization_id where u.organization_id=org and p.active and u.id in(select (x#>>'{}')::uuid from jsonb_array_elements(data->'unitIds') x)) then raise exception 'Shipment unit not found' using errcode='22023';end if;
 select jsonb_build_object('destinationBranchId',dst,'units',coalesce(jsonb_agg(jsonb_build_object('unitId',u.id,'ready',not p.setup_pending and exists(select 1 from app_private.branch_unit_prices v where v.organization_id=org and v.branch_id=dst and v.unit_id=u.id)) order by u.id),'[]'::jsonb)) into answer
 from public.product_units u join public.products p on p.id=u.product_id and p.organization_id=u.organization_id where u.organization_id=org and u.id in(select (x#>>'{}')::uuid from jsonb_array_elements(data->'unitIds') x);
 return answer;
end$$;
revoke all on function app_private.dispatch_price_readiness(jsonb) from public,anon,authenticated;
do $route$ declare src text;anchor text:='answer:=app_private.command_before_original_action_journal(action,data);';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if strpos(src,anchor)=0 then raise exception 'Review dispatch readiness routing';end if;
 execute replace(src,anchor,'if action=''branch_dispatch_price_readiness'' then return app_private.dispatch_price_readiness(data);end if;'||E'\n '||anchor);
end $route$;
