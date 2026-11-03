import {describe,expect,it,vi,afterEach} from 'vitest';
import 'fake-indexeddb/auto';
import {creditAging,creditBalance,creditDueOn,manilaDay} from '@agristore/domain';
import {exportRecovery,importRecovery,saveCheckout,setSetting,applySnapshot,type PosDatabase} from '@agristore/offline';
import {setupDB,uuid,sale} from './fixtures';
vi.mock('../../apps/web/lib/api',()=>({command:vi.fn()}));
import {command} from '../../apps/web/lib/api';
import {onlineOperation,pendingOperations,retryOperation} from '../../apps/web/lib/operations';
const databases:PosDatabase[]=[];
afterEach(async()=>{vi.resetAllMocks();for(const db of databases.splice(0)){db.close();await db.delete();}});
describe('credit dates and exact balances',()=>{
 it.each([[30,'2026-12-03'],[60,'2027-01-02'],[90,'2027-02-01']] as const)('adds %s calendar days across year boundaries',(term,date)=>expect(creditDueOn('2026-11-03',term)).toBe(date));
 it('handles leap days without month arithmetic',()=>{expect(creditDueOn('2024-01-31',30)).toBe('2024-03-01');expect(()=>creditDueOn('2026-02-30',30)).toThrow();});
 it('uses the Manila date at UTC boundaries',()=>{expect(manilaDay(new Date('2026-11-02T16:00:00Z'))).toBe('2026-11-03');});
 it.each([[0,'notDue'],[1,'days1to30'],[30,'days1to30'],[31,'days31to60'],[60,'days31to60'],[61,'days61to90'],[90,'days61to90'],[91,'days91plus']] as const)('ages %s days past due',(days,bucket)=>{const now=new Date('2026-01-01T00:00:00Z');now.setUTCDate(now.getUTCDate()+days);expect(creditAging('2026-01-01',100,now.toISOString().slice(0,10))).toBe(bucket);});
 it('keeps collections and credit notes separate from sales',()=>{expect(creditBalance(1200000,200000,0)).toBe(1000000);expect(creditBalance(1200000,500000,0)).toBe(700000);expect(creditBalance(1200000,500000,700000)).toBe(0);expect(()=>creditBalance(100,80,30)).toThrow();});
});
describe('credit operation recovery',()=>{
 it('blocks cash after an uncertain credit sale, including until a causally newer stock refresh',async()=>{
  const db=await setupDB();databases.push(db);await setSetting(db,'snapshotRequestId','old-request');
  vi.mocked(command).mockRejectedValueOnce(new Error('TEST lost credit response'));
  await expect(onlineOperation(db,uuid(4),'record_credit_sale',{organizationId:uuid(1),branchId:uuid(2)},'requestId')).rejects.toThrow();
  await expect(saveCheckout(db,sale())).rejects.toThrow('Confirm the original credit sale');
  vi.mocked(command).mockResolvedValueOnce({duplicate:true});await retryOperation(db,uuid(4),(await pendingOperations(db))[0]);
  const snapshot={products:[],catalogUnchanged:true,stocks:[],confirmedIds:[],asOf:new Date().toISOString(),localScope:{organizationId:uuid(1),branchId:uuid(2)}};
  await applySnapshot(db,{...snapshot,localRequestId:'old-request'});await expect(saveCheckout(db,sale())).rejects.toThrow('refresh stock online');
  await setSetting(db,'snapshotRequestId','new-request');await applySnapshot(db,{...snapshot,localRequestId:'new-request'});await expect(saveCheckout(db,sale())).resolves.toBeDefined();
 });
 it.each(['record_credit_sale','collect_credit_payment','reverse_credit_collection','credit_refund','save_credit_client','save_credit_contact'])('restores and retries the exact original %s request',async action=>{
  const source=await setupDB(),target=await setupDB();databases.push(source,target);
  const data={organizationId:uuid(1),branchId:uuid(2),requestId:uuid(91),saleId:uuid(90),amount:12345};
  vi.mocked(command).mockRejectedValueOnce(new Error('TEST committed response lost'));
  await expect(onlineOperation(source,uuid(4),action,data,'requestId')).rejects.toThrow('response lost');
  const original=(await pendingOperations(source))[0];
  const file=JSON.parse(JSON.stringify(await exportRecovery(source,{organizationId:uuid(1),branchId:uuid(2),cashierId:uuid(4)})));
  await importRecovery(target,file);await importRecovery(target,file);
  expect(await pendingOperations(target)).toEqual([original]);
  vi.mocked(command).mockResolvedValueOnce({duplicate:true});
  await retryOperation(target,uuid(4),original);
  expect(vi.mocked(command).mock.calls.at(-1)).toEqual([action,data]);expect(await pendingOperations(target)).toHaveLength(0);
 });
});
