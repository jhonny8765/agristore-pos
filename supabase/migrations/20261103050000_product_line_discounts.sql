-- Percent discounts are per-sale evidence; catalog prices/costs stay unchanged.
-- Basis points keep the entered percentage exact (10.25% = 1025).
create function app_private.discounted_sale_line(item jsonb,quantity numeric,unit_price bigint,org uuid,branch uuid) returns bigint
language plpgsql stable set search_path='' as $$
declare gross numeric;discount numeric;bps integer:=0;
begin
 if item?'discountBps' then
  if jsonb_typeof(item->'discountBps') is distinct from 'number' or (item->>'discountBps')!~'^\d{1,5}$' then raise exception 'Discount percentage must use whole basis points';end if;
  bps:=(item->>'discountBps')::integer;
  if bps not between 0 and 10000 then raise exception 'Discount must be between 0 and 100 percent';end if;
 end if;
 if bps>0 and not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.role='cashier' and m.branch_id=branch))) then raise exception 'Only the owner or cashier may apply a product discount' using errcode='42501';end if;
 gross:=round(quantity*unit_price);
 if gross is null or gross<0 or gross>9007199254740991 then raise exception 'Line amount is outside the supported range';end if;
 discount:=round(gross*bps/10000);
 return (gross-discount)::bigint;
end$$;
revoke all on function app_private.discounted_sale_line(jsonb,numeric,bigint,uuid,uuid) from public,anon,authenticated;

-- Patch arithmetic at the existing authoritative price checks without renaming
-- any dispatcher or changing original request identities/legacy cash payloads.
do $discount_validation$
declare definition text;anchor text;patched text;
begin
 definition:=pg_get_functiondef('app_private.command_legacy(text,jsonb)'::regprocedure);
 anchor:='amount:=round(q*price.price)::bigint;';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'Cash price-validation anchor changed; inspect before applying discounts';end if;
 patched:=replace(definition,anchor,'amount:=app_private.discounted_sale_line(row_item,q,price.price,org,branch);');
 execute patched;
 definition:=pg_get_functiondef('app_private.credit_command(text,jsonb)'::regprocedure);
 anchor:='amount:=round(q*pr.price)::bigint;';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'Credit price-validation anchor changed; inspect before applying discounts';end if;
 patched:=replace(definition,anchor,'amount:=app_private.discounted_sale_line(row_item,q,pr.price,org,branch);');
 execute patched;
end
$discount_validation$;
