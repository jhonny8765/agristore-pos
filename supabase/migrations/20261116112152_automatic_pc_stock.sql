-- Automatic offline stock rights. This migration never enables a live branch.
create function app_private.offline_fair_share(
 quantity numeric, pack numeric, quantum numeric, devices integer, slot integer, rotation integer
) returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare packs numeric; loose_units numeric; position integer; result numeric;
begin
 if quantity is null or pack is null or quantum is null or devices is null or slot is null or rotation is null
 or quantity::text in('NaN','Infinity','-Infinity') or pack::text in('NaN','Infinity','-Infinity') or quantum::text in('NaN','Infinity','-Infinity')
 or quantity<0 or quantity>=100000000000000 or pack<=0 or quantum<=0
 or devices<1 or devices>10000 or slot<0 or slot>=devices or rotation<0 or rotation>=devices
 or scale(trim_scale(quantity))>6 or scale(trim_scale(pack))>6 or scale(trim_scale(quantum))>6 then
  raise exception 'Choose exact supported stock, pack, precision and cohort values' using errcode='22023';
 end if;
 if mod(quantity,quantum)<>0 or mod(pack,quantum)<>0 then
  raise exception 'Stock and pack quantities must use exact base precision' using errcode='22023';
 end if;
 position:=mod(slot-rotation+devices,devices);
 packs:=floor(quantity/pack);
 result:=(floor(packs/devices)+case when position<mod(packs,devices) then 1 else 0 end)*pack;
 loose_units:=(quantity-packs*pack)/quantum;
 result:=result+(floor(loose_units/devices)+case when position<mod(loose_units,devices) then 1 else 0 end)*quantum;
 return trim_scale(result);
end $$;
revoke all on function app_private.offline_fair_share(numeric,numeric,numeric,integer,integer,integer) from public,anon,authenticated;

-- Physical stock stays in the existing journal/projection. These are spending
-- rights, not extra stock and not a sale/hold movement.
create table app_private.offline_pc_configuration(
 organization_id uuid not null,branch_id uuid not null,enabled boolean not null default false,
 revision integer not null default 1 check(revision>0),cohort_devices uuid[] not null default '{}',
 configured_by uuid not null references auth.users(id),reason text not null,configured_at timestamptz not null default now(),
 primary key(organization_id,branch_id),foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
create table app_private.offline_pc_readiness(
 organization_id uuid not null,branch_id uuid not null,device_id uuid not null,actor_id uuid not null references auth.users(id),
 protocol integer not null check(protocol=2),client_release text not null,acknowledged_at timestamptz not null default now(),
 primary key(organization_id,device_id),foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,device_id) references public.devices(organization_id,id)
);
create table app_private.offline_pc_grants(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,branch_id uuid not null,
 device_id uuid not null,shift_id uuid not null,cashier_id uuid not null references auth.users(id),cohort_revision integer not null,
 issued_at timestamptz not null default now(),expires_at timestamptz not null,price_book jsonb not null check(jsonb_typeof(price_book)='array'),
 closed_at timestamptz,unique(organization_id,id),
 check(expires_at>issued_at and expires_at<=issued_at+interval '12 hours'),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(organization_id,device_id) references public.devices(organization_id,id),
 foreign key(organization_id,shift_id) references public.cashier_shifts(organization_id,id)
);
create unique index offline_pc_one_open_grant on app_private.offline_pc_grants(organization_id,device_id) where closed_at is null;
create table app_private.offline_pc_grant_lines(
 organization_id uuid not null,grant_id uuid not null,product_id uuid not null,batch_id uuid,
 batch_key uuid generated always as(coalesce(batch_id,'00000000-0000-0000-0000-000000000000'::uuid)) stored,
 granted_quantity numeric(20,6) not null check(granted_quantity>0),remaining_quantity numeric(20,6) not null,
 expires_on date,primary key(grant_id,product_id,batch_key),check(remaining_quantity>=0 and remaining_quantity<=granted_quantity),
 foreign key(organization_id,grant_id) references app_private.offline_pc_grants(organization_id,id),
 foreign key(organization_id,product_id) references public.products(organization_id,id),
 foreign key(organization_id,batch_id) references public.product_batches(organization_id,id)
);
create index offline_pc_stock_rights on app_private.offline_pc_grant_lines(organization_id,product_id,batch_key);
create table app_private.offline_pc_requests(
 id uuid primary key,organization_id uuid not null references public.organizations(id),branch_id uuid not null,
 actor_id uuid not null references auth.users(id),action text not null,payload jsonb not null,result jsonb not null,
 created_at timestamptz not null default now(),foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
create table app_private.offline_pc_originals(
 transaction_id uuid primary key,organization_id uuid not null,branch_id uuid not null,grant_id uuid not null,
 sequence bigint not null check(sequence between 1 and 9007199254740991),actor_id uuid not null references auth.users(id),
 payload jsonb not null,created_at timestamptz not null default now(),unique(grant_id,sequence),unique(organization_id,transaction_id),
 foreign key(organization_id,grant_id) references app_private.offline_pc_grants(organization_id,id),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id),
 foreign key(transaction_id) references public.sales(id) deferrable initially deferred
);
create table app_private.offline_pc_settlements(
 transaction_id uuid primary key references app_private.offline_pc_originals(transaction_id),
 organization_id uuid not null references public.organizations(id),result jsonb not null,created_at timestamptz not null default now()
);
alter table app_private.offline_pc_originals add constraint offline_pc_original_has_settlement foreign key(transaction_id)
 references app_private.offline_pc_settlements(transaction_id) deferrable initially deferred;
