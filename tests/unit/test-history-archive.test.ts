import 'fake-indexeddb/auto';
import {createHash} from 'node:crypto';
import {afterEach,expect,it} from 'vitest';
import {stableJSON,type Snapshot} from '@agristore/domain';
import {applySnapshot,exportRecovery,importRecovery,saveCheckout,setting,type PosDatabase} from '@agristore/offline';
import {lease,product,sale,setupDB,uuid} from './fixtures';
const opened:PosDatabase[]=[];
async function db(){const d=await setupDB();opened.push(d);return d;}
afterEach(async()=>{for(const d of opened.splice(0)){d.close();await d.delete();}});
const hash=(p:unknown)=>createHash('sha256').update(stableJSON(p)).digest('hex');
function snapshot(payload:ReturnType<typeof sale>):Snapshot{return {products:[product],stocks:[{key:product.id+':none',productId:product.id,batchId:null,quantity:'445'}],confirmedIds:[],asOf:new Date().toISOString(),localScope:{organizationId:payload.organizationId,branchId:payload.branchId},historyArchive:{id:uuid(99),organizationId:payload.organizationId,branchId:payload.branchId,sales:[{id:payload.transactionId,fingerprint:hash(payload)}],shiftIds:[payload.shiftId]}};}
it('archives only exact backed-up originals, preserves unknown records and current stock/catalog/PC settings',async()=>{
 const d=await db(),old=await saveCheckout(d,sale()),unknown=await saveCheckout(d,sale());
 await applySnapshot(d,snapshot(old.payload));
 expect(await d.sales.get(old.id)).toBeUndefined();expect(await d.sales.get(unknown.id)).toEqual(unknown);
 expect(await d.products.get(product.id)).toEqual(product);expect((await d.stocks.toArray())[0].quantity).toBe('445');expect(await setting(d,'lease')).toBeUndefined();
});
it('rolls the whole snapshot back on a conflicting original and retains stock and records',async()=>{
 const d=await db(),old=await saveCheckout(d,sale());const next=snapshot({...old.payload,cashReceived:6000});
 await expect(applySnapshot(d,next)).rejects.toThrow('differs');expect(await d.sales.get(old.id)).toEqual(old);expect((await d.stocks.toArray())[0].quantity).toBe('500');expect(await setting(d,'lease')).toBeDefined();
});
it('rejects a cross-branch archive before touching local stock or history',async()=>{
 const d=await db(),old=await saveCheckout(d,sale());const next=snapshot(old.payload);next.historyArchive!.branchId=uuid(777);
 await expect(applySnapshot(d,next)).rejects.toThrow('scope');expect(await d.sales.get(old.id)).toEqual(old);expect((await d.stocks.toArray())[0].quantity).toBe('500');
});
it('ordinary recovery replay cannot resurrect archived sales or change stock; new purchases remain allowed',async()=>{
 const d=await db(),old=await saveCheckout(d,sale()),file=await exportRecovery(d);const next=snapshot(old.payload);
 await applySnapshot(d,next);await d.settings.put({key:'lease',value:lease()});await importRecovery(d,file,[],{...lease(),role:'owner'});expect(await d.sales.count()).toBe(0);expect((await d.stocks.toArray())[0].quantity).toBe('445');
 await expect(saveCheckout(d,old.payload)).rejects.toThrow('archived');
 // A later authorized shift remains independent of the archived test shift.
 await d.settings.put({key:'lease',value:lease()});expect((await saveCheckout(d,sale())).id).not.toBe(old.id);
});
it('continues enforcing cached tombstones when the server omits an already-applied archive',async()=>{
 const d=await db(),old=await saveCheckout(d,sale()),next=snapshot(old.payload);await applySnapshot(d,next);await d.sales.put(old);
 const subsequent={...next,historyArchive:undefined};await applySnapshot(d,subsequent);expect(await d.sales.count()).toBe(0);
});
