import {z} from 'zod';
import Decimal from 'decimal.js';
import {saleSchema,requireLease,type Lease,type Sale} from './index';

const Exact=Decimal.clone({precision:80});
const uuid=z.uuid(),cents=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const exact=z.string().regex(/^\d{1,14}(\.\d{1,6})?$/).refine(v=>new Exact(v).lt('100000000000000'));
const positive=exact.refine(v=>new Exact(v).gt(0));
const scope={organizationId:uuid,branchId:uuid,deviceId:uuid,cashierId:uuid,shiftId:uuid};
export const offlineAllocationSchema=z.object({productId:uuid,batchId:uuid.nullable(),quantity:positive,remaining:exact,expiresOn:z.iso.date().nullable()}).strict();
export const offlineGrantSchema=z.object({
 version:z.literal(1),grantId:uuid,...scope,cohortRevision:z.number().int().positive(),issuedAt:z.number().int().nonnegative(),expiresAt:z.number().int().positive(),closed:z.boolean(),acknowledgedSequence:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),duplicate:z.boolean().optional(),
 priceBook:z.array(z.object({productId:uuid,name:z.string().min(1).max(180),baseUnit:z.enum(['kg','liter','piece','meter']),unitId:uuid,unitName:z.string().min(1).max(40),factor:positive,priceVersion:z.number().int().positive(),unitCost:cents,unitPrice:cents,branchId:uuid.nullable(),branchPriceId:uuid.nullable(),branchPriceVersion:z.number().int().positive().nullable(),sellingPolicy:z.enum(['fractional','sealed_whole'])}).strict()),
 allocations:z.array(offlineAllocationSchema),
}).strict().superRefine((g,ctx)=>{
 if(g.expiresAt<=g.issuedAt||g.expiresAt-g.issuedAt>12*3600000)ctx.addIssue({code:'custom',message:'Invalid stock authorization interval'});
 const units=new Set<string>(),stocks=new Set<string>(),bases=new Map<string,string>();
 for(const u of g.priceBook){
  if(units.has(u.unitId)||bases.has(u.productId)&&bases.get(u.productId)!==u.baseUnit)ctx.addIssue({code:'custom',message:'Conflicting authorized selling units'});
  units.add(u.unitId);bases.set(u.productId,u.baseUnit);
  if((u.branchId!==null||u.branchPriceId!==null||u.branchPriceVersion!==null)&&(!u.branchPriceId||!u.branchPriceVersion||u.branchId!==g.branchId))ctx.addIssue({code:'custom',message:'Incomplete branch selling authority'});
 }
 for(const a of g.allocations){const key=offlineAllocationKey(a);if(stocks.has(key)||!bases.has(a.productId)||new Exact(a.remaining).gt(a.quantity))ctx.addIssue({code:'custom',message:'Invalid or repeated stock allowance'});stocks.add(key);}
});
export type OfflineGrant=z.infer<typeof offlineGrantSchema>;
export type OfflineAllocation=z.infer<typeof offlineAllocationSchema>;
export const allocatedCashSchema=z.object({...scope,transactionId:uuid,grantId:uuid,sequence:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),sale:z.lazy(()=>saleSchema)}).strict().superRefine((o,ctx)=>{
 for(const key of [...Object.keys(scope),'transactionId'] as (keyof Sale)[])if(o[key as keyof typeof scope|'transactionId']!==o.sale[key])ctx.addIssue({code:'custom',message:'The original receipt scope does not match'});
});
export type AllocatedCashOriginal=z.infer<typeof allocatedCashSchema>;
export const offlineScopeKey=(s:Pick<Lease,keyof typeof scope>)=>[s.organizationId,s.branchId,s.deviceId,s.cashierId,s.shiftId].join(':');
export const offlineAllocationKey=(a:Pick<OfflineAllocation,'productId'|'batchId'>)=>`${a.productId}:${a.batchId??'none'}`;

export function verifyOfflineGrant(input:unknown,lease:Lease,now=Date.now()):OfflineGrant{
 requireLease(lease,now);const grant=offlineGrantSchema.parse(input);
 if(offlineScopeKey(grant)!==offlineScopeKey(lease)||grant.closed||grant.issuedAt>now+60000||grant.expiresAt>lease.expiresAt||now>=grant.expiresAt)throw Error('This offline stock authorization is unavailable or belongs to another shift');
 return grant;
}
export function allocateOfflineCash(grant:OfflineGrant,input:Sale,remaining:OfflineAllocation[],now=Date.now()):OfflineAllocation[]{
 const sale=saleSchema.parse(input),occurred=Date.parse(sale.occurredAt);
 if(offlineScopeKey(sale)!==offlineScopeKey(grant)||grant.closed||occurred<grant.issuedAt-120000||occurred>=grant.expiresAt||now>=grant.expiresAt||Math.abs(now-occurred)>120000)throw Error('The cash receipt is outside its stock authorization');
 const use=new Map<string,Decimal>();
 const today=new Date(occurred).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
 for(const item of sale.items){
  const u=grant.priceBook.find(u=>u.unitId===item.unitId);
  if(!u||(['productId','name','unitName','factor','unitCost','unitPrice','priceVersion'] as const).some(k=>item[k]!==u[k])||(['branchId','branchPriceId','branchPriceVersion'] as const).some(k=>(item[k]??null)!==u[k])||(item.sellingPolicy??'fractional')!==u.sellingPolicy)throw Error('The receipt differs from its authorized selling unit or price');
  const q=new Exact(item.quantity).mul(item.factor);
  if(q.decimalPlaces()>6||q.gte('100000000000000')||u.baseUnit==='piece'&&!q.isInteger()||u.sellingPolicy==='sealed_whole'&&(!new Exact(item.quantity).isInteger()||item.intactPackagingConfirmed!==true))throw Error('Check the whole pack, piece quantity or exact measurement');
  const key=offlineAllocationKey(item);use.set(key,(use.get(key)??new Exact(0)).plus(q));
 }
 const result=remaining.map(a=>({...a})),keys=new Set<string>();
 for(const a of result){
  const key=offlineAllocationKey(a),source=grant.allocations.find(s=>offlineAllocationKey(s)===key);
  if(keys.has(key)||!source||new Exact(a.remaining).lt(0)||new Exact(a.remaining).gt(source.quantity))throw Error('The offline allowance cannot be verified');keys.add(key);
  const q=use.get(key);if(!q)continue;
  if(q.gt(a.remaining)||a.expiresOn!==source.expiresOn||a.expiresOn&&a.expiresOn<today)throw Error('Not enough unexpired stock in this PC allowance. Reconnect before collecting payment.');
  a.remaining=new Exact(a.remaining).minus(q).toFixed();use.delete(key);
 }
 if(use.size)throw Error('This product or lot has no offline allowance on this PC');
 return result;
}
const ackSchema=z.object({...scope,transactionId:uuid,grantId:uuid,sequence:z.number().int().positive(),total:cents,cashReceived:cents,status:z.enum(['created','duplicate']),receipt:z.string().min(1),flags:z.array(z.string())}).passthrough();
export function verifyAllocatedAck(original:AllocatedCashOriginal,input:unknown){
 const ack=ackSchema.parse(input);
 if((['organizationId','branchId','deviceId','cashierId','shiftId','transactionId','grantId','sequence'] as const).some(k=>ack[k]!==original[k])||ack.total!==original.sale.total||ack.cashReceived!==original.sale.cashReceived||ack.flags.includes('stock_shortage'))throw Error('The original cash acknowledgement could not be verified. Keep the saved receipt.');
 return ack;
}
