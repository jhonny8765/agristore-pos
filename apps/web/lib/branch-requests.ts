import Decimal from 'decimal.js';
export type BranchRequestStatus='draft'|'submitted'|'approved'|'partly_dispatched'|'fully_dispatched'|'closed_partial'|'cancelled';
export interface BranchRequestLineInput {lineId:string;productId:string;unitId:string;quantity:string}
export interface BranchRequestLine {
 lineId:string;productId:string;unitId:string;productName:string;unitName:string;requestedQuantity:string;
 approvedQuantity:string|null;approvedBaseQuantity:string|null;approvedFactor:string|null;approvedBaseUnit:string|null;
 dispatchedBaseQuantity:string;cancelledBaseQuantity:string;active:boolean;
}
export interface BranchRequest {id:string;organizationId:string;destinationBranchId:string;destinationBranchName?:string;version:number;status:BranchRequestStatus;note:string;createdAt:string;createdBy:string;updatedAt:string;lines:BranchRequestLine[];duplicate?:boolean}
export interface BranchRequestCursor {scope:'branch_requests';organizationId:string;branchId:string;id:string}
export interface BranchRequestPage {items:BranchRequest[];next:BranchRequestCursor|null;canRequest:boolean;canApprove:boolean;checkedAt:string}
export const requestWorkspaceAllowed=(network:{enabled:boolean;requestNetworkEnabled?:boolean}|undefined)=>network?.enabled===true&&network.requestNetworkEnabled===true;
export function verifyBranchRequestAcknowledgement(action:string,data:Record<string,unknown>,result:Record<string,unknown>){
 const statuses:Record<string,BranchRequestStatus[]>= {save_branch_request:['draft'],submit_branch_request:['submitted'],approve_branch_request:['approved'],cancel_branch_request:['cancelled','closed_partial']};
 if(!statuses[action])return;
 if(result.id!==data.stockRequestId||result.version!==Number(data.expectedVersion)+1||!statuses[action].includes(result.status as BranchRequestStatus)||!Array.isArray(result.lines)||typeof result.duplicate!=='boolean')throw Error('The request response could not be verified. Keep the original request in Sync center.');
}
export const branchRequestStatus=(status:BranchRequestStatus)=>({draft:'Draft',submitted:'Pending approval',approved:'Approved — no stock reserved',partly_dispatched:'Partly dispatched',fully_dispatched:'Fully dispatched',closed_partial:'Closed — partial supply',cancelled:'Cancelled'})[status];
export function requestLineInput(lines:BranchRequestLineInput[]):BranchRequestLineInput[]{
 if(!lines.length||lines.length>100||new Set(lines.map(l=>l.lineId)).size!==lines.length)throw Error('Add 1 to 100 distinct request lines.');
 return lines.map(line=>{const q=new Decimal(line.quantity||'NaN');if(!line.lineId||!line.productId||!line.unitId||!q.isFinite()||q.lte(0)||q.gte('1000000000000')||q.decimalPlaces()>6)throw Error('Enter a positive quantity with at most six decimal places.');return {...line,quantity:q.toFixed()};});
}
