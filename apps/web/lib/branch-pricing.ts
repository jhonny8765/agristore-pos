import type {Product,SaleItem,Unit} from '@agristore/domain';

export function sellingUnitReady(product:Product,unit:Unit|undefined):boolean {
 return !!unit&&product.active&&!product.setupPending&&unit.price!==null&&
  (unit.branchId?!!unit.branchPriceId&&!!unit.branchPriceVersion:!product.pricePending);
}
export function basketPriceChanged(item:SaleItem,unit:Unit|undefined):boolean {
 return !unit||unit.price!==item.unitPrice||unit.cost!==item.unitCost||unit.priceVersion!==item.priceVersion||unit.factor!==item.factor||
 unit.branchId!==item.branchId||unit.branchPriceId!=item.branchPriceId||unit.branchPriceVersion!=item.branchPriceVersion||
 (unit.sellingPolicy??'fractional')!==(item.sellingPolicy??'fractional');
}
export interface BranchPriceRow {
 unitId:string;productId:string;name:string;sku:string;unitName:string;factor:string;baseUnit:string;
 price:number|null;branchPriceId:string|null;version:number;sellingPolicy:'fractional'|'sealed_whole';ready:boolean;
 history:{id:string;version:number;price:number;sellingPolicy:'fractional'|'sealed_whole';reason:string;at:string}[];
}
export interface BranchPriceBook {
 pricingMode:'branch'|'legacy';networkEnabled:boolean;branchId:string;branchName:string;rows:BranchPriceRow[];next:string|null;total:number;asOf:string;
}
export function verifyBranchPriceAcknowledgement(action:string,data:Record<string,unknown>,result:Record<string,unknown>):void{
 if(action==='publish_branch_unit_price'&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(result.branchPriceId))||!Number.isSafeInteger(result.version)||Number(result.version)<1||typeof result.duplicate!=='boolean'))throw Error('The price confirmation response could not be verified. Keep the original request in Sync center.');
 if(action==='apply_branch_price_copy'&&(result.id!==data.requestId||result.count!==data.expectedCount||typeof result.duplicate!=='boolean'))throw Error('The price copy response could not be verified. Keep the original request in Sync center.');
 if(action==='copy_branch_unit_prices'&&(!Array.isArray(data.copies)||result.count!==data.copies.length||typeof result.duplicate!=='boolean'))throw Error('The price copy response could not be verified. Keep the original request in Sync center.');
}

export interface PriceCopyReview {
  selection: string;
  token: string;
  units: number;
  count: number;
  rows: {
    branchId: string;
    unitId: string;
    name: string;
    sku: string;
    unitName: string;
    price: number;
    currentPrice: number | null;
    sellingPolicy: "fractional" | "sealed_whole";
    decision: "Fill" | "Replace" | "Skip";
  }[];
}
