-- Fixed centavo discounts apply to the entire product line. Retain legacy
-- percentage evidence so old receipts and unresolved original retries still work.
create or replace function app_private.discounted_sale_line(item jsonb,quantity numeric,unit_price bigint,org uuid,branch uuid) returns bigint
language plpgsql stable set search_path='' as $$
declare gross numeric;discount numeric;bps integer:=0;
begin
 if item?'discountAmount' and item?'discountBps' then raise exception 'Use one discount amount per product line';end if;
 if item?'discountBps' then
  if jsonb_typeof(item->'discountBps') is distinct from 'number' or (item->>'discountBps')!~'^\d{1,5}$' then raise exception 'Discount percentage must use whole basis points';end if;
  bps:=(item->>'discountBps')::integer;
  if bps not between 0 and 10000 then raise exception 'Discount must be between 0 and 100 percent';end if;
 end if;
 gross:=round(quantity*unit_price);
 if gross is null or gross<0 or gross>9007199254740991 then raise exception 'Line amount is outside the supported range';end if;
 if item?'discountAmount' then
  if jsonb_typeof(item->'discountAmount') is distinct from 'number' or (item->>'discountAmount')!~'^\d{1,16}$' then raise exception 'Discount amount must use exact non-negative centavos';end if;
  discount:=(item->>'discountAmount')::numeric;
  if discount>9007199254740991 or discount>gross then raise exception 'Discount cannot exceed this product line total';end if;
 else discount:=round(gross*bps/10000);end if;
 if discount>0 and not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=auth.uid() and m.active and (m.role='owner' or (m.role='cashier' and m.branch_id=branch))) then raise exception 'Only the owner or cashier may apply a product discount' using errcode='42501';end if;
 return (gross-discount)::bigint;
end$$;
revoke all on function app_private.discounted_sale_line(jsonb,numeric,bigint,uuid,uuid) from public,anon,authenticated;
