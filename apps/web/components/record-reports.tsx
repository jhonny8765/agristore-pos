"use client";
import {reportQualification} from '../lib/report-qualification';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Download,Search} from 'lucide-react';
import {command} from '../lib/api';
import {historyBounds} from '../lib/history';
import {defaultReport,recordKinds,recordReportCsv,reportColumns,validateRecordReport,type RecordKind,type RecordReport,type ReportFilters} from '../lib/record-reports';
import {Button} from './ui/button';

export function RecordReports({organizationId,branchId,branchName,online,initialKind='receipts',entity}:{organizationId:string;branchId:string;branchName:string;online:boolean;initialKind?:RecordKind;entity?:{id:string;name:string}}){
 const [filters,setFilters]=useState(()=>({...defaultReport(initialKind),...(entity?{entityId:entity.id}:{})})),[draft,setDraft]=useState<ReportFilters>(filters),[result,setResult]=useState<RecordReport>(),[offset,setOffset]=useState(0),[loading,setLoading]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const lifecycle=useRef({request:0,scope:0}).current,exportLock=useRef(false);
 useEffect(()=>()=>{lifecycle.request++;lifecycle.scope++;},[organizationId,branchId,lifecycle]);
 const load=useCallback(async(position:number)=>{
  if(!online)return;const token=++lifecycle.request;setLoading(true);setError('');
  try{const page=validateRecordReport(await command<RecordReport>('record_report',{openingBalancesSupported:true,organizationId,branchId,...filters,offset:position}),{organizationId,branchId},filters);if(token===lifecycle.request){setResult(page);setOffset(position);}}
  catch(e){if(token===lifecycle.request)setError(e instanceof Error?e.message:'Records could not load. Retry this selection.');}
  finally{if(token===lifecycle.request)setLoading(false);}
 },[organizationId,branchId,filters,online,lifecycle]);
 useEffect(()=>{setResult(undefined);setOffset(0);void load(0);return()=>{lifecycle.request++;};},[load,lifecycle]);
 const debt=filters.kind==='credit_invoices'||filters.kind==='supplier_invoices',dirty=JSON.stringify(filters)!==JSON.stringify(draft),blocked=!online||loading||exporting;
 const screenFields=debt?['Reference','Name','Due date','Outstanding (PHP)','Status']:filters.kind==='receipts'?['Date / time (Asia/Manila)','Reference','Name','Payment type','Original sale (PHP)','Status']:null;
 const columns=reportColumns(filters.kind).filter(c=>screenFields?screenFields.includes(c.label):c.label!=='Record ID'&&c.label!=='Source').map(c=>c.label==='Date / time (Asia/Manila)'?{...c,label:'Date / time',value:(row:Record<string,unknown>)=>new Date(String(row.at)).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}:c);
 function apply(next:ReportFilters){try{historyBounds(next);setError('');setMessage('');setFilters({...next,query:next.query.trim()});setDraft({...next,query:next.query.trim()});}catch(e){setError(e instanceof Error?e.message:'Check the dates.');}}
 async function exportRecords(){
  if(exportLock.current||blocked||dirty)return;exportLock.current=true;setExporting(true);setError('');setMessage('');const token=lifecycle.scope;
  try{
   const report=validateRecordReport(await command<RecordReport>('record_report',{openingBalancesSupported:true,organizationId,branchId,...filters,offset:0,export:true}),{organizationId,branchId},filters,true);
   if(token!==lifecycle.scope)return;

    const url=URL.createObjectURL(new Blob([recordReportCsv(report)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`better-yield-${filters.kind}-${filters.from||'beginning'}-${filters.to||'latest'}-${Date.now()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage(`CSV download started: all ${report.total} matching records. Check your Downloads folder.`);
  }catch(e){if(token===lifecycle.scope)setError(e instanceof Error?e.message:'The full export could not be verified. No partial file was downloaded.');}
  finally{exportLock.current=false;if(token===lifecycle.scope)setExporting(false);}
 }
 return <section className="panel record-report" aria-label="Full history and exports">
  <form className="report-filters" aria-label="Record filters" onSubmit={e=>{e.preventDefault();apply(draft);}}>
   <label className="field"><span>Records</span><select value={draft.kind} disabled={exporting} onChange={e=>apply(defaultReport(e.target.value as RecordKind))}>{Object.entries(recordKinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label className="field"><span>Search full history</span><input type="search" value={draft.query} maxLength={180} placeholder="Name or reference" onChange={e=>setDraft({...draft,query:e.target.value})}/></label>
   <label className="field"><span>Status</span><select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="all">All statuses</option>{debt?<><option value="outstanding">Outstanding / may utang</option><option value="paid">Paid / settled</option><option value="overdue">Overdue</option>{filters.kind==='credit_invoices'?<option value="unconfirmed">Due date unconfirmed</option>:<option value="voided">Voided</option>}</>:filters.kind==='receipts'?<><option value="completed">Completed</option><option value="partial">Partially refunded</option><option value="refunded">Refunded</option><option value="corrected">Refund corrected</option><option value="review">Needs review</option></>:null}</select></label>
   <label className="field"><span>From date</span><input type="date" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label>
   <label className="field"><span>Through date</span><input type="date" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label>
   <div className="report-tools"><Button disabled={blocked}><Search size={17}/>Show records</Button><Button type="button" variant="ghost" disabled={blocked} onClick={()=>apply({...draft,from:'',to:''})}>All dates</Button><Button type="button" variant="ghost" disabled={blocked} onClick={()=>{const dates=defaultReport('receipts');apply({...draft,from:dates.from,to:dates.to});}}>This month</Button></div>
  </form>
  <p className="scope-note">{branchName}{filters.entityId&&entity?` · Selected account: ${entity.name}`:''} · Asia/Manila{debt?' · Current balances; all dates includes earlier debts.':''}</p>
  {dirty&&<p role="status" className="notice">Apply your changed filters with Show records before exporting.</p>}{loading&&<p role="status">Checking matching records…</p>}{exporting&&<p role="status">Preparing the complete selection…</p>}{error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}{!online&&<p className="notice">Offline: the last loaded page may be out of date. Reconnect to search or export full history.</p>}
  <div className="report-tools"><Button variant="outline" disabled={blocked||dirty||!result?.total} onClick={()=>void exportRecords()}><Download size={17}/>Export matching records (CSV)</Button></div>
  {result&&<><p className="notice" role="status">{reportQualification(result)}</p><p className="scope-note">{result.total===0?'No matching records':`${offset+1}–${offset+result.rows.length} of ${result.total} matching records`} · Checked {new Date(result.asOf).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}. CSV includes all matching records and detailed columns.</p><div className="table-wrap" role="region" aria-label="Matching records" tabIndex={0}><table><thead><tr>{columns.map(c=><th key={c.label}>{c.label}</th>)}</tr></thead><tbody>{result.rows.map(row=><tr key={row.id}>{columns.map(c=><td key={c.label} className={c.numeric?'numeric':undefined}>{String(c.value(row)??'—')}</td>)}</tr>)}</tbody></table></div><nav className="report-tools" aria-label="Matching record pages"><Button variant="outline" disabled={blocked||dirty||offset===0} onClick={()=>void load(Math.max(0,offset-25))}>Previous page</Button><span>Page {Math.floor(offset/25)+1} of {Math.max(1,Math.ceil(result.total/25))}</span><Button variant="outline" disabled={blocked||dirty||result.next===null} onClick={()=>void load(result.next!)}>Next page</Button></nav></>}
  <details className="report-help"><summary>About exports and older records</summary><p>Older and settled records stay stored. Filters only change this view. Each export is a fresh snapshot of every matching record, up to 10,000 rows per file; choose a smaller date range or a more specific search for larger histories. A CSV does not replace your database backup. In Excel, import reference and ID columns as Text to preserve leading zeroes.</p><p>{filters.kind==='supplier_payments'?'Dates are the actual document / payment dates.':filters.kind==='receipts'?'Dates are when the sale occurred.':filters.kind.includes('invoices')?'Dates are original invoice / source dates; balances reflect the current time checked.':'Dates are when records were posted.'} Imported customer and supplier opening amounts are the balances unpaid at their source date, not reconstructed original invoice totals. Earlier payments are not included. Receipt amounts are original sales, with refunds identified separately by status. Customer payment cash effects include signed reversals and refunds. Supplier activity is outside the sales drawer. Unconfirmed due dates stay unknown.</p></details>
 </section>;
}
