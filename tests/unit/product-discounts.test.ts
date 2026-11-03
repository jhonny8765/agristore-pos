import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it} from 'vitest';
import {applyLineDiscount,discountBasisPoints,discountedLineTotal,lineAmounts,makeItem,refundAllocation,saleSchema,stableJSON,type PartialRefundLine} from '@agristore/domain';
import {exportRecovery,importRecovery,saveCheckout,setSetting,type PosDatabase} from '@agristore/offline';
import {draftLineTotal,hasCartErrors,useCart} from '../../apps/web/lib/cart';
import {lease,product,sale,setupDB,uuid} from './fixtures';
const databases:PosDatabase[]=[];
afterEach(async()=>{useCart.getState().clear();for(const db of databases.splice(0)){db.close();await db.delete();}});
describe('percentage discounts with exact centavos',()=>{
 it.each([['0',0],['10',1000],['12.50',1250],['0.01',1],['100',10000]])('converts %s percent to %s basis points',(input,bps)=>expect(discountBasisPoints(input)).toBe(bps));
 it.each(['-1','100.01','1.234','1e1','NaN','Infinity','.','1.',''])('rejects unfinished or invalid percentage %s',input=>expect(()=>discountBasisPoints(input)).toThrow());
 it('discounts the original product line without changing catalog price, cost or stock quantity',()=>{
  const original=makeItem(product,uuid(12),'3',null),net=applyLineDiscount(original,1250);
  expect(lineAmounts(net)).toEqual({gross:9600,discount:1200,total:8400});expect(net).toMatchObject({quantity:'3',unitPrice:3200,unitCost:2400,factor:'1',discountBps:1250,lineTotal:8400});expect(original).not.toHaveProperty('discountBps');
  expect(applyLineDiscount(net,2000).lineTotal).toBe(7680);expect(applyLineDiscount(net,0)).toEqual(original);
 });
 it('rounds the discount once and preserves gross = discount + net even at half-cent ties',()=>{
  expect(discountedLineTotal('1',1,5000)).toBe(0);expect(discountedLineTotal('1',101,5000)).toBe(50);expect(discountedLineTotal('0.123456',12345,3333)).toBe(1016);
  expect(discountedLineTotal('1',Number.MAX_SAFE_INTEGER,1)).toBe(9006298534815517);
 });
 it('rejects tampered discounted totals and keeps old undiscounted payload fingerprints unchanged',()=>{
  const old=sale(),oldPrint=stableJSON(old);expect(stableJSON(saleSchema.parse(old))).toBe(oldPrint);
  const item=applyLineDiscount(old.items[0],1000);expect(()=>saleSchema.parse({...old,items:[item],total:item.lineTotal})).not.toThrow();expect(()=>saleSchema.parse({...old,items:[{...item,lineTotal:item.lineTotal+1}],total:item.lineTotal+1})).toThrow();
 });
 it('allocates repeated partial refunds from the discounted amount, never the list price',()=>{
  const line={...makeItem(product,uuid(12),'3',null),lineTotal:101,discountBps:3333,lineIndex:0,baseUnit:'kg',saleableAllowed:true,refundedQuantity:'0',remainingQuantity:'3',refundedAmount:0} satisfies PartialRefundLine;
  const a=refundAllocation(line,'1'),b=refundAllocation({...line,refundedQuantity:'1',remainingQuantity:'2',refundedAmount:a},'1'),c=refundAllocation({...line,refundedQuantity:'2',remainingQuantity:'1',refundedAmount:a+b},'1');expect([a,b,c]).toEqual([34,33,34]);expect(a+b+c).toBe(101);
 });
 it('changing a discount cannot clear an unfinished quantity or weight confirmation',()=>{
  const cart=useCart.getState();cart.add(makeItem(product,uuid(12),'1',null),'weight');const id=useCart.getState().lineIds[0];cart.discount(0,1000);expect(hasCartErrors(useCart.getState())).toBe(true);expect(draftLineTotal(useCart.getState().items[0],useCart.getState().drafts[id])).toBeNull();
  cart.edit(id,{discountError:'Invalid percentage',draft:'1'});cart.replace(0,makeItem(product,uuid(12),'1',null));expect(hasCartErrors(useCart.getState())).toBe(true);
 });
 it('preserves the exact discounted receipt across offline recovery and duplicate saves',async()=>{
  const source=await setupDB(),target=await setupDB();databases.push(source,target);const item=applyLineDiscount(makeItem(product,uuid(12),'1',null),1250),payload=sale({items:[item],total:item.lineTotal});const first=await saveCheckout(source,payload);expect((await saveCheckout(source,payload)).id).toBe(first.id);const recovery=await exportRecovery(source);await importRecovery(target,recovery,[],{organizationId:uuid(1),branchId:uuid(2),cashierId:uuid(4),role:'cashier'});expect((await target.sales.get(first.id))!.payload).toEqual(payload);
 });
 it('does not allow a manager to create a discounted offline receipt under the owner/cashier policy',async()=>{
  const db=await setupDB();databases.push(db);await setSetting(db,'lease',{...lease(),role:'manager'});const item=applyLineDiscount(makeItem(product,uuid(12),'1',null),1000);await expect(saveCheckout(db,sale({items:[item],total:item.lineTotal}))).rejects.toThrow('Only the owner or cashier');expect(await db.sales.count()).toBe(0);
 });
});
