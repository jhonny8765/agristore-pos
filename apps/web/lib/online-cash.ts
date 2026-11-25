import {saleSchema,stableJSON,type Lease,type Sale} from '@agristore/domain';
import {setting,type PosDatabase} from '@agristore/offline';
import {onlineOperation,type PendingOperation} from './operations';
import {returnAllocatedStock} from './allocated-cash';

export const onlineCashKey=(organizationId:string,branchId:string)=>`operation:record_online_sale:${organizationId}:${branchId}`;
export async function confirmOnlineCash(db:PosDatabase,lease:Lease,proposed?:Sale){
 const original=await setting<PendingOperation>(db,onlineCashKey(lease.organizationId,lease.branchId));
 const payload=saleSchema.parse(original?.data??proposed);
 if(payload.organizationId!==lease.organizationId||payload.branchId!==lease.branchId||payload.cashierId!==lease.cashierId||payload.deviceId!==lease.deviceId||payload.shiftId!==lease.shiftId)throw new Error('Confirm this cash sale as its original cashier and shift. Preserve this PC and request.');
 const cached=await db.sales.get(payload.transactionId);
 if(cached){
  // Reloading/another window may already have confirmed this exact attempt.
  if(cached.status!=='synced'||stableJSON({...cached.payload,occurredAt:payload.occurredAt})!==stableJSON(payload))throw new Error('This sale reference already has different saved details. Check the original receipt.');
  return cached;
 }
 if(!original)await returnAllocatedStock(db,lease);
 await onlineOperation(db,lease.cashierId,'record_online_sale',payload,'transactionId');
 const saved=await db.sales.get(payload.transactionId);
 if(!saved||saved.status!=='synced')throw new Error('The confirmed receipt could not be read on this PC. Check the original sale reference before selling again.');
 return saved;
}
