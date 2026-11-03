-- Owner questions are metadata. They never change prices, stock or money.
alter table public.products add column owner_review jsonb;
alter table public.products add constraint product_owner_review_object check(owner_review is null or (jsonb_typeof(owner_review)='object' and jsonb_typeof(owner_review->'questions')='array' and jsonb_typeof(owner_review->'categories')='array'));

create function app_private.owner_review_revision(p public.products) returns text language sql stable set search_path='' as $$
 select md5(jsonb_build_object('name',p.name,'active',p.active,'base',p.base_unit,'unitPending',p.setup_pending,'pricePending',p.price_pending,'costPending',p.cost_pending,'sourceStock',p.source_stock,
 'questions',p.owner_review->'questions','categories',p.owner_review->'categories',
 'units',(select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'factor',u.factor,'version',u.price_version,'price',v.price,'cost',v.cost) order by u.id)
 from public.product_units u join public.unit_prices v on v.organization_id=u.organization_id and v.unit_id=u.id and v.version=u.price_version where u.organization_id=p.organization_id and u.product_id=p.id))::text)
$$;
revoke all on function app_private.owner_review_revision(public.products) from public,anon,authenticated;

create or replace function app_private.with_source_stock(snapshot jsonb,data jsonb) returns jsonb language sql stable set search_path='' as $$
 select case when snapshot->'products' is null then snapshot else jsonb_set(snapshot,'{products}',coalesce((
 select jsonb_agg(e.value||jsonb_build_object('sourceStock',case when p.source_stock->>'branchId'=data->>'branchId' then p.source_stock else null end,
 'ownerReview',case when p.owner_review is null then null else (p.owner_review-'reviewedRevision')||jsonb_build_object('revision',app_private.owner_review_revision(p),'complete',coalesce(p.owner_review->>'reviewedRevision'=app_private.owner_review_revision(p),false)) end) order by e.n)
 from jsonb_array_elements(snapshot->'products') with ordinality e(value,n)
 join public.products p on p.id=(e.value->>'id')::uuid and p.organization_id=(data->>'organizationId')::uuid),'[]')) end
$$;

create function app_private.complete_product_review(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;uid uuid:=auth.uid();ident uuid:=(data->>'requestId')::uuid;
 p public.products;previous public.stock_control_events;note text:=btrim(coalesce(data->>'note',''));revision text;
begin
 perform app_private.command_before_customer_credit('dashboard',data);
 if not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=uid and m.active and m.role='owner') then raise exception 'Only the owner can complete inventory reviews' using errcode='42501';end if;
 if not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch) then raise exception 'Choose a branch in this business';end if;
 if ident is null or data->'confirmed' is distinct from 'true'::jsonb or length(note) not between 3 and 1000 then raise exception 'Confirm every question and enter the owner answer or evidence';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
 select * into previous from public.stock_control_events e where e.organization_id=org and e.id=ident;
 if found then
  if previous.action<>'complete_product_review' or previous.branch_id<>branch or previous.actor_id<>uid or previous.payload<>data then raise exception 'This request reference belongs to a different review';end if;
  return jsonb_build_object('id',ident,'duplicate',true);
 end if;
 select * into p from public.products where organization_id=org and id=(data->>'productId')::uuid and active for update;
 if p.id is null or p.owner_review is null then raise exception 'Choose an active product with owner questions';end if;
 -- Unit/price edits lock products first too. The saved evidence is checked again here.
 revision:=app_private.owner_review_revision(p);
 if data->>'expectedReviewRevision' is distinct from revision then raise exception 'This product changed. Refresh and check its questions again';end if;
 if p.setup_pending or p.price_pending or p.cost_pending or p.source_stock->'pending'='true'::jsonb then raise exception 'Resolve the missing unit, price, cost and unposted stock before completing this review';end if;
 if p.owner_review->>'reviewedRevision'=revision then raise exception 'This product is already reviewed';end if;
 update public.products set owner_review=owner_review||jsonb_build_object('reviewedRevision',revision,'reviewedAt',now(),'reviewedBy',uid,'note',note) where id=p.id;
 insert into public.stock_control_events(id,organization_id,branch_id,action,source_id,actor_id,payload) values(ident,org,branch,'complete_product_review',p.id,uid,data);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,uid,'complete_product_review',p.id,jsonb_build_object('requestId',ident,'note',note,'revision',revision,'questions',p.owner_review->'questions','previousReview',p.owner_review));
 return jsonb_build_object('id',ident,'duplicate',false);
end$$;
revoke all on function app_private.complete_product_review(jsonb) from public,anon,authenticated;

do $route$declare src text;anchor text:=' if action in (''product_review_state''';begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Owner review dispatcher anchor changed';end if;
 execute replace(src,anchor,E' if action=''complete_product_review'' then return app_private.complete_product_review(data);end if;\n'||anchor);
end$route$;
