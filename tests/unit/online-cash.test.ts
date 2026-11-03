import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../../apps/web/lib/api',()=>({command:vi.fn()}));
import {command} from '../../apps/web/lib/api';
import {confirmOnlineCash} from '../../apps/web/lib/online-cash';
import {pendingOperations,retryOperation} from '../../apps/web/lib/operations';
import {saveCheckout,setSetting,exportRecovery,importRecovery,type PosDatabase} from '@agristore/offline';
import {lease,sale,setupDB} from './fixtures';
const opened:PosDatabase[]=[];
async function db(){const d=await setupDB();opened.push(d);return d;}
afterEach(async()=>{vi.resetAllMocks();for(const d of opened.splice(0)){d.close();await d.delete();}});
it('does not complete a local offline checkout with an online-only lease',async()=>{
 const d=await db();await setSetting(d,'lease',{...lease(),onlineOnly:true});await expect(saveCheckout(d,sale())).rejects.toThrow('requires online confirmation');expect(await d.sales.count()).toBe(0);
});
it('keeps an interrupted online attempt durable and exports it without claiming a completed sale',async()=>{
 const d=await db(),payload=sale();vi.mocked(command).mockRejectedValue(new Error('TEST response interrupted'));
 await expect(confirmOnlineCash(d,lease(),payload)).rejects.toThrow('interrupted');expect(await d.sales.count()).toBe(0);const [original]=await pendingOperations(d);expect(original.data).toEqual(payload);
 const file=JSON.parse(JSON.stringify(await exportRecovery(d)));expect(file.pendingOperations[0].data).toEqual(payload);
 const target=await db();await importRecovery(target,file,[],{organizationId:payload.organizationId,branchId:payload.branchId,cashierId:payload.cashierId,role:'owner'});expect((await pendingOperations(target))[0].data).toEqual(payload);
 vi.mocked(command).mockResolvedValue({transactionId:payload.transactionId,status:'duplicate',receipt:'TEST-ORIGINAL'});
 const confirmed=await confirmOnlineCash(d,lease());expect(confirmed).toMatchObject({payload,status:'synced',receipt:'TEST-ORIGINAL'});expect(await pendingOperations(d)).toEqual([]);expect(vi.mocked(command).mock.calls.at(-1)).toEqual(['record_online_sale',payload]);
 await retryOperation(target,payload.cashierId,(await pendingOperations(target))[0]);expect(await target.sales.get(payload.transactionId)).toMatchObject({payload,status:'synced',receipt:'TEST-ORIGINAL'});
});
it('preserves the request when a malformed response cannot prove a committed receipt',async()=>{
 const d=await db(),payload=sale();vi.mocked(command).mockResolvedValue({status:'created',transactionId:payload.transactionId});await expect(confirmOnlineCash(d,lease(),payload)).rejects.toThrow('could not be verified');expect(await d.sales.count()).toBe(0);expect(await pendingOperations(d)).toHaveLength(1);
});
it('leaves no receipt after a confirmed stock rollback and permits a corrected new request',async()=>{
 const d=await db(),payload=sale();vi.mocked(command).mockRejectedValue({code:'P0001',message:'Not enough confirmed saleable stock'});await expect(confirmOnlineCash(d,lease(),payload)).rejects.toMatchObject({code:'P0001'});expect(await d.sales.count()).toBe(0);expect(await pendingOperations(d)).toEqual([]);
 vi.mocked(command).mockResolvedValue({status:'created',transactionId:payload.transactionId,receipt:'TEST-CORRECTED'});expect((await confirmOnlineCash(d,lease(),payload)).status).toBe('synced');
});
