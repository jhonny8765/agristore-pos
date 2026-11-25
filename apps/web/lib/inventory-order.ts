import Decimal from 'decimal.js';
import type {Product} from '@agristore/domain';
import {stockAwaitingConfirmation} from './product-review';

const ExactQuantity=Decimal.clone({precision:40});

export const inventoryStates={pending:'Awaiting confirmation',unit:'Unit needed',out:'Out of stock',low:'Low stock',in:'In stock'} as const;
export type InventorySort={key:'price'|'quantity'|'status';direction:'ascending'|'descending'};
export function inventoryQuantities(stock:Map<string,string>){
 const quantities=new Map<string,Decimal>();
 for(const [key,value] of stock){const productId=key.split(':')[0];quantities.set(productId,(quantities.get(productId)??new ExactQuantity(0)).plus(value));}
 return quantities;
}
export function inventoryState(p:Product,quantity:Decimal){return stockAwaitingConfirmation(p)&&(p.setupPending||quantity.eq(0))?'pending':p.setupPending?'unit':quantity.lte(0)?'out':quantity.lte(p.minimumStock)?'low':'in';}
export function compareProductNames(a: Product, b: Product) {
 return a.name.localeCompare(b.name,'en',{numeric:true})||a.sku.localeCompare(b.sku,'en',{numeric:true})||a.id.localeCompare(b.id);
}
export function orderInventory(rows:Product[],quantities:Map<string,Decimal>,sort:InventorySort){
 const quantity=(p:Product)=>quantities.get(p.id)??new Decimal(0);
 const value=(p:Product):Decimal|string|null=>sort.key==='price'?!p.units.length||p.units[0].price===null||p.pricePending&&!p.units[0].branchId?null:new Decimal(p.units[0].price):sort.key==='quantity'?p.setupPending||stockAwaitingConfirmation(p)&&quantity(p).eq(0)?null:quantity(p):inventoryStates[inventoryState(p,quantity(p))];
 const values=new Map(rows.map(p=>[p.id,value(p)]));
 return [...rows].sort((a,b)=>{
  const av=values.get(a.id)!,bv=values.get(b.id)!;
  if(av===null||bv===null){if(av!==bv)return av===null?1:-1;}
  else{const compared=typeof av==='string'&&typeof bv==='string'?av.localeCompare(bv,'en'):new Decimal(av).cmp(bv);if(compared)return sort.direction==='ascending'?compared:-compared;}
  return compareProductNames(a,b);
 });
}
