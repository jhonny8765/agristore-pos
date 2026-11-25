import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const db=new PGlite();
const org="11111111-1111-4111-8111-111111111111",magpet="22222222-2222-4222-8222-222222222222",other="33333333-3333-4333-8333-333333333333";
const owner="44444444-4444-4444-8444-444444444444",cashier="55555555-5555-4555-8555-555555555555",sale="66666666-6666-4666-8666-666666666666";
const refund="77777777-7777-4777-8777-777777777777",expense="88888888-8888-4888-8888-888888888888",shift="99999999-9999-4999-8999-999999999999";
const from="2025-11-25";

beforeAll(async()=>{
  await db.exec(`
    create schema auth; create schema app_private;
    create role authenticated; create role anon;
    grant usage on schema app_private to authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
    create function app_private.can_access(uuid,uuid) returns boolean language sql stable as $$select auth.uid() is not null and $1='${org}'::uuid$$;
    create function app_private.refund_source(uuid,uuid,uuid,text) returns jsonb language sql as $$
      select '{"evidenceComplete":true,"lines":[{"unitCost":110,"saleableQuantity":"1"}]}'::jsonb$$;
    create table staff_memberships(organization_id uuid,user_id uuid,active bool,role text);
    create table branches(organization_id uuid,id uuid,active bool,name text);
    create table sales(organization_id uuid,branch_id uuid,id uuid,occurred_at timestamptz,received_at timestamptz,total bigint,payload jsonb);
    create table sale_items(organization_id uuid,sale_id uuid,cost bigint,quantity numeric);
    create table sale_reversals(organization_id uuid,branch_id uuid,id uuid,sale_id uuid,created_at timestamptz);
    create table sale_partial_refunds(organization_id uuid,branch_id uuid,id uuid,sale_id uuid,created_at timestamptz,amount bigint);
    create table sale_refund_corrections(organization_id uuid,branch_id uuid,full_refund_id uuid,partial_refund_id uuid,sale_id uuid,created_at timestamptz,amount bigint);
    create table app_private.partial_refund_lines(organization_id uuid,refund_id uuid,line_index integer,saleable numeric);
    create table cashier_shifts(id uuid);
    create table app_private.drawer_expense_events(organization_id uuid,branch_id uuid,id uuid,expense_id uuid,shift_id uuid,kind text,amount bigint,report_adjustment bigint,business_date date,occurred_at timestamptz,recorded_at timestamptz);
    create table historical_drawer_notebooks(organization_id uuid,branch_id uuid,business_date date,gross_sales bigint,reported_expenses bigint,recorded_at timestamptz);
    insert into staff_memberships values('${org}','${owner}',true,'owner'),('${org}','${cashier}',true,'cashier');
    insert into branches values('${org}','${magpet}',true,'Magpet Branch'),('${org}','${other}',true,'Other Branch');
    insert into sales values('${org}','${magpet}','${sale}','2025-11-24T16:01:00Z','2025-11-24T16:02:00Z',500,'{"items":[{"unitCost":110}]}');
    insert into sale_items values('${org}','${sale}',110,2.5);
    insert into sale_partial_refunds values('${org}','${magpet}','${refund}','${sale}','2025-11-25T01:01:00Z',100);
    insert into app_private.partial_refund_lines values('${org}','${refund}',0,.25);
    insert into sale_refund_corrections values('${org}','${magpet}',null,'${refund}','${sale}','2025-11-26T01:01:00Z',100);
    insert into cashier_shifts values('${shift}');
    insert into app_private.drawer_expense_events values
      ('${org}','${magpet}','${expense}','${expense}','${shift}','expense',75,75,'${from}','2025-11-25T01:00:00Z','2025-11-25T01:00:00Z'),
      ('${org}','${magpet}',gen_random_uuid(),'${expense}','${shift}','return',20,0,'${from}','2025-11-25T02:00:00Z','2025-11-25T02:00:00Z'),
      ('${org}','${magpet}',gen_random_uuid(),'${expense}','${shift}','report',0,10,'${from}','2025-11-25T03:00:00Z','2025-11-25T03:00:00Z');
    insert into historical_drawer_notebooks values
      ('${org}','${magpet}','2025-11-24',410,50,'2025-11-25T03:00:00Z'),
      ('${org}','${other}','${from}',250,35,'2025-11-25T03:00:00Z');
  `);
  const sql=await readFile(new URL("../../../supabase/migrations/20261125094638_owner_financial_overview.sql",import.meta.url),"utf8");
  await db.exec(sql);
},30000);

afterAll(async()=>{await db.close();});

async function report(branch:string|null, day:string, grain:string, actor=owner) {
  return await db.transaction(async tx=>{
    await tx.query("select set_config('test.actor',$1,true)",[actor]);
    await tx.exec("set local role authenticated");
    const result=await tx.query<{report:{grain:string;branches:{id:string}[];rows:unknown[]}}>(
      "select public.owner_financial_overview($1,$2,$3,$3,$4) report",[org,branch,day,grain]);
    return result.rows[0].report;
  });
}

it("uses Manila midnight, stores fractional return adjustments once and nets expense returns",async()=>{
  const result=await report(magpet,from,"day");
  expect(result.rows).toEqual([{branchId:magpet,bucket:from,gross:"500",refunds:"100",cost:"247",expenses:"65",notebook:false,overlap:false}]);
  const hourly=await report(magpet,from,"hour");
  expect(hourly.rows[0]).toMatchObject({bucket:"2025-11-25T00:00:00",gross:"500",cost:"275"});
  const corrected=await report(magpet,"2025-11-26","day");
  expect(corrected.rows[0]).toMatchObject({gross:"0",refunds:"-100",cost:"28"});
});

it("includes the allowed branch set and surfaces notebook totals with missing costs",async()=>{
  const result=await report(null,from,"hour");
  expect(result.grain).toBe("day");
  expect(result.branches.map(branch=>branch.id)).toEqual([magpet,other]);
  expect(result.rows).toContainEqual({branchId:other,bucket:from,gross:"250",refunds:null,cost:null,expenses:"35",notebook:true,overlap:false});
  expect((await report(magpet,"2025-11-24","day")).rows[0]).toMatchObject({gross:"410",expenses:"50",cost:null});
});

it("denies cashiers, unknown branches and anonymous execution",async()=>{
  await expect(report(magpet,from,"day",cashier)).rejects.toMatchObject({code:"42501"});
  await expect(report(sale,from,"day")).rejects.toMatchObject({code:"42501"});
  const grants=await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.owner_financial_overview(uuid,uuid,date,date,text)','EXECUTE') allowed");
  expect(grants.rows).toEqual([{allowed:false}]);
});
