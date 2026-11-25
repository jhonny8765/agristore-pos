export interface BranchStockScope {organizationId:string;branchId:string}
export interface BranchStockCursor extends BranchStockScope {
 scope:'branch_stock';query:string;productId:string;batchId:string|null;
}
export interface BranchStockItem {
 productId:string;batchId:string|null;baseUnit:string;
 usable:string;held:string;inTransitIn:string;inTransitOut:string;
}
export interface BranchStockPage {items:BranchStockItem[];next:BranchStockCursor|null;checkedAt:string}
export interface NetworkStockItem {productId:string;baseUnit:string;usable:string;held:string;inTransit:string}
export interface NetworkStockCursor extends BranchStockScope {scope:'network_stock';query:string;productId:string}
export interface NetworkStockPage {items:NetworkStockItem[];next:NetworkStockCursor|null;checkedAt:string}
export type BranchStockConfirmation=BranchStockScope&{query:string}&(
 {status:'ready';page:BranchStockPage}|{status:'loading'|'unavailable'}
);

/** Never display a prior business, branch or search as the current confirmation. */
export function confirmedBranchStock(scope:BranchStockScope,query:string,value:BranchStockConfirmation|undefined):BranchStockConfirmation|undefined{
 return value?.organizationId===scope.organizationId&&value.branchId===scope.branchId&&value.query===query?value:undefined;
}
export function branchStockCursor(scope:BranchStockScope,query:string,cursor:BranchStockCursor|null):BranchStockCursor|null{
 return cursor?.organizationId===scope.organizationId&&cursor.branchId===scope.branchId&&cursor.query===query?cursor:null;
}

export interface BranchStockPaging {scope?:BranchStockScope;query:string;cursor:BranchStockCursor|null}
export function updateBranchStockPaging(previous:BranchStockPaging|undefined,scope:BranchStockScope|undefined,query:string):BranchStockPaging{
 if(previous&&previous.scope?.organizationId===scope?.organizationId&&previous.scope?.branchId===scope?.branchId&&previous.query===query)return previous;
 return {scope,query,cursor:null};
}
