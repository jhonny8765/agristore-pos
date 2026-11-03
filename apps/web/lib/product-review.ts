import Decimal from 'decimal.js';
import type {Product} from '@agristore/domain';
const ExactQuantity=Decimal.clone({precision:80});
export type ReviewFilter='all'|'unit'|'price'|'cost'|'stock'|'catalog';
export const stockAwaitingConfirmation=(p:Product)=>p.sourceStock?.pending===true;
export function reviewMatches(p:Product,filter:ReviewFilter){return p.active&&(filter==='catalog'?true:filter==='unit'?!!p.setupPending:filter==='price'?!!p.pricePending:filter==='cost'?!!p.costPending:filter==='stock'?stockAwaitingConfirmation(p):!!(p.setupPending||p.pricePending||p.costPending||stockAwaitingConfirmation(p)));}
export function reviewCents(value:string){if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Enter an exact amount with up to two decimal places.');const cents=new Decimal(value).mul(100);if(cents.gt(Number.MAX_SAFE_INTEGER))throw Error('This amount is too large.');return cents.toNumber();}
export function stockPreview(quantity:string,factor:string,current:string,baseUnit:string){if(!/^\d{1,12}(\.\d{1,6})?$/.test(quantity))throw Error('Enter the reviewed current quantity.');if(!/^\d{1,12}(\.\d{1,6})?$/.test(factor)||new ExactQuantity(factor).lte(0))throw Error('Enter a positive exact unit conversion.');const target=new ExactQuantity(quantity).mul(factor);if(target.decimalPlaces()>6||target.gt('99999999999999')||(baseUnit==='piece'&&!target.isInteger()))throw Error('The conversion must give an exact supported stock quantity.');return {target:target.toFixed(),difference:target.minus(current).toFixed()};}
