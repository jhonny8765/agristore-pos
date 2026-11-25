import {allocatedCashSchema,allocateOfflineCash,offlineGrantSchema,offlineScopeKey,requireLease,saleSchema,stableJSON,verifyAllocatedAck,verifyOfflineGrant,type AllocatedCashOriginal,type OfflineAllocation,type OfflineGrant,type Lease,type Sale} from '@agristore/domain';
import {setting,unresolvedStates,type LocalSale,type PosDatabase} from './index';

export interface LocalOfflineGrant {
 id:string;scope:string;grant:OfflineGrant;fingerprint:string;remaining:OfflineAllocation[];
 nextSequence:number;acknowledgedSequence:number;frozen:boolean;returned:boolean;authority:'live'|'recovered';lastSavedAt:number;
}
export interface LocalAllocation {original:AllocatedCashOriginal;fingerprint:string;grantFingerprint:string;acknowledged:boolean;}
function grantIdentity(g:OfflineGrant){return stableJSON({...g,closed:undefined,duplicate:undefined,acknowledgedSequence:undefined,allocations:g.allocations.map(a=>({productId:a.productId,batchId:a.batchId,quantity:a.quantity,expiresOn:a.expiresOn}))});}
async function context(db:PosDatabase,lease:Lease){const current=await setting<Lease>(db,'lease');if(!current||offlineScopeKey(current)!==offlineScopeKey(lease)||current.issuedAt!==lease.issuedAt||current.expiresAt!==lease.expiresAt)throw Error('The cashier context changed. Saved original receipts remain on this PC.');}
export async function installOfflineGrant(db:PosDatabase,lease:Lease,input:unknown,authority:'live'|'recovered'='live'){
 const grant=offlineGrantSchema.parse(input),fingerprint=grantIdentity(grant);
 return db.transaction('rw',[db.offlineGrants,db.settings],async()=>{
  if(authority==='live')await context(db,lease);
  const previous=await db.offlineGrants.get(grant.grantId);
  if(previous){if(previous.fingerprint!==fingerprint)throw Error('This grant already contains different authorization evidence');if(grant.closed)await db.offlineGrants.update(grant.grantId,{frozen:true,returned:true});return(await db.offlineGrants.get(grant.grantId))!;}
  let effectiveAuthority=authority,frozen=authority==='recovered'||grant.closed;
  if(authority==='live'){
   if(offlineScopeKey(grant)!==offlineScopeKey(lease))throw Error('This original grant belongs to another PC shift');
   if(grant.closed||Date.now()>=grant.expiresAt)frozen=true;else verifyOfflineGrant(grant,lease);
   if(!grant.closed&&(grant.acknowledgedSequence!==0||grant.allocations.some(a=>a.remaining!==a.quantity))){effectiveAuthority='recovered';frozen=true;}
   if(await setting(db,`offlinePaused:${offlineScopeKey(lease)}`))frozen=true;
   if(await db.offlineGrants.where('scope').equals(offlineScopeKey(lease)).filter(g=>!g.returned).count())throw Error('Reconcile the previous PC grant before preparing another');
  }
  const saved:LocalOfflineGrant={id:grant.grantId,scope:offlineScopeKey(grant),grant,fingerprint,remaining:grant.allocations,nextSequence:grant.acknowledgedSequence,acknowledgedSequence:grant.acknowledgedSequence,frozen,returned:grant.closed,authority:effectiveAuthority,lastSavedAt:0};
  await db.offlineGrants.add(saved);return saved;
 });
}
export async function saveAllocatedCash(db:PosDatabase,lease:Lease,grantId:string,input:Sale,now=Date.now()){
 const sale=saleSchema.parse(input),fingerprint=stableJSON(sale);
 return db.transaction('rw',[db.sales,db.settings,db.offlineGrants],async()=>{
  await context(db,lease);
  if(offlineScopeKey(sale)!==offlineScopeKey(lease))throw Error('The cash receipt belongs to another cashier or PC shift');
  const previous=await db.sales.get(sale.transactionId);
  if(previous){if(previous.fingerprint!==fingerprint||previous.allocation?.original.grantId!==grantId)throw Error('This checkout already contains different original evidence');return previous;}
  requireLease(lease,now);
  const local=await db.offlineGrants.get(grantId);
  if(!local||local.authority!=='live'||local.frozen||local.returned||local.scope!==offlineScopeKey(lease))throw Error('Offline stock authority is unavailable. Reconnect; restored evidence cannot authorize a new sale.');
  verifyOfflineGrant(local.grant,lease,now);
  if(await setting(db,`offlinePaused:${offlineScopeKey(lease)}`))throw Error('Offline stock is paused on this PC. Reconnect to prepare it before taking payment.');
  if(now<local.lastSavedAt-1000)throw Error('The PC clock moved backwards. Reconnect to verify offline checkout.');
  if(sale.items.some(i=>(i.discountAmount??0)>0||(i.discountBps??0)>0)&&!['owner','cashier'].includes(lease.role))throw Error('Only the owner or cashier may apply a product discount');
  for(const action of ['close_shift','record_credit_sale','record_online_sale','return_pc_stock_grant','refresh_pc_stock_grant'])if(await setting(db,`operation:${action}:${lease.organizationId}:${lease.branchId}`))throw Error('Confirm the original pending request online before another checkout. Keep this basket.');
  if(await setting(db,`credit-stock-refresh:${lease.organizationId}:${lease.branchId}`))throw Error('Refresh confirmed stock online before another offline sale');
  const remaining=allocateOfflineCash(local.grant,sale,local.remaining,now),sequence=local.nextSequence+1;
  if(!Number.isSafeInteger(sequence))throw Error('Reconnect to renew this stock allowance');
  const original=allocatedCashSchema.parse({organizationId:sale.organizationId,branchId:sale.branchId,deviceId:sale.deviceId,cashierId:sale.cashierId,shiftId:sale.shiftId,transactionId:sale.transactionId,grantId,sequence,sale});
  const record:LocalSale={id:sale.transactionId,payload:sale,fingerprint,status:'pending',attempts:0,nextAttempt:now,updatedAt:now,allocation:{original,fingerprint:stableJSON(original),grantFingerprint:local.fingerprint,acknowledged:false}};
  await db.sales.add(record);
  await db.offlineGrants.update(grantId,{remaining,nextSequence:sequence,lastSavedAt:now});
  return record;
 });
}
export async function freezeOfflineGrant(db:PosDatabase,lease:Lease,id:string){
 return db.transaction('rw',[db.settings,db.offlineGrants],async()=>{await context(db,lease);const grant=await db.offlineGrants.get(id);if(!grant||grant.scope!==offlineScopeKey(lease)||grant.authority!=='live')throw Error('Return stock only from its original PC records. Restored evidence requires owner investigation.');await db.offlineGrants.update(id,{frozen:true});return{...grant,frozen:true};});
}
export async function requireGrantReconciled(db:PosDatabase,lease:Lease,id:string){
 const local=await db.offlineGrants.get(id);
 if(!local||local.scope!==offlineScopeKey(lease)||local.authority!=='live'||!local.frozen)throw Error('Freeze this PC grant and preserve its originals before returning stock');
 const records=(await db.sales.where('allocation.original.grantId').equals(id).toArray()).sort((a,b)=>a.allocation!.original.sequence-b.allocation!.original.sequence);
 if(records.length!==local.nextSequence||records.some((s,i)=>s.allocation!.original.sequence!==i+1||!s.allocation!.acknowledged)||local.acknowledgedSequence!==local.nextSequence)throw Error('Synchronize every original receipt before returning this PC allowance');
 return local;
}
export async function syncAllocatedReceipts(db:PosDatabase,lease:Lease,push:(original:AllocatedCashOriginal)=>Promise<unknown>){
 const owner=crypto.randomUUID();
 const locked=await db.transaction('rw',db.locks,async()=>{const lock=await db.locks.get('sync');if(lock&&lock.expiresAt>Date.now())return false;await db.locks.put({key:'sync',owner,expiresAt:Date.now()+45000});return true;});
 if(!locked)return{sent:0,skipped:true};let sent=0;
 async function fence(){await context(db,lease);if((await db.locks.get('sync'))?.owner!==owner)throw Error('Another synchronization replaced this cashier context. Keep the saved originals.');}
 try{
  await fence();const records=(await db.sales.where('status').anyOf(unresolvedStates).toArray()).filter(s=>s.allocation&&!s.allocation.acknowledged&&s.payload.organizationId===lease.organizationId&&s.payload.branchId===lease.branchId&&s.payload.cashierId===lease.cashierId).sort((a,b)=>a.allocation!.original.grantId.localeCompare(b.allocation!.original.grantId)||a.allocation!.original.sequence-b.allocation!.original.sequence);
  for(const saved of records){
   const allocation=saved.allocation!,original=allocatedCashSchema.parse(allocation.original);
   if(stableJSON(original)!==allocation.fingerprint||stableJSON(original.sale)!==saved.fingerprint)throw Error('The saved original cash evidence differs. Preserve this PC for owner review.');
   await fence();await db.locks.update('sync',{expiresAt:Date.now()+45000});
   try{
    const ack=verifyAllocatedAck(original,await push(original));
    await db.transaction('rw',[db.sales,db.settings,db.offlineGrants,db.locks],async()=>{
     await fence();const current=await db.sales.get(saved.id);
     if(!current||current.fingerprint!==saved.fingerprint||current.allocation?.fingerprint!==allocation.fingerprint)throw Error('The saved original changed while checking its acknowledgement');
     await db.sales.update(saved.id,{allocation:{...allocation,acknowledged:true},receipt:ack.receipt,flags:ack.flags,error:undefined,status:current.status==='synced'?'synced':'pending',updatedAt:Date.now()});
     const local=await db.offlineGrants.get(original.grantId);if(local)await db.offlineGrants.update(local.id,{acknowledgedSequence:Math.max(local.acknowledgedSequence,original.sequence)});
    });sent++;
   }catch(error){await fence();const e=error as{code?:string;status?:number};await db.sales.update(saved.id,{status:e.code==='42501'||e.status===401?'authentication_required':'retryable',attempts:saved.attempts+1,error:error instanceof Error?error.message:'Cash receipt confirmation interrupted',updatedAt:Date.now()});throw error;}
  }
  return{sent};
 }finally{await db.transaction('rw',db.locks,async()=>{if((await db.locks.get('sync'))?.owner===owner)await db.locks.delete('sync');});}
}
