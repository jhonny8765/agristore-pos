import 'fake-indexeddb/auto';
import {afterEach,describe,it,expect} from 'vitest';
import {money,moneyInput,moneyCentavos,cashQuickAmounts,canonicalQuantity,lineAmounts,total,refundAllocation,availableCredit,creditTotalValue,type PartialRefundLine,type CreditBook,type CreditClient} from '@agristore/domain';
import {useCart,hasCartErrors} from '../../apps/web/lib/cart';
import {sale,uuid} from './fixtures';
afterEach(()=>useCart.getState().clear());
describe('exact money boundaries',()=>{
 it('preserves the centavo previously lost by credit input and currency display',()=>{expect(moneyCentavos('90071992547409.85')).toBe(9007199254740985);expect(money(9007199254740985)).toBe('₱90,071,992,547,409.85');expect(moneyInput(9007199254740985)).toBe('90071992547409.85');});
 it('roundtrips every supported centavo in the largest peso value without Number conversion',()=>{for(let cents=0;cents<=91;cents++){const input=`90071992547409.${String(cents).padStart(2,'0')}`;const expected=9007199254740900n+BigInt(cents);expect(BigInt(moneyCentavos(input))).toBe(expected);expect(moneyInput(moneyCentavos(input))).toBe(input);}expect(moneyCentavos('.29')).toBe(29);});
 it('formats account totals beyond a single safe document as exact strings',()=>{expect(money('18014398509481982')).toBe('₱180,143,985,094,819.82');expect(moneyInput('-18014398509481982')).toBe('-180143985094819.82');for(const n of [NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])expect(()=>money(n)).toThrow();});
 it.each(['','NaN','Infinity','-1','1e3','1.001','90071992547409.92'])('rejects unsupported peso input %s',v=>expect(()=>moneyCentavos(v)).toThrow());
 it('does not silently round an unrepresentable base quantity to six decimals',()=>{expect(()=>canonicalQuantity('999999999999.999999','0.999999')).toThrow('precision');expect(canonicalQuantity('1250','0.001')).toBe('1.25');});
 it('prevents oversized baskets and totals while retaining the original basket',()=>{const first={...sale().items[0],quantity:'1',unitPrice:Number.MAX_SAFE_INTEGER,lineTotal:Number.MAX_SAFE_INTEGER};useCart.getState().add(first);expect(()=>useCart.getState().add({...first,unitPrice:1,lineTotal:1})).toThrow('too large');expect(useCart.getState().items).toEqual([first]);expect(()=>total([{lineTotal:Number.MAX_SAFE_INTEGER},{lineTotal:1}])).toThrow();expect(hasCartErrors({drafts:{},quantityErrors:{},items:[first,{...first,lineTotal:1}]})).toBe(true);});
 it('allows increasing an existing quantity but blocks a 101st receipt line',()=>{
  const line=sale().items[0];
  const lines=Array.from({length:101},(_,index)=>({
   ...line,productId:uuid(1000+index),unitId:uuid(2000+index),
  }));
  for(const item of lines.slice(0,100))useCart.getState().add(item);
  const [firstLineId]=useCart.getState().lineIds;
  expect(useCart.getState().add(lines[0])).toBe(firstLineId);
  expect(useCart.getState().items[0].quantity).toBe('2');
  expect(()=>useCart.getState().add(lines[100])).toThrow('100 lines');
  expect(useCart.getState().items).toHaveLength(100);
 });
 it('uses exact tender shortcuts and never suggests an unsupported amount',()=>{expect(cashQuickAmounts(84000)).toEqual([84000,90000,100000]);expect(cashQuickAmounts(Number.MAX_SAFE_INTEGER)).toEqual([Number.MAX_SAFE_INTEGER]);});
 it('uses exact large customer debt when computing available credit',()=>{const c={limit:Number.MAX_SAFE_INTEGER,outstanding:0,outstandingExact:'18014398509481982'} as CreditClient;expect(availableCredit(c)).toBe(0);expect(availableCredit({...c,outstandingExact:'9007199254740985'})).toBe(6);expect(creditTotalValue({outstanding:0,exactTotals:{outstanding:'18014398509481982'}} as CreditBook,'outstanding')).toBe('18014398509481982');});
});
describe('independent integer arithmetic oracle',()=>{
 const round=(n:bigint,d:bigint)=>(n+d/2n)/d;
 it('matches integer-rational quantity and discount calculations across 2000 boundary/random vectors',()=>{let seed=728193n;const next=()=>seed=(seed*6364136223846793005n+1442695040888963407n)&((1n<<63n)-1n);for(let n=0;n<2000;n++){const q=n%4===0?next()%999999999999999999n+1n:next()%999999999999n+1n,price=n%4===0?next()%9007199254740991n:next()%1000000001n,bps=next()%10001n;const quantity=`${q/1000000n}.${String(q%1000000n).padStart(6,'0')}`,gross=round(q*price,1000000n);if(gross>9007199254740991n){expect(()=>lineAmounts({quantity,unitPrice:Number(price),discountBps:Number(bps)})).toThrow();continue;}const discount=round(gross*bps,10000n);expect(lineAmounts({quantity,unitPrice:Number(price),discountBps:Number(bps)})).toEqual({gross:Number(gross),discount:Number(discount),total:Number(gross-discount)});}});
 it('allocates all discounted centavos exactly once across fractional returns',()=>{for(const amount of [1,29,101,999999,9007199254740985]){let refunded=0n,paid=0;for(const q of [1n,333333n,333333n,333333n]){const original={...sale().items[0],quantity:'1',factor:'1',lineTotal:amount,baseUnit:'kg',lineIndex:0,saleableAllowed:true,refundedQuantity:`${refunded/1000000n}.${String(refunded%1000000n).padStart(6,'0')}`,remainingQuantity:String(Number(1000000n-refunded)/1000000),refundedAmount:paid} as PartialRefundLine;const expected=round(BigInt(amount)*(refunded+q),1000000n)-BigInt(paid),part=refundAllocation(original,`0.${String(q).padStart(6,'0')}`);expect(BigInt(part)).toBe(expected);paid+=part;refunded+=q;}expect(paid).toBe(amount);}});
});
