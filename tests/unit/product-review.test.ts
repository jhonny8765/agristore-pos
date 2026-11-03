import {describe,it,expect} from 'vitest';
import type {Product} from '@agristore/domain';
import {reviewCents,reviewMatches,stockAwaitingConfirmation,stockPreview} from '../../apps/web/lib/product-review';
const product={id:'test',name:'TEST item',sku:'TEST',category:'Other',baseUnit:'piece',minimumStock:'0',active:true,tracksExpiry:false,units:[],batches:[],setupPending:true,pricePending:true,sourceStock:{quantity:'1000',branchId:'test',file:'TEST.pdf',page:1,asOf:'2026-10-22',sha256:'test',pending:true}} satisfies Product;
describe('product review',()=>{
 it('keeps source evidence distinct from usable stock and overlapping review counts',()=>{expect(stockAwaitingConfirmation(product)).toBe(true);expect(['all','unit','price','stock'].map(f=>reviewMatches(product,f as 'all'))).toEqual([true,true,true,true]);expect(reviewMatches({...product,active:false},'all')).toBe(false);expect(reviewMatches({...product,setupPending:false,pricePending:false,sourceStock:{...product.sourceStock,pending:false}},'all')).toBe(false);});
 it('shows the final stock balance and difference using exact decimal conversion',()=>{expect(stockPreview('1000','0.001','0.1','liter')).toEqual({target:'1',difference:'0.9'});expect(stockPreview('0','1','5','piece')).toEqual({target:'0',difference:'-5'});expect(()=>stockPreview('1','0.5','0','piece')).toThrow();expect(()=>stockPreview('0.000001','0.000001','0','liter')).toThrow();});
 it('parses money exactly and rejects scientific notation, negatives, and unsafe centavos',()=>{expect(reviewCents('0.29')).toBe(29);expect(reviewCents('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);for(const value of ['1e3','-1','1.001','NaN','90071992547409.92'])expect(()=>reviewCents(value)).toThrow();});
});
