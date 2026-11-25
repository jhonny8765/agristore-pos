import {allocatedCashSchema,offlineGrantSchema,offlineScopeKey,stableJSON,verifyAllocatedAck,type Lease} from '@agristore/domain';
import {installOfflineGrant,requireGrantReconciled,setting,type PosDatabase} from '@agristore/offline';
import type {PendingOperation} from './operations';

export const offlineControlActions=new Set(['prepare_pc_offline','configure_offline_cash','refresh_pc_stock_grant','return_pc_stock_grant','reconcile_allocated_cash_sale']);
export async function settleOfflineControl(db:PosDatabase,pending:PendingOperation,result:Record<string,unknown>){
 const data=pending.data;
 if(pending.action==='refresh_pc_stock_grant'){
  const grant=offlineGrantSchema.parse(result);
  if((['organizationId','branchId','deviceId','cashierId','shiftId'] as const).some(k=>grant[k]!==data[k])||grant.cashierId!==pending.actorId)throw Error('The returned PC allowance belongs to another original request');
  const lease=await setting<Lease>(db,'lease');
  if(!lease||offlineScopeKey(grant)!==offlineScopeKey(lease))throw Error('The original cashier context changed. Preserve this grant request.');
  await installOfflineGrant(db,lease,grant,pending.recovered?'recovered':'live');
 }else if(pending.action==='return_pc_stock_grant'){
  if(result.grantId!==data.grantId||result.returned!==true||result.finalSequence!==data.finalSequence)throw Error('The stock-return acknowledgement could not be verified');
  const local=await db.offlineGrants.get(String(data.grantId));
  if(!local||local.grant.organizationId!==data.organizationId||local.grant.branchId!==data.branchId||local.grant.cashierId!==pending.actorId)throw Error('Keep this returned stock evidence for its original cashier');
  const lease=await setting<Lease>(db,'lease');
  if(!pending.recovered&&!local.returned){if(!lease)throw Error('Restore the original cashier context before returning this grant');await requireGrantReconciled(db,lease,local.id);}
  await db.offlineGrants.update(local.id,{frozen:true,returned:true});
 }else if(pending.action==='prepare_pc_offline'){
  if(result.deviceId!==data.deviceId||result.protocol!==2||result.prepared!==true)throw Error('PC preparation could not be verified');
  await db.settings.put({key:`offlinePrepared:${data.organizationId}:${data.branchId}:${data.deviceId}`,value:data.clientRelease});
 }else if(pending.action==='configure_offline_cash'){
  if(result.enabled!==data.enabled||result.mode!=='automatic'||!Number.isSafeInteger(result.cohortRevision))throw Error('Offline mode configuration could not be verified');
 }else if(pending.action==='reconcile_allocated_cash_sale'){
  if(result.ownerResolved!==true)throw Error('The owner resolution acknowledgement could not be verified');
  const original=allocatedCashSchema.parse(data.original),ack=verifyAllocatedAck(original,result),saved=await db.sales.get(original.transactionId);
  if(!saved?.allocation||saved.allocation.fingerprint!==stableJSON(original))throw Error('Retain this owner resolution with its original saved cash receipt');
  await db.sales.update(saved.id,{receipt:ack.receipt,flags:ack.flags,error:undefined,status:'pending',allocation:{...saved.allocation,acknowledged:true}});
  const local=await db.offlineGrants.get(original.grantId);if(local)await db.offlineGrants.update(local.id,{acknowledgedSequence:Math.max(local.acknowledgedSequence,original.sequence),frozen:true});
 }
}
