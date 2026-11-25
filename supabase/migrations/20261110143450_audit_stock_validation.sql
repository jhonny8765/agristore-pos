-- Tighten the original stock posting branches without replacing their permission,
-- locking or duplicate-request paths, and without rewriting existing stock/history.
do $stock_validation$
declare src text;anchor text;
begin
 src:=pg_get_functiondef('app_private.command_legacy(text,jsonb)'::regprocedure);
 anchor:=$old$   if q<=0 or scale(trim_scale(q))>6 then raise exception 'Invalid receiving quantity'; end if;$old$;
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Receiving quantity validation changed';end if;
 src:=replace(src,anchor,$new$   if q is null or q in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or q<=0 or q>=100000000000000 or scale(trim_scale(q))>6 then raise exception 'Invalid receiving quantity'; end if;
   if prod.base_unit='piece' and q<>trunc(q) then raise exception 'Piece stock must be a whole number'; end if;$new$);

 anchor:=$old$   if prod.tracks_expiry and nullif(row_item->>'expiresOn','') is null then raise exception 'Expiry date is required'; end if;$old$;
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Receiving expiry validation changed';end if;
 src:=replace(src,anchor,anchor||$new$
   if source='purchase' and nullif(row_item->>'expiresOn','')::date<(now() at time zone 'Asia/Manila')::date then raise exception 'Expired goods cannot be accepted for sale; hold or reject them'; end if;$new$);

 anchor:=$old$  q:=(data->>'quantity')::numeric; b_id:=(data->>'batchId')::uuid;
  select quantity into factor from public.branch_inventory$old$;
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Transfer dispatch quantity validation changed';end if;
 src:=replace(src,anchor,$new$  q:=(data->>'quantity')::numeric; b_id:=(data->>'batchId')::uuid;
  if q is null or q in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) or q<=0 or q>=100000000000000 or scale(trim_scale(q))>6 then raise exception 'Invalid transfer quantity'; end if;
  if (select p.base_unit from public.products p where p.organization_id=org and p.id=(data->>'productId')::uuid)='piece' and q<>trunc(q) then raise exception 'Piece stock must be a whole number'; end if;
  select quantity into factor from public.branch_inventory$new$);
 execute src;
end $stock_validation$;
