-- Keep legacy recorded-unit payloads and saved acknowledgments intact. New
-- explicit count modes always use the immutable shipment conversion.
do $fix$
declare src text; old text; replacement text;
begin
 src:=pg_get_functiondef('app_private.reconcile_branch_shipment(text,jsonb)'::regprocedure);
 old:='q:=q*l.factor;h:=h*l.factor;';
 replacement:=$sql$
  if (entry ? 'quantityMode' and (jsonb_typeof(entry->'quantityMode')<>'string' or entry->>'quantityMode' not in ('recorded','base')))
   or data ?| array['quantityMode','factor','baseUnit','unit']
   or entry ?| array['factor','baseUnit','unit','unitId'] then
   raise exception 'Invalid shipment count basis' using errcode='22023';end if;
  if coalesce(entry->>'quantityMode','recorded')='recorded' then q:=q*l.factor;h:=h*l.factor;end if;
 $sql$;
 if strpos(src,old)=0 then raise exception 'Review reconciliation count conversion';end if;
 src:=replace(src,old,replacement);
 old:='event_id:=gen_random_uuid();';
 replacement:=$sql$
  if entry ? 'quantityMode' then
   posted_lines:=jsonb_set(posted_lines,array[(jsonb_array_length(posted_lines)-1)::text],
    posted_lines->(jsonb_array_length(posted_lines)-1)||jsonb_build_object('quantityMode',entry->>'quantityMode')||
    case when loss then jsonb_build_object('quantityBase',trim_scale(q)::text)
    else jsonb_build_object('acceptedBase',trim_scale(q)::text,'heldBase',trim_scale(h)::text) end);
  end if;
  event_id:=gen_random_uuid();
 $sql$;
 if strpos(src,old)=0 then raise exception 'Review reconciliation acknowledgement';end if;
 execute replace(src,old,replacement);
 src:=pg_get_functiondef('app_private.return_branch_shipment(jsonb)'::regprocedure);
 old:=$old$q:=(entry->>'quantity')::numeric;base_q:=q*l.factor;$old$;
 replacement:=$sql$
  if (entry ? 'quantityMode' and (jsonb_typeof(entry->'quantityMode')<>'string' or entry->>'quantityMode' not in ('recorded','base')))
   or data ?| array['quantityMode','factor','baseUnit','unit']
   or entry ?| array['factor','baseUnit','unit','unitId'] then raise exception 'Invalid shipment count basis' using errcode='22023';end if;
  q:=(entry->>'quantity')::numeric;base_q:=case when coalesce(entry->>'quantityMode','recorded')='base' then q else q*l.factor end;
 $sql$;
 if strpos(src,old)=0 then raise exception 'Review return count conversion';end if;
 src:=replace(src,old,replacement);
 old:='out_lines:=out_lines||jsonb_build_array('; -- Attach count evidence after the complete original line is appended.
 -- Add to posted line before building the returned line.
 replacement:=$sql$
  if entry ? 'quantityMode' then
   posted_lines:=jsonb_set(posted_lines,array[(jsonb_array_length(posted_lines)-1)::text],posted_lines->(jsonb_array_length(posted_lines)-1)||jsonb_build_object('quantityMode',entry->>'quantityMode','quantityBase',trim_scale(base_q)::text));
  end if;
  out_lines:=out_lines||jsonb_build_array(
 $sql$;
 if strpos(src,old)=0 then raise exception 'Review return acknowledgement';end if;
 src:=replace(src,old,replacement);
 old:=' end loop;
 result:=jsonb_build_object';
 replacement:=$sql$
  if entry ? 'quantityMode' then
   out_lines:=jsonb_set(out_lines,array[(jsonb_array_length(out_lines)-1)::text],out_lines->(jsonb_array_length(out_lines)-1)||jsonb_build_object('quantityMode',entry->>'quantityMode','countUnit',case when entry->>'quantityMode'='base' then l.base_unit else l.unit_name end));
  end if;
 end loop;
 result:=jsonb_build_object$sql$;
 if strpos(src,old)=0 then raise exception 'Review return count unit';end if;
 execute replace(src,old,replacement);
 src:=pg_get_functiondef('app_private.shipment_projection(uuid,uuid)'::regprocedure);
 old:=$old$original||jsonb_build_object('accepted',$old$;
 replacement:=$sql$original||jsonb_build_object('acceptedBase',trim_scale(t.received_quantity)::text,'heldBase',trim_scale(t.held_quantity)::text,'lostBase',trim_scale(t.lost_quantity)::text,'returnedBase',trim_scale(t.returned_quantity)::text,'outstandingBase',trim_scale(t.quantity-t.received_quantity-t.held_quantity-t.lost_quantity-t.returned_quantity)::text,'accepted',$sql$;
 if strpos(src,old)=0 then raise exception 'Review shipment base projection';end if;
 execute replace(src,old,replacement);
end $fix$;
