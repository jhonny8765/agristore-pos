import type {Branch,Lease,Membership,Snapshot} from '@agristore/domain';
import {resumeBranch} from './resume-branch';

export interface BranchNetwork {
 enabled:boolean;
 managed?:boolean;
 requestNetworkEnabled?:boolean;
 hubBranchId:string|null;
 branches:{id:string;name:string;code:string;canRequest:boolean;canDispatch:boolean;canReceive:boolean}[];
}

export function branchAdministrationLocked(branches:Branch[],network:BranchNetwork|undefined):boolean{
 return network?.managed===true||branches.some(branch=>branch.managementLocked);
}
export function cachedOperatingBranches(branches:Branch[],workingBranchId:string|undefined):Branch[]{
 const fixed=branches.find(branch=>branch.managementLocked);
 return fixed?[fixed]:branches.filter(branch=>branch.id===workingBranchId);
}
export function networkWorkspaceAllowed(view:string,network:Pick<BranchNetwork,'enabled'>|undefined):boolean{
 return view!=='transfers'||network?.enabled===true;
}
export function cachedOperatingLease<T extends {branchId:string}>(saved:T|undefined,branches:Branch[]):T|undefined{
 return saved&&branches.some(branch=>branch.id===saved.branchId)?saved:undefined;
}
export function cachedCatalogScopeAllowed(scope:{organizationId:string;branchId:string}|undefined,organizationId:string|undefined,branchId:string|undefined):boolean{
 return !!scope&&scope.organizationId===organizationId&&scope.branchId===branchId;
}
export function resolveOnlineBranchSession(member:Membership,branches:Branch[],saved:Lease|undefined,scope:Snapshot['localScope']):{
 lease:Lease|undefined;branchId:string|undefined;savedBranchEnabled:boolean;retiredCachedBranch:boolean;unresolvedShift:boolean;
}{
 const savedBranchEnabled=!saved||branches.some(branch=>branch.id===saved.branchId);
 const permittedRole=['owner','manager','cashier'].includes(member.role);
 const originalIdentity=saved?.organizationId===member.organizationId
  &&saved.cashierId===member.userId;
 const branchAssignment=member.role==='owner'||saved?.branchId===member.branchId;
 const verifiedLease=saved&&savedBranchEnabled&&originalIdentity
  &&permittedRole&&branchAssignment&&saved.role===member.role?saved:undefined;
 const target=verifiedLease?.branchId??resumeBranch(member,branches,scope)
  ??(member.role==='owner'?branches[0]?.id:branches.find(branch=>branch.id===member.branchId)?.id);
 return {
  lease:verifiedLease,
  branchId:target,
  savedBranchEnabled,
  retiredCachedBranch:scope?.organizationId===member.organizationId&&!branches.some(branch=>branch.id===scope.branchId),
  unresolvedShift:!!saved&&savedBranchEnabled&&!verifiedLease,
 };
}