create table app_private.offline_pc_returns(
 id uuid primary key,organization_id uuid not null,branch_id uuid not null,grant_id uuid not null unique,
 actor_id uuid not null references auth.users(id),final_sequence bigint not null check(final_sequence>=0),
 returned_quantities jsonb not null,created_at timestamptz not null default now(),
 foreign key(organization_id,grant_id) references app_private.offline_pc_grants(organization_id,id),
 foreign key(organization_id,branch_id) references public.branches(organization_id,id)
);
do $private$ declare relation text;begin
 foreach relation in array array['offline_pc_configuration','offline_pc_readiness','offline_pc_grants','offline_pc_grant_lines','offline_pc_requests','offline_pc_originals','offline_pc_settlements','offline_pc_returns'] loop
  execute format('alter table app_private.%I enable row level security',relation);
  execute format('revoke all on app_private.%I from public,anon,authenticated',relation);
 end loop;
 foreach relation in array array['offline_pc_requests','offline_pc_originals','offline_pc_settlements','offline_pc_returns'] loop
  execute format('create trigger immutable before update or delete on app_private.%I for each row execute function app_private.immutable()',relation);
 end loop;
end $private$;

create function app_private.offline_reserved(org uuid,branch uuid,product uuid,batch uuid) returns numeric
language sql stable security definer set search_path='' as $$
 select coalesce(sum(l.remaining_quantity),0) from app_private.offline_pc_grant_lines l join app_private.offline_pc_grants g on g.id=l.grant_id
 where g.organization_id=$1 and g.branch_id=$2 and g.closed_at is null and l.product_id=$3 and l.batch_id is not distinct from $4
$$;
revoke all on function app_private.offline_reserved(uuid,uuid,uuid,uuid) from public,anon,authenticated;

-- This boundary protects cash, credit, transfers, holds, adjustments, supplier
-- returns and reversal writers alike, including callers which predate grants.
create function app_private.guard_offline_reserved_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare reserved numeric;physical numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text||new.branch_id::text,1));
 if new.quantity<0 then
  reserved:=app_private.offline_reserved(new.organization_id,new.branch_id,new.product_id,new.batch_id);
  if reserved>0 then
   select coalesce(sum(i.quantity),0) into physical from public.branch_inventory i where i.organization_id=new.organization_id and i.branch_id=new.branch_id and i.product_id=new.product_id and i.batch_id is not distinct from new.batch_id;
   if physical+new.quantity<reserved then raise exception 'This stock is reserved for offline cashier PCs. Reconcile their allowances first';end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_offline_reserved_stock() from public,anon,authenticated;
create trigger offline_reserved_stock before insert on public.inventory_movements for each row execute function app_private.guard_offline_reserved_stock();

create function app_private.offline_pc_grant_json(ident uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',1,'grantId',g.id,'organizationId',g.organization_id,'branchId',g.branch_id,'deviceId',g.device_id,'shiftId',g.shift_id,'cashierId',g.cashier_id,
  'cohortRevision',g.cohort_revision,'issuedAt',floor(extract(epoch from g.issued_at)*1000)::bigint,'expiresAt',floor(extract(epoch from g.expires_at)*1000)::bigint,
  'closed',g.closed_at is not null,'priceBook',g.price_book,'acknowledgedSequence',coalesce((select max(o.sequence) from app_private.offline_pc_originals o where o.grant_id=g.id),0),
  'allocations',coalesce((select jsonb_agg(jsonb_build_object('productId',l.product_id,'batchId',l.batch_id,'quantity',l.granted_quantity::text,'remaining',l.remaining_quantity::text,'expiresOn',l.expires_on) order by l.product_id,l.batch_key) from app_private.offline_pc_grant_lines l where l.grant_id=g.id),'[]'::jsonb))
 from app_private.offline_pc_grants g where g.id=$1
$$;
revoke all on function app_private.offline_pc_grant_json(uuid) from public,anon,authenticated;

