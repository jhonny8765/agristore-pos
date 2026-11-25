import {offlineScopeKey,verifyOfflineGrant,type Lease} from '@agristore/domain';
import {freezeOfflineGrant,requireGrantReconciled,setting,syncAllocatedReceipts,unresolvedStates,type PosDatabase} from '@agristore/offline';
import {command} from './api';
import {onlineOperation,pendingOperations,retryOperation,type PendingOperation} from './operations';
import {automaticTopupFingerprint,type OfflineBranchStatus} from './offline-stock-ui';
import {sellingUnitReady} from './branch-pricing';

export const syncAllocatedCash=(db:PosDatabase,lease:Lease)=>syncAllocatedReceipts(db,lease,original=>command('record_allocated_cash_sale',original));
export async function currentOfflineGrant(db:PosDatabase,lease:Lease){return db.offlineGrants.where('scope').equals(offlineScopeKey(lease)).filter(g=>!g.returned).first();}
export async function returnAllocatedStock(db:PosDatabase,lease:Lease){
 const pendingIssue=await setting<PendingOperation>(db,`operation:refresh_pc_stock_grant:${lease.organizationId}:${lease.branchId}`);
 if(pendingIssue)await retryOperation(db,lease.cashierId,pendingIssue);
 const local=await currentOfflineGrant(db,lease);if(!local)return;
 await freezeOfflineGrant(db,lease,local.id);
 const synced=await syncAllocatedCash(db,lease);if(synced.skipped)throw Error('This PC is still synchronizing. Keep its stock frozen and retry.');
 const checked=await requireGrantReconciled(db,lease,local.id);
 return onlineOperation(db,lease.cashierId,'return_pc_stock_grant',{organizationId:lease.organizationId,branchId:lease.branchId,grantId:local.id,finalSequence:checked.nextSequence,frozen:true,queuesEmpty:true},'requestId');
}
export const offlinePauseKey=(lease:Lease)=>`offlinePaused:${offlineScopeKey(lease)}`;
export async function pauseAllocatedStock(db:PosDatabase,lease:Lease){await db.settings.put({key:offlinePauseKey(lease),value:true});return returnAllocatedStock(db,lease);}
export async function offlineBranchStatus(scope:{organizationId:string;branchId:string;deviceId?:string}){
 const result=await command<OfflineBranchStatus>('offline_pc_status',scope);
 if(typeof result.enabled!=='boolean'||result.mode!=='automatic'||!Array.isArray(result.stocks)||!Array.isArray(result.pcs)||typeof result.checkedAt!=='string')throw Error('Offline PC status could not be verified');
 return result;
}
export async function maintainAllocatedStock(db:PosDatabase,lease:Lease){
 await prepareAllocatedPC(db,lease,process.env.NEXT_PUBLIC_APP_RELEASE??'local-build');
 let status=await offlineBranchStatus({organizationId:lease.organizationId,branchId:lease.branchId,deviceId:lease.deviceId});
 if(!status.enabled||await setting(db,offlinePauseKey(lease)))return status;
 const current=await currentOfflineGrant(db,lease),candidate=current?automaticTopupFingerprint(current,status):undefined;
 const products=await db.products.toArray();
 const eligible=products.filter(p=>p.active).flatMap(p=>p.units.filter(u=>sellingUnitReady(p,u)).map(u=>({p,u})));
 const catalogChanged=!!current&&(eligible.some(({p,u})=>{const b=current.grant.priceBook.find(b=>b.unitId===u.id);return!b||b.name!==p.name||b.unitName!==u.name||b.factor!==u.factor||b.priceVersion!==u.priceVersion||b.unitPrice!==u.price||b.unitCost!==u.cost||(b.branchPriceId??null)!==(u.branchPriceId??null)||(b.branchPriceVersion??null)!==(u.branchPriceVersion??null)||(b.sellingPolicy??'fractional')!==(u.sellingPolicy??'fractional');})||current.grant.priceBook.some(b=>!eligible.some(({u})=>u.id===b.unitId)));
 const key=`offlineTopupCheck:${offlineScopeKey(lease)}`,force=catalogChanged||!!candidate&&candidate!==await setting(db,key);
 if(force)await db.settings.put({key,value:candidate});
 const before=current?.id;const after=await refreshAllocatedStock(db,lease,force);
 if(after?.id!==before||force)status=await offlineBranchStatus({organizationId:lease.organizationId,branchId:lease.branchId,deviceId:lease.deviceId});
 return status;
}
export async function refreshAllocatedStock(db:PosDatabase,lease:Lease,force=false){
 const issue=await setting<PendingOperation>(db,`operation:refresh_pc_stock_grant:${lease.organizationId}:${lease.branchId}`);
 if(issue){await retryOperation(db,lease.cashierId,issue);return currentOfflineGrant(db,lease);}
 const current=await currentOfflineGrant(db,lease);
 if(current&&!force&&!current.frozen&&current.authority==='live'){try{verifyOfflineGrant(current.grant,lease);return current;}catch{/* Reconcile expired rights; never reuse them. */}}
 if(current)await returnAllocatedStock(db,lease);
 const status=await command('offline_pc_status',{organizationId:lease.organizationId,branchId:lease.branchId,deviceId:lease.deviceId});
 if(status.enabled!==true)return;
 // Legacy originals and stock-changing requests need a confirmed snapshot first.
 if(await db.sales.where('status').anyOf(unresolvedStates).filter(s=>s.payload.organizationId===lease.organizationId&&s.payload.branchId===lease.branchId).count()||(await pendingOperations(db)).some(p=>p.data.organizationId===lease.organizationId&&p.data.branchId===lease.branchId))throw Error('Synchronize the original receipts and requests before preparing offline stock');
 await onlineOperation(db,lease.cashierId,'refresh_pc_stock_grant',{organizationId:lease.organizationId,branchId:lease.branchId,deviceId:lease.deviceId,cashierId:lease.cashierId,shiftId:lease.shiftId,queuesEmpty:true},'requestId');
 return currentOfflineGrant(db,lease);
}
export async function prepareAllocatedPC(db:PosDatabase,scope:Pick<Lease,'organizationId'|'branchId'|'deviceId'|'cashierId'>,release:string){
 if(await setting(db,`offlinePrepared:${scope.organizationId}:${scope.branchId}:${scope.deviceId}`)===release)return;
 if(await db.sales.where('status').anyOf(unresolvedStates).filter(s=>s.payload.organizationId===scope.organizationId&&s.payload.branchId===scope.branchId).count()||(await pendingOperations(db)).some(p=>p.data.organizationId===scope.organizationId&&p.data.branchId===scope.branchId))return;
 return onlineOperation(db,scope.cashierId,'prepare_pc_offline',{organizationId:scope.organizationId,branchId:scope.branchId,deviceId:scope.deviceId,protocol:2,queuesEmpty:true,clientRelease:release},'requestId');
}
