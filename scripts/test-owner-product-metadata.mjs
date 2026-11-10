import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";

const db = new PGlite();
const ids = {
  org: "10000000-0000-4000-8000-000000000001",
  otherOrg: "10000000-0000-4000-8000-000000000002",
  branch: "20000000-0000-4000-8000-000000000001",
  owner: "30000000-0000-4000-8000-000000000001",
  manager: "30000000-0000-4000-8000-000000000002",
  product: "40000000-0000-4000-8000-000000000001",
  otherProduct: "40000000-0000-4000-8000-000000000002",
};
const sql = await readFile(new URL("../supabase/migrations/20261110010619_owner_product_metadata_edit.sql",import.meta.url),"utf8");

let checks = 0;
async function setup() {
  await db.exec(`
    create schema auth;
    create schema app_private;
    do $$begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end$$;
    create table public.branches(organization_id uuid, id uuid primary key, active boolean);
    create table public.staff_memberships(organization_id uuid,user_id uuid,active boolean,role text);
    create table public.products(id uuid primary key,organization_id uuid,name text,sku text,category text,
      minimum_stock numeric,base_unit text,active boolean);
    create table public.stock_control_events(id uuid primary key,organization_id uuid,branch_id uuid,
      action text,source_id uuid,actor_id uuid,payload jsonb);
    create table public.audit_events(id uuid default gen_random_uuid() primary key,
      organization_id uuid,branch_id uuid,actor_id uuid,action text,source_id uuid,details jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id',true),'')::uuid
    $$;
    create function app_private.can_access(org uuid, branch uuid) returns boolean
      language sql stable as $$select true$$;
    create function app_private.require_enabled_branch(action text,data jsonb)
      returns void language plpgsql as $$begin return;end$$;
  `);
  await db.exec(sql);
  await db.query("insert into public.branches values ($1,$2,true)",[ids.org,ids.branch]);
  await db.query("insert into public.staff_memberships values ($1,$2,true,'owner'), ($1,$3,true,'manager')",
    [ids.org,ids.owner,ids.manager]);
  await db.query("insert into public.products values ($1,$2,'Farm Feed','FEED-1','Feeds',5.5,'kg',true), ($3,$2,'Farm Seed','SEED-1','Seeds',3,'piece',true)",
    [ids.product,ids.org,ids.otherProduct]);
}
let counter = 0;
function request(overrides={}) {
  counter++;
  return {
    organizationId:ids.org,branchId:ids.branch,productId:ids.product,
    requestId:`50000000-0000-4000-8000-${String(counter).padStart(12,"0")}`,
    expectedName:"Farm Feed",expectedSku:"FEED-1",expectedCategory:"Feeds",
    expectedMinimumStock:"5.5",
    name:"Premium Farm Feed",sku:"FEED-2",category:"Animal care",minimumStock:"7.5",
    reason:"Owner checked supplier packaging",confirmed:true,...overrides,
  };
}
async function call(data) {
  return (await db.query("select public.agri_command('update_product_metadata',$1::jsonb) as value",
    [JSON.stringify(data)])).rows[0].value;
}
async function rejected(label, data, pattern) {
  await assert.rejects(call(data),pattern,label);
  checks++;
}
function asUser(id) {
  return db.query("select set_config('test.user_id',$1,false)",[id??""]);
}

try {
  await setup();
  await asUser(ids.owner);
  const first=request();
  const result=await call(first);
  assert.equal(result.duplicate,false);
  assert.equal(result.productId,ids.product);
  const product=(await db.query("select * from public.products where id=$1",[ids.product])).rows[0];
  assert.equal(product.name,"Premium Farm Feed");
  assert.equal(product.sku,"FEED-2");
  assert.equal(product.category,"Animal care");
  assert.equal(product.minimum_stock,"7.5");
  assert.equal(product.base_unit,"kg");
  assert.equal(product.id,ids.product);
  const event=(await db.query("select * from public.audit_events")).rows;
  assert.equal(event.length,1);
  assert.equal(event[0].details.before.sku,"FEED-1");
  assert.equal(event[0].details.after.sku,"FEED-2");
  checks++;

  const replay=await call(first);
  assert.equal(replay.duplicate,true);
  assert.equal((await db.query("select count(*)::int as n from public.audit_events")).rows[0].n,1);
  checks++;
  await rejected("Reject tampered idempotency", {...first,name:"Different"}, /request ID already belongs/i);

  await rejected("Reject stale values", request({name:"Another change"}), /changed since you opened/i);
  await rejected("Reject duplicated SKU", request({
    expectedName:product.name,expectedSku:product.sku,expectedCategory:product.category,
    expectedMinimumStock:"7.5",sku:"seed-1",
  }), /belongs to another product/i);
  await rejected("Reject missing owner confirmation", request({confirmed:false}), /confirm/i);
  await rejected("Reject missing reason", request({reason:""}), /reason/i);
  await rejected("Reject negative stock", request({minimumStock:"-10"}), /non-negative/i);
  await rejected("Reject unmodified values",request({
    expectedName:product.name,expectedSku:product.sku,expectedCategory:product.category,
    expectedMinimumStock:"7.5",name:product.name,sku:product.sku,category:product.category,
    minimumStock:"7.5",
  }),/No product details changed/i);
  await rejected("Reject nonexistent business",request({organizationId:ids.otherOrg}),/Only an active owner/i);
  await asUser(ids.manager);
  await rejected("Reject manager", request(), /Only an active owner/i);
  await asUser("");
  await rejected("Reject unsigned request", request(), /signed-in owner/i);

  await asUser(ids.owner);
  await rejected("Reject fractional minimum for pieces",request({
    productId:ids.otherProduct,expectedName:"Farm Seed",expectedSku:"SEED-1",
    expectedCategory:"Seeds",expectedMinimumStock:"3",name:"Farm Seed Updated",
    sku:"SEED-1",category:"Seeds",minimumStock:"3.5",
  }),/whole-number/i);
  assert.equal((await db.query("select count(*)::int as n from public.audit_events")).rows[0].n,1);
  console.log(`PASS: ${checks} isolated database assertions; only intended product metadata changed.`);
} finally {
  await db.close();
}
