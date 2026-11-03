import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {applyAmountDiscount,applyLineDiscount,lineAmounts,makeItem,moneyCentavos,refundAllocation,saleSchema,type PartialRefundLine} from '@agristore/domain';
import {exportRecovery,importRecovery,saveCheckout,setSetting,type PosDatabase} from '@agristore/offline';
import {useCart} from '../../apps/web/lib/cart';
import {lease,product,sale,setupDB,uuid} from './fixtures';
const databases:PosDatabase[]=[];
afterEach(async()=>{useCart.getState().clear();for(const db of databases.splice(0)){db.close();await db.delete();}});
it('subtracts a fixed exact amount from the whole line and keeps it fixed when quantity changes',()=>{
 const original=makeItem(product,uuid(12),'2',null),item=applyAmountDiscount(original,moneyCentavos('12.29'));
 expect(lineAmounts(item)).toEqual({gross:6400,discount:1229,total:5171});expect(item.unitPrice).toBe(original.unitPrice);expect(item.unitCost).toBe(original.unitCost);
 const changed=applyAmountDiscount(makeItem(product,uuid(12),'3',null),item.discountAmount!);expect(changed.lineTotal).toBe(8371);expect(changed.discountAmount).toBe(1229);
 expect(applyAmountDiscount(item,0)).toEqual(original);expect(original).not.toHaveProperty('discountAmount');
});
it('does not treat an old percentage as a peso amount when converting an edited legacy line',()=>{
 const old=applyLineDiscount(makeItem(product,uuid(12),'2',null),1250),next=applyAmountDiscount(makeItem(product,uuid(12),'3',null),lineAmounts(old).discount);
 expect(next.discountAmount).toBe(800);expect(next.lineTotal).toBe(8800);expect(next).not.toHaveProperty('discountBps');expect(old.discountBps).toBe(1250);
});
it('rejects excess, negative, fractional and mixed discounts without replacing the original cart',()=>{
 const item=makeItem(product,uuid(12),'1',null);useCart.getState().add(item);
 for(const amount of [-1,3201,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){expect(()=>applyAmountDiscount(item,amount)).toThrow();expect(()=>useCart.getState().discount(0,amount)).toThrow();expect(useCart.getState().items[0]).toEqual(item);}
 const discounted=applyAmountDiscount(item,100);expect(saleSchema.safeParse(sale({items:[{...discounted,discountBps:0}],total:3100})).success).toBe(false);
 expect(saleSchema.safeParse(sale({items:[{...discounted,lineTotal:3101}],total:3101})).success).toBe(false);
 expect(applyAmountDiscount(item,3200).lineTotal).toBe(0);
});
it('keeps every centavo exact at the supported upper boundary',()=>{
 const item={...sale().items[0],quantity:'1',unitPrice:Number.MAX_SAFE_INTEGER,lineTotal:Number.MAX_SAFE_INTEGER};expect(applyAmountDiscount(item,9007199254740985).lineTotal).toBe(6);
});
it('partial returns allocate the net amount and cannot refund the undiscounted gross',()=>{
 const item=applyAmountDiscount({...makeItem(product,uuid(12),'3',null),unitPrice:100},199),line={...item,lineIndex:0,baseUnit:'kg',saleableAllowed:true,refundedQuantity:'0',remainingQuantity:'3',refundedAmount:0} satisfies PartialRefundLine;
 const first=refundAllocation(line,'1'),second=refundAllocation({...line,refundedQuantity:'1',remainingQuantity:'2',refundedAmount:first},'1'),last=refundAllocation({...line,refundedQuantity:'2',remainingQuantity:'1',refundedAmount:first+second},'1');expect([first,second,last]).toEqual([34,33,34]);
});
it('amount discounts survive offline recovery and exact original retries',async()=>{
 const source=await setupDB(),target=await setupDB();databases.push(source,target);const item=applyAmountDiscount(sale().items[0],123),payload=sale({items:[item],total:item.lineTotal});const saved=await saveCheckout(source,payload);expect((await saveCheckout(source,payload)).id).toBe(saved.id);
 await importRecovery(target,await exportRecovery(source),[],{organizationId:uuid(1),branchId:uuid(2),cashierId:uuid(4),role:'cashier'});expect((await target.sales.get(saved.id))!.payload).toEqual(payload);
});
it('retains owner and cashier permission boundaries for offline amount discounts',async()=>{
 const db=await setupDB();databases.push(db);await setSetting(db,'lease',{...lease(),role:'manager'});const item=applyAmountDiscount(sale().items[0],123);await expect(saveCheckout(db,sale({items:[item],total:item.lineTotal}))).rejects.toThrow('Only the owner or cashier');expect(await db.sales.count()).toBe(0);
});
