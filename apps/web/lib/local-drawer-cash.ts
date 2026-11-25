import {offlineScopeKey,stableJSON,type Lease} from '@agristore/domain';
import {setting,setSetting,type PosDatabase} from '@agristore/offline';
import {command} from './api';
import {readDrawerExpenseSummary,type DrawerExpenseSummary} from './drawer-expenses';
export interface DrawerBaseline {organizationId:string;branchId:string;deviceId:string;cashierId:string;shiftId:string;asOf:string;includedAllocatedIds:string[];summary:DrawerExpenseSummary}
export interface DrawerEstimate {expectedCash:number|null;localCash:number|null;cloudCash:number|null;asOf?:string;reason?:string}
const key=(l:Lease)=>`drawerBaseline:${offlineScopeKey(l)}`;
const unknown=(reason:string,asOf?:string):DrawerEstimate=>({expectedCash:null,localCash:null,cloudCash:null,asOf,reason});
function readBaseline(value:unknown,l:Lease):DrawerBaseline{
 const b=value as DrawerBaseline;
 if(!b||['organizationId','branchId','deviceId','cashierId','shiftId'].some(k=>b[k as keyof DrawerBaseline]!==l[k as keyof Lease])||!Number.isFinite(Date.parse(b.asOf))||!Array.isArray(b.includedAllocatedIds)||b.includedAllocatedIds.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))||new Set(b.includedAllocatedIds).size!==b.includedAllocatedIds.length)throw Error('The checked drawer baseline could not be verified.');
 readDrawerExpenseSummary(b.summary,l.shiftId);return b;
}
export async function cacheDrawerBaseline(db:PosDatabase,l:Lease,value:unknown){
 const b=readBaseline(value,l);
 await db.transaction('rw',db.settings,async()=>{
  const current=await setting<Lease>(db,'lease');
  if(!current||offlineScopeKey(current)!==offlineScopeKey(l)||current.issuedAt!==l.issuedAt)throw Error('The current drawer changed.');
  const prior=await setting<DrawerBaseline>(db,key(l));
  if(!prior||Date.parse(prior.asOf)<Date.parse(b.asOf))await setSetting(db,key(l),b);
 });return b;
}
export async function refreshDrawerBaseline(db:PosDatabase,l:Lease){return cacheDrawerBaseline(db,l,await command('drawer_cash_baseline',{organizationId:l.organizationId,branchId:l.branchId,deviceId:l.deviceId,shiftId:l.shiftId}));}
export async function localDrawerEstimate(db:PosDatabase,l:Lease):Promise<DrawerEstimate>{
 return db.transaction('r',[db.settings,db.sales],async()=>{
  const raw=await setting<DrawerBaseline>(db,key(l));if(!raw)return unknown('Connect once to check this drawer’s cash baseline.');
  let b:DrawerBaseline;try{b=readBaseline(raw,l);}catch{return unknown('This drawer’s checked baseline needs verification.');}
  if(b.summary.expectedCash===null||b.summary.closingRestatement)return unknown('This drawer is closed or its baseline is unknown.',b.asOf);
  const pending=await db.settings.where('key').startsWith('operation:').filter(row=>{const op=row.value as {action?:string;data?:Record<string,unknown>};return op.data?.organizationId===l.organizationId&&op.data.branchId===l.branchId&&(op.data.shiftId===l.shiftId||op.data.originalShiftId===l.shiftId)&&!['prepare_pc_offline','refresh_pc_stock_grant','return_pc_stock_grant'].includes(op.action??'');}).count();
  if(pending)return unknown('A saved cash-changing request needs confirmation.',b.asOf);
  const included=new Set(b.includedAllocatedIds),receipts=await db.sales.filter(s=>!!s.allocation&&s.payload.organizationId===l.organizationId&&s.payload.branchId===l.branchId&&s.payload.deviceId===l.deviceId&&s.payload.cashierId===l.cashierId&&s.payload.shiftId===l.shiftId).toArray();
  let local=0n;
  for(const s of receipts){if(s.id!==s.payload.transactionId||s.fingerprint!==stableJSON(s.payload)||stableJSON(s.allocation!.original.sale)!==s.fingerprint||!Number.isSafeInteger(s.payload.total)||s.payload.total<0)return unknown('A local original needs verification.',b.asOf);if(!included.has(s.id))local+=BigInt(s.payload.total);}
  const cloud=BigInt(b.summary.expectedCash),total=cloud+local;
  if(total>BigInt(Number.MAX_SAFE_INTEGER)||total<BigInt(Number.MIN_SAFE_INTEGER)||local>BigInt(Number.MAX_SAFE_INTEGER))return unknown('This drawer total exceeds supported precision.',b.asOf);
  return{expectedCash:Number(total),localCash:Number(local),cloudCash:Number(cloud),asOf:b.asOf};
 });
}
