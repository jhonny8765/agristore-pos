import {requireLease,type Lease,type Sale,type SaleItem} from '@agristore/domain';
import {setting,type PosDatabase} from '@agristore/offline';
import type {LineDraft,useCart} from './cart';
export interface HeldSale {id:string;organizationId:string;branchId:string;cashierId:string;shiftId:string;savedAt:string;items:SaleItem[];lineIds:string[];drafts:Record<string,LineDraft>;quantityErrors:Record<string,string>;attemptId:string|null;cash:string;checkout?:Sale;credit?:ReturnType<typeof useCart.getState>['credit'];creditAttempt?:Record<string,unknown>}
export const heldSaleKey=(lease:Lease)=>`held-sale:${lease.organizationId}:${lease.branchId}:${lease.cashierId}:${lease.shiftId}`;
export function requireHeldScope(held:HeldSale,lease:Lease){requireLease(lease);if(held.organizationId!==lease.organizationId||held.branchId!==lease.branchId||held.cashierId!==lease.cashierId||held.shiftId!==lease.shiftId)throw Error('This held draft belongs to another cashier or shift. Keep it for that cashier.');}
export async function prepareHeldCheckout(db:PosDatabase,lease:Lease,id:string,payload:Sale,draft:Pick<HeldSale,"lineIds"|"drafts"|"quantityErrors"|"cash">) {
 await db.transaction('rw',db.settings,async()=>{const held=await setting<HeldSale>(db,heldSaleKey(lease));if(!held||held.id!==id)throw Error('The held draft changed. Keep this basket and review the held draft before checkout.');requireHeldScope(held,lease);await db.settings.put({key:heldSaleKey(lease),value:{...held,...draft,items:payload.items,attemptId:payload.transactionId,checkout:payload}});});
}
export async function removeHeldSale(db:PosDatabase,lease:Lease,id:string) {await db.transaction('rw',db.settings,async()=>{const held=await setting<HeldSale>(db,heldSaleKey(lease));if(held?.id===id){requireHeldScope(held,lease);await db.settings.delete(heldSaleKey(lease));}});}