create function app_private.offline_pc_control(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;actor uuid:=auth.uid();request uuid:=(data->>'requestId')::uuid;
 device uuid:=(data->>'deviceId')::uuid;cfg app_private.offline_pc_configuration;prior app_private.offline_pc_requests;
 grant_row app_private.offline_pc_grants;sh public.cashier_shifts;ids uuid[];book jsonb;result jsonb;stock_row record;
 deadline timestamptz;quantum numeric;pack numeric;rights numeric;free numeric;share numeric;cohort integer;slot integer;rotation integer;last_sequence bigint;
begin
 perform app_private.require_enabled_branch(action,data);
 if not app_private.can_checkout(org,branch) then raise exception 'Offline checkout access denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
 select * into cfg from app_private.offline_pc_configuration c where c.organization_id=org and c.branch_id=branch;
 if action='offline_pc_status' then
  if device is not null and not exists(select 1 from public.devices d where d.id=device and d.organization_id=org and d.branch_id=branch and d.active) then raise exception 'Select a registered PC' using errcode='42501';end if;
  select * into grant_row from app_private.offline_pc_grants g where g.organization_id=org and g.branch_id=branch and g.device_id=device and g.cashier_id=actor and g.closed_at is null;
  return jsonb_build_object('enabled',coalesce(cfg.enabled,false),'mode','automatic','cohortRevision',coalesce(cfg.revision,0),'grant',app_private.offline_pc_grant_json(grant_row.id),'checkedAt',clock_timestamp(),
   'cloudComplete',not exists(select 1 from app_private.offline_pc_grants g where g.organization_id=org and g.branch_id=branch and g.closed_at is null),
   'stocks',coalesce((select jsonb_agg(jsonb_build_object('productId',i.product_id,'batchId',i.batch_id,'physical',i.quantity::text,'reserved',app_private.offline_reserved(org,branch,i.product_id,i.batch_id)::text,'unreserved',(i.quantity-app_private.offline_reserved(org,branch,i.product_id,i.batch_id))::text) order by i.product_id,i.batch_id) from public.branch_inventory i where i.organization_id=org and i.branch_id=branch),'[]'::jsonb),
   'pcs',coalesce((select jsonb_agg(jsonb_build_object('deviceId',d.id,'name',d.name,'prepared',r.protocol=2,'clientRelease',r.client_release,'preparedAt',r.acknowledged_at,'grantId',g.id,'cashierId',g.cashier_id,'shiftId',g.shift_id,'expiresAt',g.expires_at,'acknowledgedSequence',coalesce((select max(o.sequence) from app_private.offline_pc_originals o where o.grant_id=g.id),0),'reconciled',g.id is null,'shiftOpen',exists(select 1 from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.device_id=d.id and s.closed_at is null),'unreportedReceipts','unknown') order by d.id)
    from public.devices d left join app_private.offline_pc_readiness r on r.organization_id=org and r.device_id=d.id left join app_private.offline_pc_grants g on g.organization_id=org and g.device_id=d.id and g.closed_at is null
    where d.organization_id=org and d.branch_id=branch and d.active and (exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=actor and m.active and m.role='owner') or(d.id=device and g.cashier_id=actor))),'[]'::jsonb));
 end if;
 if action='recover_pc_stock_request' then
  select * into prior from app_private.offline_pc_requests r where r.id=(data->'originalData'->>'requestId')::uuid and r.organization_id=org and r.branch_id=branch and r.actor_id=actor and r.action=data->>'originalAction' and r.payload=data->'originalData';
  if prior.id is null or prior.action not in('refresh_pc_stock_grant','return_pc_stock_grant') then raise exception 'No committed original stock request matches this evidence; preserve it for investigation' using errcode='42501';end if;
  if prior.action='refresh_pc_stock_grant' then return app_private.offline_pc_grant_json((prior.result->>'grantId')::uuid)||'{"duplicate":true}'::jsonb;end if;
  return prior.result||'{"duplicate":true}'::jsonb;
 end if;
 if request is null then raise exception 'An original request reference is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text||request::text,0));
 select * into prior from app_private.offline_pc_requests r where r.id=request;
 if found then
  if prior.organization_id<>org or prior.branch_id<>branch or prior.actor_id<>actor or prior.action<>action or prior.payload<>data then raise exception 'This request reference contains different values';end if;
  if action='refresh_pc_stock_grant' then return app_private.offline_pc_grant_json((prior.result->>'grantId')::uuid)||'{"duplicate":true}'::jsonb;end if;
  return prior.result||'{"duplicate":true}'::jsonb;
 end if;
 if action='prepare_pc_offline' then
  if not exists(select 1 from public.devices d where d.id=device and d.organization_id=org and d.branch_id=branch and d.active) then raise exception 'Select a registered PC' using errcode='42501';end if;
  if data->'protocol' is distinct from '2'::jsonb or data->'queuesEmpty' is distinct from 'true'::jsonb or length(btrim(coalesce(data->>'clientRelease',''))) not between 3 and 120 then raise exception 'Update this PC and synchronize every original before preparing offline checkout';end if;
  insert into app_private.offline_pc_readiness(organization_id,branch_id,device_id,actor_id,protocol,client_release) values(org,branch,device,actor,2,btrim(data->>'clientRelease'))
   on conflict(organization_id,device_id) do update set actor_id=excluded.actor_id,protocol=excluded.protocol,client_release=excluded.client_release,acknowledged_at=now();
  result:=jsonb_build_object('deviceId',device,'protocol',2,'prepared',true);
 elsif action='configure_offline_cash' then
  if not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=actor and m.active and m.role='owner') then raise exception 'Only the owner can configure offline cash' using errcode='42501';end if;
  if data->'confirmed' is distinct from 'true'::jsonb or jsonb_typeof(data->'enabled') is distinct from 'boolean' or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000 then raise exception 'Confirm the automatic mode and enter a reason';end if;
  if not exists(select 1 from public.branches b where b.organization_id=org and b.id=branch and b.active and b.multi_pc) then raise exception 'Automatic offline cash requires a multiple-PC branch';end if;
  if exists(select 1 from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.closed_at is null) or exists(select 1 from app_private.offline_pc_grants g where g.organization_id=org and g.branch_id=branch and g.closed_at is null) then raise exception 'Close and reconcile every branch drawer and grant first';end if;
  select array_agg(d.id order by d.id) into ids from public.devices d where d.organization_id=org and d.branch_id=branch and d.active;
  if data->'enabled'='true'::jsonb and (coalesce(cardinality(ids),0)=0 or exists(select 1 from unnest(ids) id where not exists(select 1 from app_private.offline_pc_readiness r where r.organization_id=org and r.branch_id=branch and r.device_id=id and r.protocol=2))) then raise exception 'Prepare every registered PC before activation';end if;
  insert into app_private.offline_pc_configuration(organization_id,branch_id,enabled,revision,cohort_devices,configured_by,reason)
   values(org,branch,(data->>'enabled')::boolean,coalesce(cfg.revision,0)+1,coalesce(ids,'{}'),actor,btrim(data->>'reason'))
   on conflict(organization_id,branch_id) do update set enabled=excluded.enabled,revision=excluded.revision,cohort_devices=excluded.cohort_devices,configured_by=actor,reason=excluded.reason,configured_at=now();
  result:=jsonb_build_object('enabled',(data->>'enabled')::boolean,'mode','automatic','cohortRevision',coalesce(cfg.revision,0)+1,'devices',coalesce(ids,'{}'));
 elsif action='refresh_pc_stock_grant' then
  if not coalesce(cfg.enabled,false) then raise exception 'Automatic offline cash is not enabled';end if;
  if exists(select 1 from app_private.blind_counts c where c.organization_id=org and c.branch_id=branch and c.state not in('approved','cancelled')) then raise exception 'Finish or cancel every branch stock count before preparing offline stock';end if;
  if data->'queuesEmpty' is distinct from 'true'::jsonb or data->>'cashierId' is distinct from actor::text then raise exception 'Synchronize as the original cashier before preparing stock' using errcode='42501';end if;
  select array_agg(d.id order by d.id) into ids from public.devices d where d.organization_id=org and d.branch_id=branch and d.active;
  if ids is distinct from cfg.cohort_devices or array_position(ids,device) is null then raise exception 'The registered PC cohort changed; reconcile before reconfiguration';end if;
  select * into sh from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.id=(data->>'shiftId')::uuid and s.device_id=device and s.cashier_id=actor and s.closed_at is null;
  select max(a.expires_at) into deadline from public.shift_authorizations a where a.organization_id=org and a.shift_id=sh.id and now() between a.issued_at and a.expires_at;
  if sh.id is null or deadline is null then raise exception 'Open or renew your own authorized shift online';end if;
  select * into grant_row from app_private.offline_pc_grants g where g.organization_id=org and g.device_id=device and g.closed_at is null;
  if found then raise exception 'Reconcile and return the current grant before preparing another';end if;
  select coalesce(jsonb_agg(jsonb_build_object('productId',p.id,'name',p.name,'baseUnit',p.base_unit,'unitId',u.id,'unitName',u.name,'factor',u.factor::text,'priceVersion',v.version,'unitCost',v.cost,
    'unitPrice',coalesce(bp.price,v.price),'branchId',case when bp.id is not null then branch else null end,'branchPriceId',bp.id,'branchPriceVersion',bp.version,'sellingPolicy',coalesce(bp.selling_policy,'fractional')) order by p.id,u.id),'[]'::jsonb) into book
   from public.products p join public.product_units u on u.product_id=p.id and u.organization_id=p.organization_id join public.unit_prices v on v.organization_id=u.organization_id and v.unit_id=u.id and v.version=u.price_version
   left join lateral(select b.* from app_private.branch_unit_prices b where b.organization_id=org and b.branch_id=branch and b.unit_id=u.id and app_private.network_managed(org) order by b.version desc limit 1)bp on true
   where p.organization_id=org and p.active and not p.setup_pending and (bp.id is not null or (not p.price_pending and not app_private.network_managed(org)));
  insert into app_private.offline_pc_grants(organization_id,branch_id,device_id,shift_id,cashier_id,cohort_revision,expires_at,price_book)
   values(org,branch,device,sh.id,actor,cfg.revision,least(deadline,now()+interval '12 hours'),book) returning * into grant_row;
  cohort:=cardinality(ids);slot:=array_position(ids,device)-1;
  for stock_row in select i.*,p.base_unit,b.expires_on from public.branch_inventory i join public.products p on p.id=i.product_id and p.organization_id=i.organization_id
   left join public.product_batches b on b.id=i.batch_id where i.organization_id=org and i.branch_id=branch and i.quantity>0 and p.active and not p.setup_pending
   and (not p.tracks_expiry or b.id is not null) and (b.expires_on is null or b.expires_on>=(now() at time zone 'Asia/Manila')::date)
   and exists(select 1 from jsonb_array_elements(book) entry where (entry->>'productId')::uuid=p.id) order by i.product_id,i.batch_key loop
   rights:=app_private.offline_reserved(org,branch,stock_row.product_id,stock_row.batch_id);free:=stock_row.quantity-rights;
   if free<0 then raise exception 'Physical stock is below its outstanding offline reservations';end if;
   quantum:=case when stock_row.base_unit='piece' then 1 else 0.000001 end;
   select greatest(coalesce(max((entry->>'factor')::numeric) filter(where entry->>'sellingPolicy'='sealed_whole'),quantum),quantum) into pack from jsonb_array_elements(book) entry where (entry->>'productId')::uuid=stock_row.product_id;
   rotation:=mod(abs(hashtextextended(stock_row.product_id::text||cfg.revision::text,0)::numeric),cohort)::integer;
   share:=greatest(least(app_private.offline_fair_share(stock_row.quantity,pack,quantum,cohort,slot,rotation),free),0);
   if share>0 then insert into app_private.offline_pc_grant_lines(organization_id,grant_id,product_id,batch_id,granted_quantity,remaining_quantity,expires_on) values(org,grant_row.id,stock_row.product_id,stock_row.batch_id,share,share,stock_row.expires_on);end if;
  end loop;
  result:=app_private.offline_pc_grant_json(grant_row.id);
 elsif action='return_pc_stock_grant' then
  select * into grant_row from app_private.offline_pc_grants g where g.id=(data->>'grantId')::uuid and g.organization_id=org and g.branch_id=branch and g.cashier_id=actor for update;
  if grant_row.id is null then raise exception 'Return this grant as its original cashier' using errcode='42501';end if;
  if grant_row.closed_at is not null then raise exception 'This grant already has an original return reference';end if;
  if data->'queuesEmpty' is distinct from 'true'::jsonb or data->'frozen' is distinct from 'true'::jsonb or coalesce(data->>'finalSequence','')!~'^\d{1,16}$' then raise exception 'Freeze and synchronize every original receipt before returning rights';end if;
  select coalesce(max(o.sequence),0) into last_sequence from app_private.offline_pc_originals o where o.grant_id=grant_row.id;
  if (data->>'finalSequence')::numeric<>last_sequence then raise exception 'The final receipt sequence is not fully reconciled';end if;
  insert into app_private.offline_pc_returns(id,organization_id,branch_id,grant_id,actor_id,final_sequence,returned_quantities)
   values(request,org,branch,grant_row.id,actor,last_sequence,coalesce((select jsonb_agg(jsonb_build_object('productId',l.product_id,'batchId',l.batch_id,'quantity',l.remaining_quantity::text) order by l.product_id,l.batch_key) from app_private.offline_pc_grant_lines l where l.grant_id=grant_row.id),'[]'::jsonb));
  update app_private.offline_pc_grant_lines l set remaining_quantity=0 where l.grant_id=grant_row.id;
  update app_private.offline_pc_grants g set closed_at=now() where g.id=grant_row.id;
  result:=jsonb_build_object('grantId',grant_row.id,'returned',true,'finalSequence',last_sequence);
 else raise exception 'Unknown offline PC control';end if;
 insert into app_private.offline_pc_requests(id,organization_id,branch_id,actor_id,action,payload,result) values(request,org,branch,actor,action,data,result);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,actor,action,request,jsonb_build_object('original',data,'result',result));
 return result;
