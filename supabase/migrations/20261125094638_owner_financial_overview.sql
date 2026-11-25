-- Read-only owner report. All branch membership and session checks run on the server.
create function app_private.owner_financial_overview(
  p_org uuid, p_branch uuid, p_from date, p_through date, p_grain text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_asof timestamptz := statement_timestamp();
  v_grain text := p_grain;
  v_branches jsonb;
  v_branch_ids uuid[];
  v_start timestamptz;
  v_end timestamptz;
  v_rows jsonb;
begin
  if p_org is null or not app_private.can_access(p_org, null) or not exists (
    select 1 from public.staff_memberships m
    where m.organization_id=p_org and m.user_id=auth.uid() and m.active and m.role='owner'
  ) then
    raise exception 'Only an active owner can read the financial overview' using errcode='42501';
  end if;
  if p_from is null or p_through is null or p_through<p_from or p_through-p_from>365
    or p_through>(v_asof at time zone 'Asia/Manila')::date
    or p_grain is null or p_grain not in ('day','hour') or (p_grain='hour' and p_from<>p_through) then
    raise exception 'Choose a valid date range of up to 366 days' using errcode='22023';
  end if;
  select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name,b.id), array_agg(b.id)
    into v_branches,v_branch_ids
  from public.branches b where b.organization_id=p_org and b.active
    and (p_branch is null or b.id=p_branch) and app_private.can_access(p_org,b.id);
  if v_branch_ids is null then
    raise exception 'No report branches are available in this scope' using errcode='42501';
  end if;
  v_start := p_from::timestamp at time zone 'Asia/Manila';
  v_end := (p_through+1)::timestamp at time zone 'Asia/Manila';
  if v_grain='hour' and exists (
    select 1 from public.historical_drawer_notebooks n where n.organization_id=p_org
      and n.branch_id=any(v_branch_ids) and n.business_date=p_from
  ) then v_grain:='day'; end if;

  with scoped_sales as materialized (
    select s.id,s.branch_id,s.occurred_at,s.total,s.payload
    from public.sales s where s.organization_id=p_org and s.branch_id=any(v_branch_ids)
      and s.occurred_at>=v_start and s.occurred_at<v_end and s.occurred_at<=v_asof and s.received_at<=v_asof
  ), sold as (
    select s.branch_id,date_trunc(v_grain,s.occurred_at at time zone 'Asia/Manila') bucket,
      sum(s.total) gross,sum(i.cost) cost,
      bool_or(i.cost is null) cost_unknown
    from scoped_sales s
    cross join lateral (
      select case when count(*)>0 and count(*)=case when jsonb_typeof(s.payload->'items')='array'
          then jsonb_array_length(s.payload->'items') else null end
        and bool_and(l.cost>0 and l.quantity>0)
        then round(sum(l.cost*l.quantity)) end cost
      from public.sale_items l where l.organization_id=p_org and l.sale_id=s.id
    ) i group by 1,2
  ), refund_events as materialized (
    select r.id,r.branch_id,r.sale_id,r.created_at,'full' kind,s.total amount,1 direction
    from public.sale_reversals r join public.sales s on s.id=r.sale_id and s.organization_id=p_org and s.branch_id=r.branch_id
    where r.organization_id=p_org and r.branch_id=any(v_branch_ids)
      and r.created_at>=v_start and r.created_at<v_end and r.created_at<=v_asof
    union all
    select r.id,r.branch_id,r.sale_id,r.created_at,'partial',r.amount,1
    from public.sale_partial_refunds r where r.organization_id=p_org and r.branch_id=any(v_branch_ids)
      and r.created_at>=v_start and r.created_at<v_end and r.created_at<=v_asof
    union all
    select coalesce(c.full_refund_id,c.partial_refund_id),c.branch_id,c.sale_id,c.created_at,
      case when c.full_refund_id is null then 'partial' else 'full' end,c.amount,-1
    from public.sale_refund_corrections c where c.organization_id=p_org and c.branch_id=any(v_branch_ids)
      and c.created_at>=v_start and c.created_at<v_end and c.created_at<=v_asof
  ), full_evidence as materialized (
    select r.id,app_private.refund_source(p_org,r.branch_id,r.id,'full') source
    from (select distinct id,branch_id from refund_events where kind='full') r
  ), restored_costs as (
    select r.branch_id,date_trunc(v_grain,r.created_at at time zone 'Asia/Manila') bucket,
      sum(r.amount*r.direction) refunds,
      sum((case when r.kind='full' then f.cost else p.cost end)*r.direction) restored,
      bool_or(case when r.kind='full' then f.cost is null else p.cost is null end) cost_unknown
    from refund_events r
    join public.sales s on s.id=r.sale_id and s.organization_id=p_org and s.branch_id=r.branch_id
    left join full_evidence evidence on r.kind='full' and evidence.id=r.id
    left join lateral (
      select case when (evidence.source->>'evidenceComplete')::boolean and count(*)>0
        and bool_and(
          coalesce((line->>'saleableQuantity')::numeric=0,(false)) or
          coalesce((line->>'unitCost')::numeric>0 and (line->>'saleableQuantity')::numeric>0,false)
        )
        then round(sum(case when (line->>'saleableQuantity')::numeric=0 then 0
          else (line->>'saleableQuantity')::numeric*(line->>'unitCost')::numeric end)) end cost
      from jsonb_array_elements(evidence.source->'lines') line
    ) f on r.kind='full'
    left join lateral (
      select case when count(*)>0 and bool_and(l.saleable=0 or coalesce((item->>'unitCost')::numeric>0,false))
        then round(sum(case when l.saleable=0 then 0 else l.saleable*(item->>'unitCost')::numeric end)) end cost
      from app_private.partial_refund_lines l
      cross join lateral (select s.payload->'items'->l.line_index item) snapshot
      where l.organization_id=p_org and l.refund_id=r.id
    ) p on r.kind='partial'
    group by 1,2
  ), expenses as (
    select e.branch_id,case when v_grain='day' then e.business_date::timestamp
      else date_trunc('hour',e.occurred_at at time zone 'Asia/Manila') end bucket,
      sum(case e.kind when 'expense' then e.amount when 'return' then -e.amount else e.report_adjustment end) amount
    from app_private.drawer_expense_events e
    join app_private.drawer_expense_events root on root.id=e.expense_id
    join public.cashier_shifts sh on sh.id=root.shift_id
    where e.organization_id=p_org and e.branch_id=any(v_branch_ids)
      and e.business_date between p_from and p_through and e.recorded_at<=v_asof
      and e.kind in ('expense','amount','report','return')
    group by 1,2
  ), notebooks as (
    select n.branch_id,n.business_date::timestamp bucket,n.gross_sales,n.reported_expenses
    from public.historical_drawer_notebooks n where n.organization_id=p_org and n.branch_id=any(v_branch_ids)
      and n.business_date between p_from and p_through and n.recorded_at<=v_asof
  ), periods as (
    select branch_id,bucket from sold union select branch_id,bucket from restored_costs
    union select branch_id,bucket from expenses union select branch_id,bucket from notebooks
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'branchId',t.branch_id,'bucket',case when v_grain='hour' then to_char(t.bucket,'YYYY-MM-DD"T"HH24:MI:SS') else t.bucket::date::text end,
    'gross',coalesce(s.gross,n.gross_sales,0)::text,
    'refunds',case when n.branch_id is null then coalesce(r.refunds,0)::text end,
    'cost',case when n.branch_id is null and not coalesce(s.cost_unknown,false) and not coalesce(r.cost_unknown,false)
      then (coalesce(s.cost,0)-coalesce(r.restored,0))::text end,
    'expenses',coalesce(e.amount,n.reported_expenses,0)::text,
    'notebook',n.branch_id is not null,
    'overlap',n.branch_id is not null and (s.branch_id is not null or e.branch_id is not null or r.branch_id is not null)
  ) order by t.bucket,t.branch_id),'[]'::jsonb) into v_rows
  from periods t left join sold s using(branch_id,bucket)
  left join restored_costs r using(branch_id,bucket) left join expenses e using(branch_id,bucket)
  left join notebooks n using(branch_id,bucket);

  return jsonb_build_object('asOf',v_asof,'from',p_from,'through',p_through,
    'grain',v_grain,'branches',v_branches,'rows',v_rows);
end;
$$;

create function public.owner_financial_overview(
  p_org uuid, p_branch uuid, p_from date, p_through date, p_grain text
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select app_private.owner_financial_overview(p_org,p_branch,p_from,p_through,p_grain)
$$;

revoke all on function app_private.owner_financial_overview(uuid,uuid,date,date,text) from public, anon;
revoke all on function public.owner_financial_overview(uuid,uuid,date,date,text) from public, anon;
grant execute on function app_private.owner_financial_overview(uuid,uuid,date,date,text) to authenticated;
grant execute on function public.owner_financial_overview(uuid,uuid,date,date,text) to authenticated;
