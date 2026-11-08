/** Keep the Overview request compatible with imported supplier opening balances. */
export function supplierBookRequest(organizationId:string,branchId:string){
 return {organizationId,branchId,openingBalancesSupported:true} as const;
}