end $$;
revoke all on function app_private.offline_pc_control(text,jsonb) from public,anon,authenticated;

-- A disconnected receipt retains the original conversion. Wait for genuine
-- returns before changing that conversion or the shared base measurement.
create function app_private.guard_offline_stock_definition() returns trigger language plpgsql security definer set search_path='' as $$
declare b record;unit_change boolean:=tg_table_name='product_units';
begin
 if tg_op='UPDATE' then
  if unit_change then
   if (old.organization_id,old.product_id,old.id,old.factor,old.name) is not distinct from (new.organization_id,new.product_id,new.id,new.factor,new.name) then return new;end if;
  else
   if (old.organization_id,old.id,old.base_unit,old.tracks_expiry) is not distinct from (new.organization_id,new.id,new.base_unit,new.tracks_expiry) then return new;end if;
  end if;
 end if;
 for b in select id from public.branches where organization_id=old.organization_id order by id loop
  perform pg_advisory_xact_lock(hashtextextended(old.organization_id::text||b.id::text,1));
 end loop;
 if exists(select 1 from app_private.offline_pc_grants g cross join lateral jsonb_array_elements(g.price_book)entry where g.organization_id=old.organization_id and g.closed_at is null and entry->>case when unit_change then 'unitId' else 'productId' end=old.id::text) then
  raise exception 'Reconcile the offline cashier grants before changing this stock measurement or selling unit';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function app_private.guard_offline_stock_definition() from public,anon,authenticated;
