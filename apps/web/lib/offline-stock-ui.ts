import Decimal from 'decimal.js';
import {allocateOfflineCash,offlineScopeKey,total,verifyOfflineGrant,type Lease,type SaleItem} from '@agristore/domain';
import type {LocalOfflineGrant} from '@agristore/offline';
export interface OfflineBranchStatus{
 enabled:boolean;mode:'automatic';cohortRevision:number;checkedAt:string;cloudComplete:boolean;
 stocks:{productId:string;batchId:string|null;physical:string;reserved:string;unreserved:string}[];
 pcs:{deviceId:string;name:string;prepared:boolean|null;clientRelease:string|null;preparedAt:string|null;grantId:string|null;cashierId:string|null;shiftId:string|null;shiftOpen:boolean;expiresAt:string|null;acknowledgedSequence:number;reconciled:boolean}[];
}
export function offlineCheckoutAvailability(local:LocalOfflineGrant|undefined,lease:Lease|undefined,items:SaleItem[],now=Date.now()){
 if(!local||!lease||local.authority!=='live'||local.frozen||local.returned||local.scope!==offlineScopeKey(lease))return{ready:false,withinAllowance:false,issue:'Reconnect to prepare this PC’s offline stock.'};
 try{verifyOfflineGrant(local.grant,lease,now);}catch{return{ready:false,withinAllowance:false,issue:'Offline authorization expired. Reconnect to renew this PC’s stock.'};}
 if(items.length)try{const amount=total(items);allocateOfflineCash(local.grant,{version:1,transactionId:'00000000-0000-4000-8000-000000000001',organizationId:lease.organizationId,branchId:lease.branchId,cashierId:lease.cashierId,deviceId:lease.deviceId,shiftId:lease.shiftId,occurredAt:new Date(now).toISOString(),items,total:amount,cashReceived:amount},local.remaining,now);}catch(e){return{ready:true,withinAllowance:false,issue:e instanceof Error?e.message:'Check this PC’s offline allowance.'};}
 return{ready:true,withinAllowance:true,issue:undefined};
}
export function automaticTopupFingerprint(local:LocalOfflineGrant,status:OfflineBranchStatus){
 const exhausted=status.stocks.filter(s=>new Decimal(s.unreserved).gt(0)&&local.grant.priceBook.some(u=>u.productId===s.productId)&&!local.remaining.some(a=>a.productId===s.productId&&a.batchId===s.batchId&&new Decimal(a.remaining).gt(0)));
 return exhausted.length?JSON.stringify(exhausted.map(s=>[s.productId,s.batchId,s.physical,s.unreserved]).sort()):undefined;
}
