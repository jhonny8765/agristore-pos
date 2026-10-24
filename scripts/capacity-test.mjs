import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { appendFileSync } from "node:fs";
import assert from "node:assert/strict";
const exec = promisify(execFile);
if (process.env.CI !== "true" || process.platform !== "linux")
  throw new Error("Capacity fixtures require the disposable Linux CI stack.");
const status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" }));
if (status.API_URL !== "http://127.0.0.1:55321")
  throw new Error("Capacity fixtures must use the configured loopback stack.");
const args = ["exec", "-i", "supabase_db_agristore-pos", "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"];
const sql = input => execFileSync("docker", args, { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const id = n => `71000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const branches = [101, 102, 103, 104, 105];
const owner = id(11), org = id(1), feed = id(301), seed = id(303), kilo = id(403), packet = id(404);
const login = `set role authenticated; select set_config('request.jwt.claims','${JSON.stringify({ sub: owner, session_id: owner, role: "authenticated" })}',false);`;
const ctx = b => ({ organizationId: org, branchId: id(b) });
const command = (action, data) => `select public.agri_command('${action}','${JSON.stringify(data)}'::jsonb);`;
const lastJSON = output => JSON.parse(output.trim().split("\n").at(-1));
const started = performance.now();
// Historical capacity fixtures exercise real foreign keys, indexes, immutable
// history and movement projections. They do not replay historical checkouts or
// simulate a year of elapsed hardware use. Every trigger remains enabled.
sql(`begin;
insert into auth.users(id,email) values('${owner}','capacity-owner@example.invalid');
insert into auth.sessions(id,user_id) values('${owner}','${owner}');
insert into public.organizations(id,name) values('${org}','TEST five-branch capacity');
insert into public.staff_memberships(organization_id,user_id,role,name) values('${org}','${owner}','owner','TEST capacity owner');
${branches.map((b,i) => `insert into public.branches(id,organization_id,name,code) values('${id(b)}','${org}','TEST capacity ${i+1}','C${i+1}');
insert into public.devices(id,organization_id,branch_id,name,registered_by) values('${id(501+i)}','${org}','${id(b)}','TEST capacity PC','${owner}');
insert into public.cashier_shifts(id,organization_id,branch_id,device_id,cashier_id,opened_at,closed_at,opening_cash,counted_cash,expected_cash)
 select ('71000000-0000-4000-8000-'||lpad((601+${i}+d*5)::text,12,'0'))::uuid,'${org}','${id(b)}','${id(501+i)}','${owner}',now()-interval '365 days'+d*interval '1 day',now()-interval '365 days'+d*interval '1 day'+interval '8 hours',0,840000,840000 from generate_series(0,364) d;`).join("\n")}
insert into public.products(id,organization_id,name,sku,base_unit) values('${feed}','${org}','TEST loose feeds','CAP-FEED','kg'),('${seed}','${org}','TEST seed packets','CAP-SEED','piece');
insert into public.product_units(id,organization_id,product_id,name,factor) values('${kilo}','${org}','${feed}','Kilo',1),('${packet}','${org}','${seed}','Packet',1);
insert into public.unit_prices(organization_id,unit_id,version,price,cost) values('${org}','${kilo}',1,3200,2400),('${org}','${packet}',1,2000,1000);
insert into public.inventory_movements(organization_id,branch_id,product_id,quantity,kind,source_id,created_by)
 select '${org}',b.id,p.id,case when p.id='${feed}' then 1000000 else 120000 end,'opening',gen_random_uuid(),'${owner}' from public.branches b cross join public.products p where b.organization_id='${org}' and p.organization_id='${org}';
create temporary table capacity_sales as
 select ('72000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid id,n,
 ('71000000-0000-4000-8000-'||lpad((101+(n-1)%5)::text,12,'0'))::uuid branch,
 ('71000000-0000-4000-8000-'||lpad((501+(n-1)%5)::text,12,'0'))::uuid device,
 ('71000000-0000-4000-8000-'||lpad((601+(n-1)%5+((n-1)/1500)*5)::text,12,'0'))::uuid shift,
 now()-interval '365 days'+((n-1)/1500)*interval '1 day'+((n-1)/5%300)*interval '96 seconds' occurred
 from generate_series(1,547500) n;
insert into public.sales(id,organization_id,branch_id,device_id,cashier_id,shift_id,occurred_at,received_at,total,cash_received,receipt,payload)
 select id,'${org}',branch,device,'${owner}',shift,occurred,occurred,2800,3000,'TEST-CAP-'||n,
 jsonb_build_object('version',1,'transactionId',id,'organizationId','${org}','branchId',branch,'deviceId',device,'cashierId','${owner}','shiftId',shift,'occurredAt',occurred,'total',2800,'cashReceived',3000,'items',jsonb_build_array(
 jsonb_build_object('productId','${feed}','unitId','${kilo}','batchId',null,'name','TEST loose feeds','unitName','Kilo','quantity','0.25','factor','1','unitPrice',3200,'unitCost',2400,'priceVersion',1,'lineTotal',800),
 jsonb_build_object('productId','${seed}','unitId','${packet}','batchId',null,'name','TEST seed packets','unitName','Packet','quantity','1','factor','1','unitPrice',2000,'unitCost',1000,'priceVersion',1,'lineTotal',2000))) from capacity_sales;
insert into public.sale_items(organization_id,sale_id,product_id,unit_id,quantity,factor,price,cost,line_total,price_version)
 select '${org}',c.id,p.product,p.unit,p.quantity,1,p.price,p.cost,p.total,1 from capacity_sales c cross join (values('${feed}'::uuid,'${kilo}'::uuid,0.25,3200,2400,800),('${seed}'::uuid,'${packet}'::uuid,1,2000,1000,2000)) p(product,unit,quantity,price,cost,total);
insert into public.payments(organization_id,branch_id,sale_id,shift_id,amount,created_at) select '${org}',branch,id,shift,2800,occurred from capacity_sales;
insert into public.inventory_movements(organization_id,branch_id,product_id,quantity,kind,source_id,created_by,created_at) select '${org}',branch,p.product,-p.quantity,'sale',c.id,'${owner}',occurred from capacity_sales c cross join (values('${feed}'::uuid,0.25),('${seed}'::uuid,1)) p(product,quantity);
insert into public.audit_events(organization_id,branch_id,actor_id,action,source_id,details,created_at) select '${org}',branch,'${owner}','record_sale',id,'{"flags":[]}',occurred from capacity_sales;
commit;
analyze public.sales; analyze public.sale_items; analyze public.payments; analyze public.inventory_movements; analyze public.audit_events;`);
const seedSeconds = (performance.now() - started) / 1000;
assert.equal(Number(sql(`select count(*) from public.sales where organization_id='${org}';`).trim()), 547500);
const consistency = sql(`select count(*) from public.branch_inventory i where i.organization_id='${org}' and i.quantity<>(select sum(m.quantity) from public.inventory_movements m where m.organization_id=i.organization_id and m.branch_id=i.branch_id and m.product_id=i.product_id and m.batch_id is not distinct from i.batch_id);`);
assert.equal(Number(consistency.trim()), 0, "Every projection must match the retained ledger");
const queryStart = performance.now();
const snapshot = lastJSON(sql(login + command("snapshot", { ...ctx(101), transactionIds: Array.from({ length: 1000 }, (_, i) => `72000000-0000-4000-8000-${String(i*5+1).padStart(12,"0")}`) })));
assert.equal(snapshot.confirmedIds.length, 1000);
sql(login + command("dashboard", ctx(101)));
const querySeconds = (performance.now() - queryStart) / 1000;
assert.ok(querySeconds < 15, `Snapshot and dashboard exceeded the app request window: ${querySeconds}s`);
const shifts = branches.map((b,i) => lastJSON(sql(login + command("open_shift", { ...ctx(b), deviceId: id(501+i), openingCash: 0 }))));
for (const s of shifts) assert.ok(s.shiftId, "Shift response must contain a shift ID");
const sale = (n,index) => ({ version: 1, transactionId: id(n), ...ctx(branches[index]), deviceId: id(501+index), cashierId: owner, shiftId: shifts[index].shiftId, occurredAt: new Date().toISOString(), total: 800, cashReceived: 1000, items: [{ productId: feed, unitId: kilo, batchId: null, name: "TEST loose feeds", unitName: "Kilo", quantity: "0.25", factor: "1", unitPrice: 3200, unitCost: 2400, priceVersion: 1, lineTotal: 800 }] });
const parallel = Array.from({ length: 5 }, (_, i) => sale(9000+i,i));
await Promise.all(parallel.map(async payload => {
  const result = await exec("docker", [...args, "-c", login + command("record_sale", payload)], { maxBuffer: 1024*1024 });
  assert.equal(lastJSON(result.stdout).status, "created");
}));
for (const payload of parallel) assert.equal(lastJSON(sql(login + command("record_sale", payload))).status, "duplicate");
const backlog = Array.from({ length: 1000 }, (_, i) => sale(10000+i,i%5));
const uploadStart = performance.now();
sql(login + backlog.map(payload => command("record_sale", payload)).join("\n"));
const uploadSeconds = (performance.now() - uploadStart) / 1000;
assert.equal(Number(sql(`select count(*) from public.sales where organization_id='${org}';`).trim()), 548505);
assert.equal(Number(sql(`select count(*) from public.inventory_movements where organization_id='${org}' and kind='sale';`).trim()), 1096005);
const summary = `Capacity passed: 547,500 historical sales, 1,095,000 historical item/movement rows, five concurrent new sales with duplicate retries and 1,000 queued uploads. Seed ${seedSeconds.toFixed(1)}s; snapshot + dashboard ${querySeconds.toFixed(2)}s; queued uploads ${uploadSeconds.toFixed(1)}s. Synthetic Linux CI evidence; Windows hardware and real-time outage gates remain unpassed.`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