create trigger offline_stock_definition before update or delete on public.products for each row execute function app_private.guard_offline_stock_definition();
create trigger offline_stock_definition before update or delete on public.product_units for each row execute function app_private.guard_offline_stock_definition();

alter function app_private.command(text,jsonb) rename to command_before_allocated_cash;
revoke all on function app_private.command_before_allocated_cash(text,jsonb) from public,anon,authenticated;
do $renamed_router$ declare src text;begin
 src:=pg_get_functiondef('app_private.command_before_allocated_cash(text,jsonb)'::regprocedure);
 if strpos(src,'command.action')=0 then raise exception 'Review the exact-original router qualification before renaming';end if;
 execute replace(src,'command.action','command_before_allocated_cash.action');
end $renamed_router$;
-- This baseline and its included-receipt identities are read while settlement
-- holds the same branch lock. A lost ACK must not inflate the local estimate.
create function app_private.drawer_cash_baseline(data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;sh public.cashier_shifts;summary jsonb;ids jsonb;
begin
 select s.* into sh from public.cashier_shifts s where s.organization_id=org and s.branch_id=branch and s.id=(data->>'shiftId')::uuid and s.device_id=(data->>'deviceId')::uuid and s.cashier_id=auth.uid();
 if sh.id is null then raise exception 'Select your own registered PC drawer' using errcode='42501';end if;
 summary:=app_private.drawer_expense_summary(data);
 select coalesce(jsonb_agg(s.id order by s.id),'[]'::jsonb) into ids from public.sales s join app_private.offline_pc_originals o on o.transaction_id=s.id where s.organization_id=org and s.branch_id=branch and s.shift_id=sh.id and s.device_id=sh.device_id and s.cashier_id=sh.cashier_id;
 return jsonb_build_object('organizationId',org,'branchId',branch,'shiftId',sh.id,'deviceId',sh.device_id,'cashierId',sh.cashier_id,'asOf',clock_timestamp(),'summary',summary,'includedAllocatedIds',ids);
end $$;
revoke all on function app_private.drawer_cash_baseline(jsonb) from public,anon,authenticated;

create function app_private.command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;
begin
 perform app_private.require_enabled_branch(action,data);
 if action in('prepare_pc_offline','refresh_pc_stock_grant','return_pc_stock_grant','offline_pc_status','configure_offline_cash','recover_pc_stock_request') then return app_private.offline_pc_control(action,data);end if;
 if action in('close_shift','retire_device','configure_cashier_pcs','register_device') then
  perform pg_advisory_xact_lock(hashtextextended((data->>'organizationId')||(data->>'branchId'),1));
  if exists(select 1 from app_private.offline_pc_grants g where g.organization_id=(data->>'organizationId')::uuid and g.branch_id=(data->>'branchId')::uuid and g.closed_at is null
   and (action<>'close_shift' or g.shift_id=(data->>'shiftId')::uuid)) and (action<>'register_device' or not exists(select 1 from public.devices d where d.organization_id=(data->>'organizationId')::uuid and d.branch_id=(data->>'branchId')::uuid and d.id=(data->>'deviceId')::uuid and d.active)) then raise exception 'Reconcile and return outstanding offline stock rights first';end if;
 end if;
 if action in('start_blind_count','record_blind_count','submit_count','approve_count') then
  perform pg_advisory_xact_lock(hashtextextended((data->>'organizationId')||(data->>'branchId'),1));
  if exists(select 1 from app_private.offline_pc_grants g where g.organization_id=(data->>'organizationId')::uuid and g.branch_id=(data->>'branchId')::uuid and g.closed_at is null) then raise exception 'Reconcile every offline PC grant before counting branch stock';end if;
 end if;
 if action in('drawer_cash_baseline','dashboard','snapshot','record_report','sales_analytics','drawer_expense_records','drawer_expense_summary') then
  perform pg_advisory_xact_lock(hashtextextended((data->>'organizationId')||(data->>'branchId'),1));
  if action='drawer_cash_baseline' then return app_private.drawer_cash_baseline(data);end if;
  answer:=app_private.command_before_allocated_cash(action,data);
  return answer||jsonb_build_object('offlineReport',jsonb_build_object('organizationId',(data->>'organizationId')::uuid,'branchId',(data->>'branchId')::uuid,'asOf',coalesce(answer->'asOf',to_jsonb(clock_timestamp())),'outstandingGrants',(select count(*) from app_private.offline_pc_grants g where g.organization_id=(data->>'organizationId')::uuid and g.branch_id=(data->>'branchId')::uuid and g.closed_at is null)));
 end if;
 return app_private.command_before_allocated_cash(action,data);
end $$;
revoke all on function app_private.command(text,jsonb) from public,anon;
grant execute on function app_private.command(text,jsonb) to authenticated;

create function app_private.guard_offline_grant_projection() returns trigger language plpgsql security definer set search_path='' as $$
declare spent numeric;
begin
 if TG_OP='DELETE' then raise exception 'Offline grant history cannot be deleted';end if;
 if TG_TABLE_NAME='offline_pc_grants' then
  if (to_jsonb(new)-'closed_at') is distinct from (to_jsonb(old)-'closed_at') or old.closed_at is not null or new.closed_at is null
   or not exists(select 1 from app_private.offline_pc_returns r where r.grant_id=old.id and r.created_at=new.closed_at) then
   raise exception 'An issued stock grant is immutable; close it only through its original verified return';
  end if;
 else
  -- Stored generated batch_key is not recomputed until after a BEFORE trigger.
  if (to_jsonb(new)-'remaining_quantity'-'batch_key') is distinct from (to_jsonb(old)-'remaining_quantity'-'batch_key') or new.remaining_quantity>old.remaining_quantity then
   raise exception 'Original stock rights cannot be rewritten or replenished';
  end if;
  spent:=old.remaining_quantity-new.remaining_quantity;
  if spent>0 and not exists(select 1 from app_private.offline_pc_returns r where r.grant_id=old.grant_id and r.created_at=now())
   and not exists(select 1 from app_private.offline_pc_originals o where o.grant_id=old.grant_id
    and not exists(select 1 from app_private.offline_pc_settlements s where s.transaction_id=o.transaction_id)
    and (select coalesce(sum((item->>'quantity')::numeric*(item->>'factor')::numeric),0) from jsonb_array_elements(o.payload->'sale'->'items')item where (item->>'productId')::uuid=old.product_id and (item->>'batchId')::uuid is not distinct from old.batch_id)=spent) then
   raise exception 'An original paid receipt or verified return must explain the stock-right deduction';
  end if;
 end if;
 return new;
end $$;
revoke all on function app_private.guard_offline_grant_projection() from public,anon,authenticated;
create trigger offline_grant_identity before update or delete on app_private.offline_pc_grants for each row execute function app_private.guard_offline_grant_projection();
create trigger offline_grant_line_identity before update or delete on app_private.offline_pc_grant_lines for each row execute function app_private.guard_offline_grant_projection();

create function app_private.guard_offline_pc_cohort() returns trigger language plpgsql security definer set search_path='' as $$
declare scope record;
begin
 if TG_OP='UPDATE' and new.active=old.active and new.organization_id=old.organization_id and new.branch_id=old.branch_id then return new;end if;
 if TG_OP='INSERT' and exists(select 1 from public.devices d where d.id=new.id and d.organization_id=new.organization_id and d.branch_id=new.branch_id and d.active=new.active) then return new;end if;
 for scope in select old.organization_id org,old.branch_id branch where TG_OP<>'INSERT' and old.active
  union select new.organization_id,new.branch_id where TG_OP<>'DELETE' and new.active loop
  perform pg_advisory_xact_lock(hashtextextended(scope.org::text||scope.branch::text,1));
  if exists(select 1 from app_private.offline_pc_configuration c where c.organization_id=scope.org and c.branch_id=scope.branch and c.enabled)
   and (exists(select 1 from public.cashier_shifts s where s.organization_id=scope.org and s.branch_id=scope.branch and s.closed_at is null)
    or exists(select 1 from app_private.offline_pc_grants g where g.organization_id=scope.org and g.branch_id=scope.branch and g.closed_at is null)) then
   raise exception 'Reconcile offline rights and close every branch drawer before changing the PC cohort';
  end if;
 end loop;
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
revoke all on function app_private.guard_offline_pc_cohort() from public,anon,authenticated;
create trigger offline_pc_cohort before insert or delete or update of active,organization_id,branch_id on public.devices for each row execute function app_private.guard_offline_pc_cohort();

-- A narrow, private original inserted by the checked settlement handler is the
-- only authority for retaining a paid receipt's frozen names/lot authorization.
-- The same current financial writer still owns receipt, discount, payment and
-- journal validation. Normal cash callers acquire no historical-name bypass.
create function app_private.offline_receipt_snapshot_allows(ident uuid,org uuid,branch uuid,sale jsonb,item jsonb)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.offline_pc_originals o
  where o.transaction_id=$1 and o.organization_id=$2 and o.branch_id=$3 and o.actor_id=auth.uid()
  and o.payload->'sale'=$4 and (o.payload->'sale'->'items')@>jsonb_build_array($5)
  and not exists(select 1 from app_private.offline_pc_settlements s where s.transaction_id=o.transaction_id))
