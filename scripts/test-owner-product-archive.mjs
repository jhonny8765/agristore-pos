import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";

const db=new PGlite();
const ids={
  org:"10000000-0000-4000-8000-000000000001",
  otherOrg:"10000000-0000-4000-8000-000000000002",
  branch:"20000000-0000-4000-8000-000000000001",
  owner:"30000000-0000-4000-8000-000000000001",
  manager:"30000000-0000-4000-8000-000000000002",
  product:"40000000-0000-4000-8000-000000000001",
  otherProduct:"40000000-0000-4000-8000-000000000002",
};
let checks=0,counter=0;
const sql=await readFile(new URL("../supabase/migrations/20261110080600_owner_product_archive.sql",import.meta.url),"utf8");
function request(overrides={}){
  counter++;
  return {organizationId:ids.org,branchId:ids.branch,productId:ids.product,
    requestId:`50000000-0000-4000-8000-${String(counter).padStart(12,"0")}`,
    expectedName:"Farm Feed",expectedSku:"FEED-1",typedSku:"FEED-1",
    reason:"Discontinued product",confirmed:true,...overrides};
}
const asUser=id=>db.query("select set_config('test.user_id',$1,false)",[id??""]);
const call=async data=>(await db.query("select public.agri_command('archive_product',$1::jsonb) as value",[JSON.stringify(data)])).rows[0].value;
async function rejects(data,pattern){await assert.rejects(call(data),pattern);checks++;}
async function present(){return (await db.query("select active from public.products where id=$1",[ids.product])).rows[0].active;}

try{
  await db.exec(`
    create schema auth; create schema app_private;
    do $$begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
    end$$;
    create table public.branches(organization_id uuid,id uuid primary key,active boolean);
    create table public.staff_memberships(organization_id uuid,user_id uuid,active boolean,role text);
    create table public.products(id uuid primary key,organization_id uuid,name text,sku text,active boolean,source_stock jsonb);
    create table public.branch_inventory(organization_id uuid,branch_id uuid,product_id uuid,quantity numeric);
    create table public.stock_holds(organization_id uuid,branch_id uuid,product_id uuid,remaining numeric);
    create table public.stock_counts(organization_id uuid,branch_id uuid,product_id uuid,state text);
    create table public.stock_transfers(organization_id uuid,branch_id uuid,product_id uuid,state text);
    create table public.stock_control_events(id uuid primary key,organization_id uuid,branch_id uuid,action text,source_id uuid,actor_id uuid,payload jsonb);
    create table public.audit_events(organization_id uuid,branch_id uuid,actor_id uuid,action text,source_id uuid,details jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
    create function app_private.can_access(org uuid,branch uuid) returns boolean language sql stable as $$select true$$;
    create function app_private.require_enabled_branch(action text,data jsonb) returns void language plpgsql as $$begin return;end$$;
  `);
  await db.exec(sql);
  await db.query("insert into public.branches values ($1,$2,true)",[ids.org,ids.branch]);
  await db.query("insert into public.staff_memberships values ($1,$2,true,'owner'),($1,$3,true,'manager')",[ids.org,ids.owner,ids.manager]);
  await db.query("insert into public.products values ($1,$2,'Farm Feed','FEED-1',true,null),($3,$2,'Other Product','OTHER-1',true,null)",[ids.product,ids.org,ids.otherProduct]);
  await asUser(ids.owner);

  await rejects(request({confirmed:false}),/Confirm removal/);
  await rejects(request({reason:""}),/reason/);
  await rejects(request({typedSku:"WRONG"}),/exact product SKU/);
  await rejects(request({expectedName:"Stale"}),/product changed/i);
  await rejects(request({organizationId:ids.otherOrg}),/Only an active owner/);

  await db.query("insert into public.branch_inventory values ($1,$2,$3,7)",[ids.org,ids.branch,ids.product]);
  await rejects(request(),/recorded stock/);
  await db.query("update public.branch_inventory set quantity=0");
  await db.query("insert into public.stock_holds values ($1,$2,$3,1)",[ids.org,ids.branch,ids.product]);
  await rejects(request(),/held stock/);
  await db.query("delete from public.stock_holds");
  await db.query("insert into public.stock_counts values ($1,$2,$3,'pending')",[ids.org,ids.branch,ids.product]);
  await rejects(request(),/open stock counts/);
  await db.query("delete from public.stock_counts");
  await db.query("insert into public.stock_transfers values ($1,$2,$3,'in_transit')",[ids.org,ids.branch,ids.product]);
  await rejects(request(),/open branch transfers/);
  await db.query("update public.stock_transfers set state='closed_short'");
  await db.query("update public.products set source_stock='{\"pending\":true}' where id=$1",[ids.product]);
  await rejects(request(),/imported stock/);
  await db.query("update public.products set source_stock=null where id=$1",[ids.product]);
  await asUser(ids.manager);
  await rejects(request(),/Only an active owner/);
  await asUser("");
  await rejects(request(),/Signed-in owner/);

  await asUser(ids.owner);
  const first=request();
  const result=await call(first);
  assert.equal(result.duplicate,false);
  assert.equal(await present(),false);
  assert.equal((await db.query("select active from public.products where id=$1",[ids.otherProduct])).rows[0].active,true);
  const audit=(await db.query("select * from public.audit_events")).rows;
  assert.equal(audit.length,1);
  assert.equal(audit[0].details.historyDeleted,false);
  checks++;

  assert.equal((await call(first)).duplicate,true);
  assert.equal((await db.query("select count(*)::int as n from public.audit_events")).rows[0].n,1);
  checks++;
  await rejects({...first,reason:"different"},/request ID already belongs/);
  await rejects(request(),/Choose an active product/);
  console.log(`PASS: ${checks} isolated archive safety assertions; live stock data was not touched.`);
}finally{await db.close();}
