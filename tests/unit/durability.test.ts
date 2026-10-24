import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, expect, it, vi } from "vitest";
import { stableJSON } from "@agristore/domain";
import { PosDatabase, exportRecovery, exportRecoveryPart, importRecovery, readLocalSales, localStock, type LocalSale } from "@agristore/offline";
import { preferredBatch, outstandingTransfer } from "../../apps/web/lib/stock-controls";
import { product, sale, setupDB, uuid } from "./fixtures";

const databases: PosDatabase[] = [];
const scope = {organizationId:uuid(1),branchId:uuid(2),cashierId:uuid(4)};
async function db() { const value=await setupDB(); databases.push(value); return value; }
function record(n: number, status: LocalSale["status"] = "synced"): LocalSale {
  const payload = sale({transactionId:uuid(n+10000),occurredAt:new Date(Date.UTC(2026,0,1)+n*1000).toISOString()});
  return {id:payload.transactionId,payload,fingerprint:stableJSON(payload),status,attempts:0,nextAttempt:0,updatedAt:Date.now()};
}
afterEach(async () => { vi.restoreAllMocks(); for(const d of databases.splice(0)) {d.close(); await d.delete();} });

it("upgrades v1 indexes without changing saved IDs, states, prices or payloads",async()=>{
  const name=crypto.randomUUID(); const old=new Dexie(name);
  old.version(1).stores({products:"id,sku,category",stocks:"key,productId",sales:"id,status,nextAttempt",settings:"key",locks:"key"});
  const original=record(1,"review_required");
  await old.table("sales").put(original); old.close();
  const current=new PosDatabase(name); databases.push(current);
  expect(await current.sales.get(original.id)).toEqual(original);
  const view=await readLocalSales(current,scope);
  expect(view.sales.map(s=>s.id)).toEqual([original.id]);
});

it("keeps normal local reads bounded with 10000 retained sales and includes every unresolved record",async()=>{
  const d=await db();
  for(let n=0;n<10000;n+=1000) await d.sales.bulkPut(Array.from({length:1000},(_,i)=>record(n+i)));
  const waiting=[record(10001,"pending"),record(10002,"sending"),record(10003,"authentication_required")];
  await d.sales.bulkPut(waiting);
  const fullRead=vi.spyOn(d.sales,"toArray").mockRejectedValue(new Error("Unbounded history read"));
  const view=await readLocalSales(d,scope);
  expect(view.total).toBe(10003); expect(view.hasOlder).toBe(true); expect(view.allPendingCount).toBe(3);
  expect(view.sales).toHaveLength(50);
  expect(waiting.every(s=>view.sales.some(r=>r.id===s.id))).toBe(true);
  const file=await exportRecovery(d,scope);
  expect(file.sales).toHaveLength(3); expect(file.archive.totalRecords).toBe(3);
  expect(fullRead).not.toHaveBeenCalled();
},180000);

it("exports stable numbered parts, restores out of order and resumes duplicates without copying synced history",async()=>{
  const source=await db(),target=await db();
  const rows=Array.from({length:1001},(_,n)=>record(n,"pending")); await source.sales.bulkPut(rows);
  const first=await exportRecovery(source,scope);
  expect(first.sales).toHaveLength(1000); expect(first.archive.parts).toBe(2);
  // A later sale must not change the captured archive's count or paging.
  await source.sales.put(record(5000,"pending"));
  const second=await exportRecoveryPart(source,first.archive.id,2,scope);
  expect(second.sales).toHaveLength(1); expect(second.archive.totalRecords).toBe(1001);
  await importRecovery(target,second); await importRecovery(target,first); await importRecovery(target,second);
  expect(await target.sales.count()).toBe(1001);
  expect((await target.sales.get(rows[0].id))?.payload).toEqual(rows[0].payload);
  expect(await source.sales.count()).toBe(1002);
  await expect(exportRecoveryPart(source,first.archive.id,2,{...scope,branchId:uuid(99)})).rejects.toThrow("this account");
},30000);

it("rejects edited parts before writes and keeps archive progress recoverable",async()=>{
  const source=await db(),target=await db(); await source.sales.add(record(1,"pending"));
  const file=await exportRecovery(source,scope);
  const edited=structuredClone(file); edited.sales[0].payload.cashReceived++;
  await expect(importRecovery(target,edited)).rejects.toThrow("checksum");
  expect(await target.sales.count()).toBe(0);
  await importRecovery(target,file);
  expect(await target.settings.get(`restored:${file.archive.id}:1`)).toBeDefined();
});

it("restores a legacy 10001-record export and uses only server-verified acknowledgments to prevent double deductions",async()=>{
  const d=await db(); const rows=Array.from({length:10001},(_,n)=>record(n));
  await importRecovery(d,{version:1,sales:rows},rows.map(s=>s.id));
  expect(await d.sales.count()).toBe(10001);
  expect(await d.sales.where("status").anyOf(["pending","sending","authentication_required","retryable","review_required"]).count()).toBe(0);
  expect((await localStock(d)).get(`${product.id}:none`)).toBe("500");
  await importRecovery(d,{version:1,sales:rows},rows.map(s=>s.id));
  expect(await d.sales.count()).toBe(10001);
},60000);

it("validates all legacy rows before any part is committed and refuses conflicting UUIDs",async()=>{
  const d=await db(); const one=record(1,"pending");
  await expect(importRecovery(d,{version:1,sales:[one,{...one,payload:{...one.payload,cashReceived:99999}}]})).rejects.toThrow("conflicting");
  expect(await d.sales.count()).toBe(0);
  await expect(importRecovery(d,{version:1,sales:[one,{payload:sale({branchId:uuid(99)})}]})).rejects.toThrow("another business");
  expect(await d.sales.count()).toBe(0);
});

it("chooses the earliest-expiring available branch lot and refuses expired or empty lots",()=>{
  const p={...product,tracksExpiry:true,batches:[{id:uuid(41),lot:"empty",expiresOn:"2026-11-01"},{id:uuid(42),lot:"later",expiresOn:"2026-12-01"},{id:uuid(43),lot:"earliest available",expiresOn:"2026-11-10"},{id:uuid(44),lot:"expired",expiresOn:"2026-10-01"}]};
  const stock=new Map([[`${p.id}:${uuid(41)}`,"0"],[`${p.id}:${uuid(42)}`,"1"],[`${p.id}:${uuid(43)}`,"0.25"],[`${p.id}:${uuid(44)}`,"100"]]);
  expect(preferredBatch(p,stock,"2026-10-25")).toBe(uuid(43));
  expect(()=>preferredBatch(p,new Map(),"2026-10-25")).toThrow("No unexpired lot");
  expect(outstandingTransfer({quantity:"10",received_quantity:"8",held_quantity:"1",lost_quantity:"0.25"})).toBe("0.75");
});
