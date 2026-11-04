import Decimal from 'decimal.js';
import type {Product} from '@agristore/domain';
const ExactQuantity=Decimal.clone({precision:80});
export type ReviewFilter='all'|'selling'|'owner'|'unit'|'price'|'cost'|'stock'|'checked'|'catalog';
export const stockAwaitingConfirmation=(p:Product)=>p.sourceStock?.pending===true;
export const ownerReviewPending=(p:Product)=>!!p.ownerReview&&!p.ownerReview.complete;
export function nextReviewProduct(rows:Product[],selected:string){const index=rows.findIndex(p=>p.id===selected),ordered=index<0?rows:[...rows.slice(index+1),...rows.slice(0,index)];return ordered.find(p=>p.id!==selected&&reviewMatches(p,'all'));}
export function reviewMatches(p:Product,filter:ReviewFilter){return p.active&&(filter==='catalog'?true:filter==='selling'?!!(p.setupPending||p.pricePending):filter==='owner'?ownerReviewPending(p):filter==='checked'?!!p.ownerReview?.complete:filter==='unit'?!!p.setupPending:filter==='price'?!!p.pricePending:filter==='cost'?!!p.costPending:filter==='stock'?stockAwaitingConfirmation(p):!!(ownerReviewPending(p)||p.setupPending||p.pricePending||p.costPending||stockAwaitingConfirmation(p)));}
export function nextReviewStep(p:Product){
 if(p.setupPending||!p.units.length)return {label:'Confirm selling unit',detail:'Check the actual pack and conversion before setting prices or stock.',target:'review-product-setup',rank:0};
 if(p.pricePending)return {label:'Confirm selling price',detail:'Enter the current price for the confirmed selling unit.',target:'review-product-setup',rank:0};
 if(stockAwaitingConfirmation(p))return {label:'Verify starting stock',detail:'Count the goods and review the proposed balance. The imported quantity is not usable stock.',target:'review-starting-stock',rank:1};
 if(p.costPending)return {label:'Confirm actual cost',detail:'Check the supplier record. Leave the cost unconfirmed if the evidence is unavailable.',target:'review-product-setup',rank:2};
 if(ownerReviewPending(p))return {label:'Answer owner questions',detail:'Check the remaining questions against the product and original records.',target:'review-owner-answer',rank:3};
 return {label:'Setup checks complete',detail:'Recorded values remain available below. Recheck them if the physical product or records differ.',target:'review-product-setup',rank:4};
}
export function prioritizeReviewProducts(rows:Product[],stock:Map<string,string>=new Map()){
 const stocked=new Set<string>();
 for(const [key,quantity] of stock)if(new Decimal(quantity).gt(0))stocked.add(key.split(':')[0]);
 return [...rows].sort((a,b)=>nextReviewStep(a).rank-nextReviewStep(b).rank||Number(stocked.has(b.id)&&!stockAwaitingConfirmation(b))-Number(stocked.has(a.id)&&!stockAwaitingConfirmation(a))||a.name.localeCompare(b.name)||a.sku.localeCompare(b.sku)||a.id.localeCompare(b.id));
}
export function reviewCents(value:string){if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Enter an exact amount with up to two decimal places.');const cents=new Decimal(value).mul(100);if(cents.gt(Number.MAX_SAFE_INTEGER))throw Error('This amount is too large.');return cents.toNumber();}
export function stockPreview(quantity:string,factor:string,current:string,baseUnit:string){if(!/^\d{1,12}(\.\d{1,6})?$/.test(quantity))throw Error('Enter the reviewed current quantity.');if(!/^\d{1,12}(\.\d{1,6})?$/.test(factor)||new ExactQuantity(factor).lte(0))throw Error('Enter a positive exact unit conversion.');const target=new ExactQuantity(quantity).mul(factor);if(target.decimalPlaces()>6||target.gt('99999999999999')||(baseUnit==='piece'&&!target.isInteger()))throw Error('The conversion must give an exact supported stock quantity.');return {target:target.toFixed(),difference:target.minus(current).toFixed()};}
