import {describe,it,expect} from 'vitest';
import type {Product} from '@agristore/domain';
import {nextReviewProduct,nextReviewStep,prioritizeReviewProducts,reviewCents,reviewMatches,stockAwaitingConfirmation,stockPreview} from '../../apps/web/lib/product-review';
const product={id:'test',name:'TEST item',sku:'TEST',category:'Other',baseUnit:'piece',minimumStock:'0',active:true,tracksExpiry:false,units:[],batches:[],setupPending:true,pricePending:true,sourceStock:{quantity:'1000',branchId:'test',file:'TEST.pdf',page:1,asOf:'2026-10-22',sha256:'test',pending:true}} satisfies Product;
describe('product review',()=>{
 it('prioritizes selling blockers without treating imported source amounts as usable stock',()=>{
  const unit={id:'unit',name:'Packet',factor:'1',price:100,cost:0,priceVersion:1};
  const clean={...product,units:[unit],setupPending:false,pricePending:false,sourceStock:null};
  const cost={...clean,id:'cost',name:'A cost',costPending:true};
  const price={...clean,id:'price',name:'B price',pricePending:true};
  const stocked={...price,id:'stocked',name:'Z price'};
  const source={...price,id:'source',name:'Y price',sourceStock:product.sourceStock};
  const rows=[cost,source,stocked,price],sorted=prioritizeReviewProducts(rows,new Map([['stocked:none','0.5'],['source:none','1000']]));
  expect(sorted.map(p=>p.id)).toEqual(['stocked','price','source','cost']);
  expect(rows[0]).toBe(cost);
  expect(nextReviewStep({...cost,setupPending:true}).label).toBe('Confirm selling unit');
  expect(nextReviewStep(price).label).toBe('Confirm selling price');
  expect(nextReviewStep(source).label).toBe('Confirm selling price');
  expect(reviewMatches(cost,'selling')).toBe(false);expect(reviewMatches(price,'selling')).toBe(true);
 });
 it('advances through the whole pending list instead of alternating between the first two products',()=>{const rows=['a','b','c'].map(id=>({...product,id}));expect(nextReviewProduct(rows,'a')?.id).toBe('b');expect(nextReviewProduct(rows,'b')?.id).toBe('c');expect(nextReviewProduct(rows,'c')?.id).toBe('a');expect(nextReviewProduct([rows[0]],'a')).toBeUndefined();expect(nextReviewProduct(rows,'missing')?.id).toBe('a');});
 it('keeps source evidence distinct from usable stock and overlapping review counts',()=>{expect(stockAwaitingConfirmation(product)).toBe(true);expect(['all','unit','price','stock'].map(f=>reviewMatches(product,f as 'all'))).toEqual([true,true,true,true]);expect(reviewMatches({...product,active:false},'all')).toBe(false);expect(reviewMatches({...product,setupPending:false,pricePending:false,sourceStock:{...product.sourceStock,pending:false}},'all')).toBe(false);});
 it('shows the final stock balance and difference using exact decimal conversion',()=>{expect(stockPreview('1000','0.001','0.1','liter')).toEqual({target:'1',difference:'0.9'});expect(stockPreview('0','1','5','piece')).toEqual({target:'0',difference:'-5'});expect(()=>stockPreview('1','0.5','0','piece')).toThrow();expect(()=>stockPreview('0.000001','0.000001','0','liter')).toThrow();});
 it('parses money exactly and rejects scientific notation, negatives, and unsafe centavos',()=>{expect(reviewCents('0.29')).toBe(29);expect(reviewCents('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);for(const value of ['1e3','-1','1.001','NaN','90071992547409.92'])expect(()=>reviewCents(value)).toThrow();});
 it('keeps owner questions pending until explicitly checked and separate from unresolved setup flags',()=>{const p={...product,setupPending:false,pricePending:false,sourceStock:null,ownerReview:{questions:['TEST explain packaging'],categories:['Generic unit'],source:'TEST review',queuedAt:'2026-11-03',revision:'a',complete:false}};expect(reviewMatches(p,'all')).toBe(true);expect(reviewMatches(p,'owner')).toBe(true);expect(reviewMatches(p,'checked')).toBe(false);expect(reviewMatches({...p,ownerReview:{...p.ownerReview,complete:true}},'all')).toBe(false);expect(reviewMatches({...p,ownerReview:{...p.ownerReview,complete:true},costPending:true},'all')).toBe(true);expect(reviewMatches({...p,ownerReview:{...p.ownerReview,complete:true}},'checked')).toBe(true);expect(reviewMatches({...p,active:false},'owner')).toBe(false);});
});
