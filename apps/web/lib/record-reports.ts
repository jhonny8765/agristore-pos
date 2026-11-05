import {historyBounds,historyCsv,type HistoryColumn} from './history';
export const recordKinds={receipts:'Sales & receipts',credit_invoices:'Customer invoices',credit_payments:'Customer payments',supplier_invoices:'Supplier bills',supplier_payments:'Supplier activity',stock:'Stock movements',purchases:'Receiving history',audit:'Audit history'} as const;
export type RecordKind=keyof typeof recordKinds;
export type ReportRow=Record<string,string|null>;
export interface ReportFilters{kind:RecordKind;query:string;status:string;from:string;to:string;entityId?:string}
export interface RecordReport{organizationId:string;branchId:string;entityId:string;kind:RecordKind;asOf:string;filters:Omit<ReportFilters,'kind'|'entityId'>;rows:ReportRow[];total:number;next:number|null;complete:boolean}
export function defaultReport(kind:RecordKind,now=Date.now()):ReportFilters{
 const today=new Date(now+8*3600000).toISOString().slice(0,10),debt=kind==='credit_invoices'||kind==='supplier_invoices';
 return {kind,query:'',status:debt?'outstanding':'all',from:debt?'':today.slice(0,8)+'01',to:debt?'':today};
}
export function validateRecordReport(report:RecordReport,scope:{organizationId:string;branchId:string},filters:ReportFilters,exporting=false){
 historyBounds(filters);
 if(report.entityId!==(filters.entityId??'')||report.next!==null&&(!Number.isSafeInteger(report.next)||report.next<0))throw Error('The account or record page changed. Refresh before exporting.');
 if(Array.isArray(report.rows))for(const row of report.rows)for(const key of ['amount','cash','paid','credited','balance','tender','change'])if(row?.[key]!=null)reportMoney(row[key]);
 if(report.organizationId!==scope.organizationId||report.branchId!==scope.branchId||report.kind!==filters.kind||!Number.isFinite(Date.parse(report.asOf))||!Array.isArray(report.rows)||!Number.isSafeInteger(report.total)||report.total<0||report.filters?.query!==filters.query.trim()||report.filters?.status!==filters.status||report.filters?.from!==filters.from||report.filters?.to!==filters.to||report.rows.some(row=>!row||typeof row.id!=='string'||!row.id||typeof row.at!=='string'||!Number.isFinite(Date.parse(row.at))||Object.values(row).some(v=>v!==null&&typeof v!=='string'))||new Set(report.rows.map(r=>r.id)).size!==report.rows.length)throw Error('The record selection could not be verified. Refresh before exporting.');
 if(exporting&&(report.complete!==true||report.rows.length!==report.total||report.total>10000||report.next!==null))throw Error('The export is incomplete. No file was downloaded; narrow the selection and retry.');
 return report;
}
export function reportMoney(value:string|null|undefined){
 if(value==null||value==='')return '';
 if(!/^-?\d+$/.test(value))throw Error('An amount could not be verified. No file was exported.');
 const n=BigInt(value),v=n<0n?-n:n;return `${n<0n?'-':''}${v/100n}.${String(v%100n).padStart(2,'0')}`;
}
export function reportColumns(kind:RecordKind):HistoryColumn[]{
 const col=(label:string,key:string,numeric=false,money=false):HistoryColumn=>({label,numeric,value:r=>money?reportMoney(r[key] as string|null):r[key]});
 const base=[col('Record ID','id'),col('Date / time (Asia/Manila)','at'),col('Reference','reference'),col(kind==='stock'?'Product':'Name','party')];
 if(kind==='receipts')return [...base,col('Payment type','mode'),col('Original sale (PHP)','amount',true,true),col('Cash paid at sale (PHP)','cash',true,true),col('Cash tendered (PHP)','tender',true,true),col('Change (PHP)','change',true,true),col('Status','status')];
 if(kind==='credit_invoices'||kind==='supplier_invoices')return [...base,col('Due date','due'),col('Recorded invoice / opening amount (PHP)','amount',true,true),col('Net recorded payments (PHP)','paid',true,true),col('Credit notes (PHP)','credited',true,true),col('Outstanding (PHP)','balance',true,true),col('Status','status'),col('Source','source'),...(kind==='supplier_invoices'?[col('Opening as of','openingAsOf'),col('Source terms','sourceTerms')]:[])];
 if(kind==='credit_payments')return [...base,col('Invoice','invoice'),col('Type','type'),col('Document amount (PHP)','amount',true,true),col('Drawer cash effect (PHP)','cash',true,true),col('Note','description')];
 if(kind==='supplier_payments')return [...base,col('Invoice','invoice'),col('Type','type'),col('Document amount (PHP)','amount',true,true),col('Method','method'),col('Recorded at','recordedAt'),col('Note','description')];
 if(kind==='stock')return [...base,col('SKU','sku'),col('Movement','type'),col('Base quantity','quantity',true),col('Base unit','unit'),col('Lot','lot')];
 return [...base,col('Type','type'),col('Note','description')];
}
export function reportLocalTime(value:string){return new Date(Date.parse(value)+8*3600000).toISOString().replace('T',' ').replace('Z',' +08:00');}
export function recordReportCsv(report:RecordReport){
 if(!report.complete||report.rows.length!==report.total)throw Error('Only a complete selection can be exported.');
 const columns:HistoryColumn[]=[{label:'Branch ID',value:()=>report.branchId},{label:'Checked at (Asia/Manila)',value:()=>reportLocalTime(report.asOf)},{label:'Account scope',value:()=>report.entityId||'All matching accounts'},...reportColumns(report.kind).map(c=>c.label==='Date / time (Asia/Manila)'?{...c,value:(r:Record<string,unknown>)=>reportLocalTime(String(r.at))}:c)];
 return historyCsv(columns,report.rows);
}