$$;
revoke all on function app_private.offline_receipt_snapshot_allows(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
do $cash_owner$ declare src text;anchor text;replacement text;begin
 src:=pg_get_functiondef('app_private.command_legacy(text,jsonb)'::regprocedure);
 anchor:='if row_item->>''name'' is distinct from prod.name or row_item->>''unitName'' is distinct from un.name then';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review the current cash receipt-name validator';end if;
 replacement:='if (row_item->>''name'' is distinct from prod.name or row_item->>''unitName'' is distinct from un.name) and not app_private.offline_receipt_snapshot_allows(ident,org,branch,data,row_item) then';
 src:=replace(src,anchor,replacement);
 anchor:='batch.expires_on<(sale_time at time zone ''Asia/Manila'')::date';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review the current cash lot validator';end if;
 src:=replace(src,anchor,'('||anchor||' and not app_private.offline_receipt_snapshot_allows(ident,org,branch,data,row_item))');
 execute src;
end $cash_owner$;

create function app_private.allocated_cash_command(action text,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare original jsonb:=case when action='reconcile_allocated_cash_sale' then data->'original' else data end;
 org uuid:=(data->>'organizationId')::uuid;branch uuid:=(data->>'branchId')::uuid;actor uuid:=auth.uid();owner_resolution boolean:=action='reconcile_allocated_cash_sale';
 sale jsonb;ident uuid;grant_row app_private.offline_pc_grants;prior app_private.offline_pc_originals;prior_request app_private.offline_pc_requests;
 seq bigint;last_seq bigint;item jsonb;frozen jsonb;field text;line record;allocation app_private.offline_pc_grant_lines;
 result jsonb;occurred timestamptz;quantity numeric;needed numeric;physical numeric;linked boolean:=false;existing public.sales;
begin
 perform app_private.require_enabled_branch(action,data);
 if not app_private.can_checkout(org,branch) then raise exception 'Allocated cash access denied' using errcode='42501';end if;
 if owner_resolution and (not exists(select 1 from public.staff_memberships m where m.organization_id=org and m.user_id=actor and m.active and m.role='owner')
  or (data->>'requestId')::uuid is null or length(btrim(coalesce(data->>'reason',''))) not between 3 and 1000
  or length(btrim(coalesce(data->>'reference',''))) not between 3 and 200) then raise exception 'Owner approval, original evidence and a reason are required' using errcode='42501';end if;
 if jsonb_typeof(original) is distinct from 'object' or (original->>'organizationId')::uuid is distinct from org or (original->>'branchId')::uuid is distinct from branch then raise exception 'The original cash request belongs to another branch' using errcode='42501';end if;
 sale:=original->'sale';ident:=(original->>'transactionId')::uuid;
 if ident is null or (original->>'grantId')::uuid is null or jsonb_typeof(sale) is distinct from 'object' then raise exception 'Keep the complete original allocated cash request';end if;
 if jsonb_typeof(original->'sequence') is distinct from 'number' or coalesce(original->>'sequence','')!~'^\d{1,16}$' or (original->>'sequence')::numeric not between 1 and 9007199254740991 then raise exception 'Use the original exact receipt sequence';end if;
 seq:=(original->>'sequence')::bigint;
 perform pg_advisory_xact_lock(hashtextextended(org::text||':financial-original:'||ident::text,0));
 perform pg_advisory_xact_lock(hashtextextended(org::text||branch::text,1));
 select * into grant_row from app_private.offline_pc_grants g where g.id=(original->>'grantId')::uuid and g.organization_id=org and g.branch_id=branch for update;
 if grant_row.id is null or (not owner_resolution and grant_row.cashier_id<>actor)
  or (original->>'deviceId')::uuid is distinct from grant_row.device_id or (original->>'shiftId')::uuid is distinct from grant_row.shift_id
  or (original->>'cashierId')::uuid is distinct from grant_row.cashier_id then raise exception 'Use the original cashier, device, shift and stock grant' using errcode='42501';end if;
 foreach field in array array['organizationId','branchId','deviceId','cashierId','shiftId','transactionId'] loop
  if sale->field is distinct from original->field then raise exception 'The inner sale and original stock request do not match' using errcode='42501';end if;
 end loop;
 if owner_resolution then
  select * into prior_request from app_private.offline_pc_requests r where r.id=(data->>'requestId')::uuid;
  if found then
   if prior_request.organization_id<>org or prior_request.branch_id<>branch or prior_request.actor_id<>actor or prior_request.action<>action or prior_request.payload<>data then raise exception 'This owner request contains different evidence';end if;
   return prior_request.result||'{"duplicate":true}'::jsonb;
  end if;
 end if;
 select * into prior from app_private.offline_pc_originals o where o.transaction_id=ident;
 if found then
  if prior.organization_id<>org or prior.branch_id<>branch or prior.payload<>original then raise exception 'This original transaction contains different paid-sale details';end if;
  select s.result into result from app_private.offline_pc_settlements s where s.transaction_id=ident;
  result:=result||'{"status":"duplicate","duplicate":true}'::jsonb;
  if owner_resolution then
   result:=result||'{"ownerResolved":true}'::jsonb;
   insert into app_private.offline_pc_requests(id,organization_id,branch_id,actor_id,action,payload,result) values((data->>'requestId')::uuid,org,branch,actor,action,data,result);
   insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,actor,action,ident,jsonb_build_object('grantId',grant_row.id,'sequence',seq,'linkedRecordedOriginal',true,'ownerEvidence',data-'original'));
  end if;
  return result;
 end if;
 if grant_row.closed_at is not null then raise exception 'This stock grant was already returned; retain the original for owner investigation';end if;
 select coalesce(max(o.sequence),0) into last_seq from app_private.offline_pc_originals o where o.grant_id=grant_row.id;
 if seq<>last_seq+1 then raise exception 'Synchronize original cash receipts in their exact sequence';end if;
 if sale->'version' is distinct from '1'::jsonb or jsonb_typeof(sale->'items') is distinct from 'array' or jsonb_array_length(sale->'items') not between 1 and 100 then raise exception 'Use the complete original cash-sale version and items';end if;
 occurred:=(sale->>'occurredAt')::timestamptz;
 if occurred is null or occurred<grant_row.issued_at-interval '2 minutes' or occurred>grant_row.expires_at or occurred>now()+interval '5 minutes' then raise exception 'The receipt is outside its original stock authorization window';end if;
 for item in select value from jsonb_array_elements(sale->'items') loop
  select entry into frozen from jsonb_array_elements(grant_row.price_book)entry where entry->>'unitId'=item->>'unitId';
  if frozen is null then raise exception 'This selling unit was not authorized by the original stock grant';end if;
  foreach field in array array['productId','name','unitId','unitName','factor','unitPrice','unitCost','priceVersion'] loop
   if item->field is distinct from frozen->field then raise exception 'The paid receipt differs from its authorized unit, conversion or price';end if;
  end loop;
  foreach field in array array['branchId','branchPriceId','branchPriceVersion'] loop
   if coalesce(item->field,'null'::jsonb) is distinct from frozen->field then raise exception 'The original branch-price identity does not match';end if;
  end loop;
  if coalesce(item->>'sellingPolicy','fractional') is distinct from frozen->>'sellingPolicy' then raise exception 'The original selling policy does not match';end if;
  if jsonb_typeof(item->'quantity') is distinct from 'string' or coalesce(item->>'quantity','')!~'^\d{1,12}(\.\d{1,6})?$' then raise exception 'Use an exact supported quantity';end if;
  quantity:=(item->>'quantity')::numeric;
  if quantity<=0 or quantity>=1000000000000 or quantity*(item->>'factor')::numeric>=100000000000000 or scale(trim_scale(quantity*(item->>'factor')::numeric))>6 then raise exception 'The quantity conversion is outside supported precision';end if;
  if (frozen->>'baseUnit'='piece' and quantity*(item->>'factor')::numeric<>trunc(quantity*(item->>'factor')::numeric))
   or (frozen->>'sellingPolicy'='sealed_whole' and (quantity<>trunc(quantity) or item->'intactPackagingConfirmed' is distinct from 'true'::jsonb)) then raise exception 'Whole piece quantities and intact sealed packaging are required';end if;
 end loop;
 select * into existing from public.sales s where s.id=ident;
 if found then
  if not owner_resolution or existing.organization_id<>org or existing.branch_id<>branch or existing.cashier_id<>grant_row.cashier_id or existing.device_id<>grant_row.device_id or existing.shift_id<>grant_row.shift_id or existing.payment_mode<>'cash' or existing.payload<>sale then
   raise exception 'This transaction already belongs to another recorded action';
  end if;
  linked:=true;
 end if;
 insert into app_private.offline_pc_originals(transaction_id,organization_id,branch_id,grant_id,sequence,actor_id,payload)
  values(ident,org,branch,grant_row.id,seq,actor,original);
 for line in select (entry->>'productId')::uuid product_id,(entry->>'batchId')::uuid batch_id,sum((entry->>'quantity')::numeric*(entry->>'factor')::numeric) quantity
  from jsonb_array_elements(sale->'items')entry group by entry->>'productId',entry->>'batchId' order by entry->>'productId',entry->>'batchId' loop
  select * into allocation from app_private.offline_pc_grant_lines l where l.grant_id=grant_row.id and l.product_id=line.product_id and l.batch_id is not distinct from line.batch_id for update;
  if allocation.grant_id is null or line.quantity>allocation.remaining_quantity then raise exception 'The original PC does not have enough remaining offline stock';end if;
  if allocation.expires_on is not null and allocation.expires_on<(occurred at time zone 'Asia/Manila')::date then raise exception 'This lot had expired before the original sale';end if;
  select coalesce(sum(i.quantity),0) into physical from public.branch_inventory i where i.organization_id=org and i.branch_id=branch and i.product_id=line.product_id and i.batch_id is not distinct from line.batch_id;
  needed:=app_private.offline_reserved(org,branch,line.product_id,line.batch_id);
  if physical<needed then raise exception 'Stock conservation requires owner investigation; preserve this paid receipt';end if;
  update app_private.offline_pc_grant_lines l set remaining_quantity=l.remaining_quantity-line.quantity where l.grant_id=grant_row.id and l.product_id=line.product_id and l.batch_id is not distinct from line.batch_id;
 end loop;
 if linked then
  result:=jsonb_build_object('transactionId',ident,'status','duplicate','receipt',existing.receipt,'flags',existing.flags,'linkedExisting',true);
 elsif owner_resolution then
  result:=app_private.command_legacy('recover_sale',jsonb_build_object('organizationId',org,'branchId',branch,'sale',sale,'reason',data->>'reason'));
 else
  result:=app_private.command_legacy('record_sale',sale);
 end if;
 if result->>'status' not in('created','duplicate') or result->>'receipt' is null or (result->'flags')?'stock_shortage' then raise exception 'The original allocated cash receipt could not be verified';end if;
 result:=result||jsonb_build_object('grantId',grant_row.id,'sequence',seq,'duplicate',linked,'ownerResolved',owner_resolution,'organizationId',org,'branchId',branch,'deviceId',grant_row.device_id,'cashierId',grant_row.cashier_id,'shiftId',grant_row.shift_id,'total',sale->'total','cashReceived',sale->'cashReceived');
 insert into app_private.offline_pc_settlements(transaction_id,organization_id,result) values(ident,org,result);
 insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details) values(org,branch,actor,action,ident,jsonb_build_object('grantId',grant_row.id,'sequence',seq,'authorizationIssuedAt',grant_row.issued_at,'authorizationExpiresAt',grant_row.expires_at,'ownerEvidence',case when owner_resolution then data-'original' else null end,'linkedExisting',linked));
 if owner_resolution then insert into app_private.offline_pc_requests(id,organization_id,branch_id,actor_id,action,payload,result) values((data->>'requestId')::uuid,org,branch,actor,action,data,result);end if;
 return result;
end $$;
revoke all on function app_private.allocated_cash_command(text,jsonb) from public,anon,authenticated;

-- Add the two settlement actions at the current router, retaining every old
-- action and the old unrestricted-offline denial in multiple-PC mode.
do $route_allocated$ declare src text;anchor text;begin
 src:=pg_get_functiondef('app_private.command(text,jsonb)'::regprocedure);
 anchor:='perform app_private.require_enabled_branch(action,data);';
 if (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then raise exception 'Review allocated cash routing';end if;
 execute replace(src,anchor,anchor||E'\n if action in(''record_allocated_cash_sale'',''reconcile_allocated_cash_sale'') then return app_private.allocated_cash_command(action,data);end if;\n if action in(''record_sale'',''record_online_sale'',''record_credit_sale'',''recover_sale'') and exists(select 1 from app_private.offline_pc_originals o where o.transaction_id=coalesce((data->>''transactionId'')::uuid,(data->>''requestId'')::uuid,(data->''sale''->>''transactionId'')::uuid)) then raise exception ''Use the original allocated cash action and receipt reference'' using errcode=''42501'';end if;');
end $route_allocated$;
