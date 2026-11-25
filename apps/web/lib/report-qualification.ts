import type {HistoryColumn} from './history';
export interface OfflineReportState {organizationId:string;branchId:string;asOf:string;outstandingGrants:number}
export const cloudReportNotice='Cloud-confirmed records only. Offline PCs may have paid sales awaiting upload. Reconcile every PC before treating branch totals as complete.';
export function reportQualification(report:{organizationId?:string;branchId:string;asOf:string;offlineReport?:OfflineReportState}){
 const state=report.offlineReport;
 const verified=state&&state.branchId===report.branchId&&(!report.organizationId||state.organizationId===report.organizationId)&&Number.isFinite(Date.parse(report.asOf))&&Date.parse(state.asOf)===Date.parse(report.asOf)&&Number.isSafeInteger(state.outstandingGrants)&&state.outstandingGrants>=0;
 return `${cloudReportNotice} ${verified?`${state.outstandingGrants} offline grants outstanding at report time (${state.asOf}). This is a historical check.`:'Offline completeness unknown.'}`;
}
export function reportQualificationColumn(report:Parameters<typeof reportQualification>[0]):HistoryColumn{
 const label=reportQualification(report);return{label:`Reporting qualification: ${label}`,value:()=>label};
}
