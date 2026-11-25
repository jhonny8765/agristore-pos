"use client";
import {RecordRow} from "./record-row";
import {useTransientMessage} from "../lib/transient-message";
import {useEffect,useRef,useState} from 'react';
import {manilaDay} from '@agristore/domain';
import type {PosDatabase} from '@agristore/offline';
import {command} from '../lib/api';
import {onlineOperation} from '../lib/operations';
import {maxSupplierTerm,supplierAmountInput,supplierCents,supplierDueOn,supplierEntryLabels,supplierMethods,supplierMoney,supplierReminder,supplierPaymentStatus,supplierTermLabel,supplierAmountLabel,supplierTermOptions,type SupplierBill,type SupplierBook,type SupplierEntry,type SupplierHistory} from '../lib/supplier-accounts';
import {Button} from './ui/button';
import {ReadSnapshotCache} from '../lib/read-snapshot-cache';
import {StateBadge} from './state-badge';
import {useBusinessClock} from './workspace-ui';
import type {RecordKind} from '../lib/record-reports';

type Save=(action:string,data:Record<string,unknown>,message:string)=>Promise<boolean>;
const invoicesPerPage=10;
const invoicesPerFetch=50;
const invoiceOffset=(page:number)=>Math.floor((page*invoicesPerPage)/invoicesPerFetch)*invoicesPerFetch;

export function SupplierAccounts({db,organizationId,branchId,actorId,online,disabled,execute,onRecords,initialBillId=""}:{initialBillId?:string;onRecords?:(kind:RecordKind,entity?:{id:string;name:string})=>void;db:PosDatabase;organizationId:string;branchId:string;actorId:string;online:boolean;disabled:boolean;execute:(fn:()=>Promise<void>)=>Promise<Error|undefined>}){
 const [snapshot,setSnapshot]=useState<{scope:string;key:string;data:SupplierBook}>(),[history,setHistory]=useState<SupplierHistory>(),[selected,setSelected]=useState(initialBillId),[supplier,setSupplier]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState(initialBillId?'all':'outstanding'),[term,setTerm]=useState('all'),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[readFailed,setReadFailed]=useState(false),[feedback,setFeedback]=useTransientMessage(),[adding,setAdding]=useState(false),[replacement,setReplacement]=useState<SupplierBill>();
 const [customTerm,setCustomTerm]=useState(''),[page,setPage]=useState(0);
 const [detailError,setDetailError]=useState(''),[detailRetry,setDetailRetry]=useState(0);
 const cache=useRef(new ReadSnapshotCache<SupplierBook>());
 const detailHeading=useRef<HTMLHeadingElement>(null),registerHeading=useRef<HTMLHeadingElement>(null);
 const restoreRegisterFocus=useRef(false);
 const generation=useRef(0),detailGeneration=useRef(0),lock=useRef(false);const today=manilaDay(useBusinessClock()),ctx={organizationId,branchId};
 const customDays=Number(customTerm);
 const filterTerm=term==='custom'?(Number.isInteger(customDays)&&customDays>=1&&customDays<=maxSupplierTerm?String(customDays):'all'):term;
 const offset=invoiceOffset(page);
 const scopeKey=JSON.stringify([organizationId,branchId,actorId]),requestKey=JSON.stringify([scopeKey,supplier,query,status,filterTerm,today,offset]),cacheRevision=String(revision);
 const book=snapshot?.scope===scopeKey?snapshot.data:undefined,sources=book??{suppliers:[],receipts:[]},previousResults=!!book&&snapshot?.key!==requestKey;
 const blocked=disabled||saving||loading||readFailed||!online||previousResults;
 const pages=Math.max(1,Math.ceil((book?.matchingTotal??0)/invoicesPerPage));
 if(book&&!previousResults&&page>=pages)setPage(pages-1);
 const pageStart=page*invoicesPerPage;
 const pageRows=book&&!previousResults?book.invoices.slice(pageStart-offset,pageStart-offset+invoicesPerPage):[];
 const canGoTo=(target:number)=>!loading&&!previousResults&&target>=0&&target<pages&&(online||invoiceOffset(target)===offset);
 const currentHistory=history?.invoice.id===selected?history:undefined;
 useEffect(()=>{const token=++generation.current;let active=true;
  if(!online){cache.current.clear();setLoading(false);return;}
  const cached=cache.current.get(requestKey,cacheRevision);if(cached){setSnapshot({scope:scopeKey,key:requestKey,data:cached});setReadFailed(false);setError('');setLoading(false);return;}
  const previous=cache.current.peek(requestKey,cacheRevision);if(previous)setSnapshot({scope:scopeKey,key:requestKey,data:previous});
  setLoading(true);setReadFailed(false);setError('');
  const timer=setTimeout(()=>void command<SupplierBook>('supplier_account_book',{openingBalancesSupported:true,organizationId,branchId,supplierId:supplier||null,query,status,term:filterTerm,offset}).then(data=>{if(active&&token===generation.current){setSnapshot({scope:scopeKey,key:requestKey,data});cache.current.set(requestKey,data,cacheRevision);}}).catch(e=>{if(active&&token===generation.current){setReadFailed(true);setError(e.message);}}).finally(()=>{if(active&&token===generation.current)setLoading(false);}),query?200:0);
  return()=>{active=false;clearTimeout(timer);};
 },[organizationId,branchId,supplier,query,status,filterTerm,offset,online,requestKey,scopeKey,cacheRevision]);
 useEffect(()=>{
  const token=++detailGeneration.current;let active=true;
  setHistory(undefined);setDetailError('');
  if(selected&&online)void command<SupplierHistory>('supplier_invoice_history',{openingBalancesSupported:true,organizationId,branchId,billId:selected})
   .then(data=>{if(active&&token===detailGeneration.current)setHistory(data);})
   .catch(e=>{if(active&&token===detailGeneration.current)setDetailError(e instanceof Error?e.message:'Could not load this invoice.');});
  return()=>{active=false;};
 },[organizationId,branchId,selected,online,revision,detailRetry]);
 useEffect(()=>{
  if(selected){detailHeading.current?.focus();return;}
  if(restoreRegisterFocus.current){registerHeading.current?.focus();restoreRegisterFocus.current=false;}
 },[selected]);
 const save:Save=async(action,data,message)=>{if(lock.current)return false;lock.current=true;cache.current.clear();setSaving(true);setError('');try{const failure=await execute(async()=>{await onlineOperation(db,actorId,action,{...ctx,...data},'requestId');});if(failure){setError(failure.message);return false;}setFeedback(message);setRevision(n=>n+1);return true;}catch(e){setError(e instanceof Error?e.message:'Could not confirm the original request. Check Sync center.');return false;}finally{lock.current=false;setSaving(false);}};
 async function moreHistory(){if(!history||history.next==null)return;const token=detailGeneration.current;try{const next=await command<SupplierHistory>('supplier_invoice_history',{openingBalancesSupported:true,...ctx,billId:selected,offset:history.next});if(token===detailGeneration.current&&next.invoice.version!==history.invoice.version){setRevision(n=>n+1);return;}if(token===detailGeneration.current)setHistory(current=>current?{...next,receipts:current.receipts,receiptNext:current.receiptNext,receiptTotal:current.receiptTotal,entries:[...current.entries,...next.entries.filter(e=>!current.entries.some(p=>p.id===e.id))]}:current);}catch(e){if(token===detailGeneration.current)setError(e instanceof Error?e.message:'Could not load earlier payments.');}}
 async function moreReceipts(){if(!history||history.receiptNext==null)return;const token=detailGeneration.current;try{const next=await command<{rows:NonNullable<SupplierHistory['receipts']>;next:number|null;total:number}>('supplier_bill_receipts',{openingBalancesSupported:true,...ctx,billId:selected,offset:history.receiptNext});if(token===detailGeneration.current)setHistory(current=>current?{...current,receipts:[...current.receipts??[],...next.rows.filter(r=>!current.receipts?.some(p=>p.linkId===r.linkId))],receiptNext:next.next,receiptTotal:next.total}:current);}catch(e){if(token===detailGeneration.current)setError(e instanceof Error?e.message:'Could not load linked deliveries.');}}

 const invoiceForm=adding&&<InvoiceForm key={replacement?.id??'new'} book={sources} replacement={replacement} today={today} disabled={blocked} onCancel={()=>{setAdding(false);setReplacement(undefined);}} onSave={async fields=>{
  const ok=await save('supplier_record_invoice',fields,'Supplier invoice recorded.');
  if(ok){setAdding(false);setReplacement(undefined);}
  return ok;
 }}/>;
 const notice=<>{error&&<p className="notice error" role="alert">{error}</p>}{feedback&&<p className="notice success" role="status">{feedback}</p>}</>;
 if(selected)return <section className="supplier-accounts" aria-label="Supplier invoice view">
  <div className="section-heading supplier-detail-heading">
   <h2 tabIndex={-1} ref={detailHeading}>Supplier invoice</h2>
   <Button variant="outline" onClick={()=>{
    restoreRegisterFocus.current=true;
    setSelected('');setHistory(undefined);setAdding(false);setReplacement(undefined);setError('');
   }}>Back to supplier bills</Button>
  </div>
  {notice}
  {currentHistory&&invoiceForm}
  {!online&&<p role="status">Reconnect to view this supplier invoice.</p>}
  {online&&detailError&&<div className="supplier-detail-error"><p className="notice error" role="alert">{detailError}</p><Button variant="outline" onClick={()=>{detailHeading.current?.focus();setDetailRetry(value=>value+1);}}>Retry invoice</Button></div>}
  {!currentHistory&&online&&!detailError&&<p role="status">Loading supplier invoice…</p>}
  {currentHistory&&<BillDetail key={`${currentHistory.invoice.id}:${currentHistory.invoice.version}`} history={currentHistory} today={today} blocked={blocked||!book} onSave={save} onMoreReceipts={()=>void moreReceipts()} onMore={()=>void moreHistory()} onReplace={()=>{setReplacement(currentHistory.invoice);setAdding(true);}}/>}
 </section>;

 const pagination=(position:'above'|'below')=>book&&<nav className="record-pagination" aria-label={`Supplier invoice pages ${position}`}>
  <span role="status">{previousResults?'Loading invoices…':book.matchingTotal?`${pageStart+1}–${pageStart+pageRows.length} of ${book.matchingTotal}`:'0 invoices'}</span>
  {pages>1&&<div className="record-page-buttons">
   <Button type="button" size="sm" variant="outline" disabled={!canGoTo(page-1)} onClick={()=>setPage(page-1)}>Previous</Button>
   <span>Page {page+1} of {pages}</span>
   <Button type="button" size="sm" variant="outline" disabled={!canGoTo(page+1)} onClick={()=>setPage(page+1)}>Next</Button>
   {pages>2&&<><Button type="button" size="sm" variant="ghost" disabled={page===0||!canGoTo(0)} onClick={()=>setPage(0)}>First</Button><Button type="button" size="sm" variant="ghost" disabled={page===pages-1||!canGoTo(pages-1)} onClick={()=>setPage(pages-1)}>Last</Button></>}
  </div>}
 </nav>;
 return <section className="supplier-accounts" aria-label="Supplier accounts payable">
  {notice}
  {!online&&<p className="notice" role="status">Reconnect to refresh supplier bills.</p>}
  {book&&<dl className="supplier-totals"><div><dt>Store owes</dt><dd>{supplierMoney(book.outstanding)}</dd></div><div><dt>Overdue</dt><dd>{supplierMoney(book.overdue)}</dd></div><div><dt>Due within 7 days</dt><dd>{supplierMoney(book.dueSoon)}</dd></div><div><dt>Paid / settled bills</dt><dd>{book.paidCount}</dd></div></dl>}
  {book&&BigInt(book.unconfirmedDue??'0')>0n&&<p className="scope-note">{supplierMoney(book.unconfirmedDue!)} has no confirmed due date.</p>}
  {invoiceForm}
  <div className="panel supplier-register">
   <div className="section-heading">
    <h2 ref={registerHeading} tabIndex={-1}>Purchase and payment history</h2>
    <div className="button-row">
     <Button size="sm" variant="outline" disabled={disabled||saving||loading||!online} onClick={()=>setRevision(n=>n+1)}>Refresh bills</Button>
     {onRecords&&<Button size="sm" variant="outline" onClick={()=>onRecords("supplier_invoices",supplier?{id:supplier,name:sources.suppliers.find(s=>s.id===supplier)?.name??"Selected supplier"}:undefined)}>Search &amp; export</Button>}
     <Button size="sm" disabled={blocked||!book} onClick={()=>{setReplacement(undefined);setAdding(true);}}>Add supplier invoice</Button>
    </div>
   </div>
   <div className="supplier-filters">
    <label className="field"><span>Supplier</span><select value={supplier} onChange={e=>{setSupplier(e.target.value);setPage(0);}}><option value="">All suppliers</option>{sources.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label className="field"><span>Search supplier invoices</span><input type="search" maxLength={180} placeholder="Invoice, supplier or stock details" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
    <label className="field"><span>Payment status</span><select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="outstanding">All outstanding / may utang</option><option value="all">All statuses</option><option value="unpaid">Unpaid / May utang</option><option value="partial">Partly paid</option><option value="paid">Paid / settled</option><option value="overdue">Overdue</option><option value="dueSoon">Due within 7 days</option><option value="voided">Voided</option></select></label>
    <div>
     <label className="field"><span>Supplier payment term</span><select value={term} onChange={e=>{setTerm(e.target.value);setPage(0);}}><option value="all">All terms</option><option value="0">Due now</option>{supplierTermOptions.map(n=><option key={n} value={n}>{n} days</option>)}<option value="custom">Other</option></select></label>
     {term==='custom'&&<label className="field"><span>Filter terms by days</span><input type="number" min={1} max={maxSupplierTerm} step={1} value={customTerm} onChange={e=>{setCustomTerm(e.target.value);setPage(0);}}/></label>}
    </div>
   </div>
   {loading&&!book&&<p role="status">Loading supplier bills…</p>}
   {previousResults&&!loading&&readFailed&&<p className="notice">Select Refresh bills to retry.</p>}
   {book&&<>
    {pagination('above')}
    <div className="table-wrap" role="region" aria-label="Supplier invoice register" aria-busy={loading||previousResults} tabIndex={0}>
     <table><thead><tr><th>Invoice / supplier</th><th>Due / term</th><th>Recorded amount</th><th>Recorded payments</th><th>Still owed</th><th>Status</th></tr></thead>
      <tbody>{pageRows.map(b=><RecordRow key={b.id} onOpen={()=>{if(!blocked)setSelected(b.id);}}>
       <td><button type="button" className="record-link" disabled={blocked} onClick={()=>setSelected(b.id)}>{b.reference}</button><small>{b.supplierName}</small></td>
       <td>{b.dueOn??'Due date not supplied'}<small>{supplierTermLabel(b)}</small><small>{supplierReminder(b,today)}</small></td>
       <td>{supplierMoney(b.amount)}<small>{supplierAmountLabel(b)}{b.source==='opening'?` as of ${b.openingAsOf}`:''}</small></td>
       <td>{supplierMoney(b.paid)}{b.source==='opening'&&<small>Since opening balance</small>}</td>
       <td><strong>{supplierMoney(b.balance)}</strong></td>
       <td><StateBadge kind={b.voided?'closed':b.balance===0?'confirmed':b.dueOn&&b.dueOn<today?'warning':'pending'}>{supplierPaymentStatus(b)}</StateBadge></td>
      </RecordRow>)}</tbody>
     </table>
    </div>
    {!previousResults&&!pageRows.length&&<p>No supplier bills match these filters.</p>}
    {pages>1&&pagination('below')}
   </>}
  </div>
 </section>;
}

function InvoiceForm({book,replacement,today,disabled,onCancel,onSave}:{book:Pick<SupplierBook,'suppliers'|'receipts'>;replacement?:SupplierBill;today:string;disabled:boolean;onCancel:()=>void;onSave:(data:Record<string,unknown>)=>Promise<boolean>}){
 const initialTerm=replacement?.source!=='opening'&&replacement?.term!=null?replacement.term:30;
 const initialPreset=initialTerm===0||supplierTermOptions.some(days=>days===initialTerm);
 const [supplier,setSupplier]=useState(replacement?.supplierId??''),[issued,setIssued]=useState(replacement?.issuedOn??today);
 const [termChoice,setTermChoice]=useState(initialPreset?String(initialTerm):'custom'),[customTerm,setCustomTerm]=useState(initialPreset?'':String(initialTerm)),[error,setError]=useState('');
 const term=Number(termChoice==='custom'?(customTerm||NaN):termChoice);
 const supplierArchived=!!book.suppliers.find(s=>s.id===supplier)?.archivedAt;
 const archivedReplacement=supplierArchived&&replacement?.supplierId===supplier;
 const supplierChoices=book.suppliers.filter(s=>!s.archivedAt||s.id===replacement?.supplierId||book.receipts.some(receipt=>receipt.supplierId===s.id));
 let due='';try{due=supplierDueOn(issued,term);}catch{}
 return <form className="panel supplier-invoice-form" aria-label="Record supplier invoice" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const amount=supplierCents(String(f.get('amount')));if(!due)throw Error('Check the invoice date and agreed term.');setError('');void onSave({supplierId:supplier,reference:String(f.get('reference')).trim(),issuedOn:issued,term,expectedDueOn:due,amount,receiptId:String(f.get('receiptId'))||null,replacesId:replacement?.id??null,reason:String(f.get('reason')).trim(),confirmed:f.get('confirmed')==='on'});}catch(e){setError(e instanceof Error?e.message:'Check this supplier invoice.');}}}>
  <fieldset disabled={disabled}><legend>{replacement?'Replace voided supplier invoice':'New supplier invoice'}</legend>{error&&<p role="alert">{error}</p>}{replacement&&<p>Replaces {replacement.reference}. The original invoice and its history remain available.</p>}
   <div className="supplier-form-grid"><label className="field"><span>Invoice supplier</span><select required value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Select supplier</option>{supplierChoices.map(s=><option key={s.id} value={s.id}>{s.name}{s.archivedAt?' (archived)':''}</option>)}</select></label><label className="field"><span>Supplier invoice number</span><input name="reference" required minLength={1} maxLength={150} defaultValue={replacement?.reference}/></label>
   <label className="field"><span>Supplier invoice date</span><input type="date" required max={today} value={issued} onChange={e=>setIssued(e.target.value)}/></label><label className="field"><span>Agreed payment term</span><select value={termChoice} onChange={e=>setTermChoice(e.target.value)}><option value="0">Due now</option>{supplierTermOptions.map(n=><option key={n} value={n}>{n} days</option>)}<option value="custom">Other</option></select></label>
   {termChoice==='custom'&&<label className="field"><span>Payment term in days</span><input type="number" required min={1} max={maxSupplierTerm} step={1} value={customTerm} onChange={e=>setCustomTerm(e.target.value)}/></label>}
   <label className="field"><span>Supplier invoice amount (₱)</span><input name="amount" inputMode="decimal" required defaultValue={replacement?supplierAmountInput(replacement.amount):''}/></label><label className="field"><span>{supplierArchived&&!archivedReplacement?'Receiving reference':'Recent receiving reference (optional)'}</span><select name="receiptId" key={supplier} defaultValue="" required={supplierArchived&&!archivedReplacement}><option value="">{supplierArchived&&!archivedReplacement?'Select an existing delivery':'Keep separate from stock receiving'}</option>{book.receipts.filter(r=>r.supplierId===supplier).map(r=><option key={r.id} value={r.id}>{r.reference}</option>)}</select></label></div>
   <p className="supplier-due">Payment due: <strong>{due||'Choose a valid date'}</strong> · One final due date, not instalments.</p><label className="field"><span>Stock purchased / invoice note</span><textarea name="reason" required minLength={3} maxLength={2000} defaultValue={replacement?.description} placeholder="For example, 20 sacks of feeds. Match the supplier invoice."/></label>
   <label className="checkbox"><input name="confirmed" type="checkbox" required/>I checked the supplier invoice amount and agreed payment term.</label><div className="button-row"><Button>Save supplier invoice</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel invoice entry</Button></div>
  </fieldset>
 </form>;
}

function BillDetail({history,today,blocked,onSave,onMore,onReplace,onMoreReceipts}:{history:SupplierHistory;today:string;blocked:boolean;onSave:Save;onMoreReceipts:()=>void;onMore:()=>void;onReplace:()=>void}){
 const b=history.invoice;
 return <section className="panel supplier-bill-detail" aria-label="Selected supplier invoice"><div className="section-heading"><div><h3>{b.reference}</h3><p>{b.supplierName}</p></div><StateBadge kind={b.voided?'closed':b.balance===0?'confirmed':b.dueOn&&b.dueOn<today?'warning':'pending'}>{supplierPaymentStatus(b)}</StateBadge></div>
  <p>Invoice date: {b.issuedOn} · {supplierTermLabel(b)}<br/>Payment due: <strong>{b.dueOn??'Not supplied'}</strong> {supplierReminder(b,today)}</p><p className="supplier-description">{b.description}</p>
  {b.source==='opening'&&<p className="notice">Opening unpaid balance as of {b.openingAsOf}. Original invoice gross and earlier payments were not supplied. Payments and credits below apply to this opening balance.{b.sourceDetails?.locationScope?` Source scope: ${b.sourceDetails.locationScope}.`:''}</p>}
  <dl className="detail-list"><div><dt>{supplierAmountLabel(b)}</dt><dd>{supplierMoney(b.amount)}</dd></div><div><dt>{b.source==='opening'?'Net payments since opening':'Net payments made'}</dt><dd>{supplierMoney(b.paid)}</dd></div><div><dt>{b.source==='opening'?'Credits since opening':'Supplier credit notes'}</dt><dd>{supplierMoney(b.credited)}</dd></div><div><dt>Store owes</dt><dd>{supplierMoney(b.balance)}</dd></div></dl>
  {history.receipts?<><h4>Linked deliveries ({history.receiptTotal??history.receipts.length})</h4><ul>{history.receipts.map(r=><li key={r.linkId}>{r.reference} · {new Date(r.recordedAt).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}{r.reversed&&<strong> · Stock inspection reversed; supplier bill and payments retained</strong>}</li>)}</ul>{history.receiptNext!=null&&<Button variant="outline" disabled={blocked} onClick={onMoreReceipts}>Load earlier linked deliveries</Button>}</>:history.receipt&&<p>Linked receiving record: {history.receipt.reference}<small className="supplier-original-id">{history.receipt.id}</small></p>}{b.replacesId&&<p>Replacement of original invoice <span className="supplier-original-id">{b.replacesId}</span></p>}
  <details className="supplier-metadata"><summary>Original invoice ID</summary><span className="supplier-original-id">{b.id}</span><p>Recorded {new Date(b.recordedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</p>{b.source==='opening'&&b.sourceDetails&&<p>Source: {b.sourceDetails.file}, page {b.sourceDetails.page}, row {b.sourceDetails.row}. Opening as of {b.openingAsOf}.</p>}</details>
  {!b.voided&&b.balance>0&&<details className="account-action"><summary>Record supplier payment / credit</summary><SettlementForm bill={b} today={today} blocked={blocked} onSave={onSave}/></details>}
  <h3>Invoice &amp; payment history</h3><p>Payment date is when money was actually paid. Recorded date shows when the owner saved the entry.</p>
  <ol className="supplier-timeline">{history.entries.map(e=><li key={e.id}><div className="supplier-event-title"><strong>{b.source==='opening'&&e.kind==='invoice'?'Opening balance recorded':supplierEntryLabels[e.kind]}</strong><strong>{supplierMoney(e.amount)}</strong></div><p>{e.reference}{e.method?` · ${supplierMethods[e.method]}`:''}</p><p>{e.reason}</p><small>{e.kind==='invoice'?b.source==='opening'?'Opening as of':'Invoice date':'Document / payment date'}: {e.paidOn} · Recorded {new Date(e.at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} · {e.actorName??'Owner'}</small>{e.reversedBy&&<p className="supplier-reversed">Reversed · retained in history</p>}{e.reverses&&<p className="supplier-original-id">Reverses entry {e.reverses}</p>}<details><summary>Permanent entry reference</summary><span className="supplier-original-id">{e.id}</span></details>{!b.voided&&!e.reversedBy&&(e.kind==='payment'||e.kind==='credit_note')&&<Correction bill={b} entry={e} today={today} blocked={blocked} onSave={onSave}/>}</li>)}</ol>
  {history.next!=null&&<Button variant="outline" disabled={blocked} onClick={onMore}>Load earlier supplier history</Button>}{!b.voided&&b.paid===0&&b.credited===0&&<Correction bill={b} today={today} blocked={blocked} onSave={onSave}/>}{b.voided&&b.source!=='opening'&&<Button variant="outline" disabled={blocked} onClick={onReplace}>Replace voided invoice</Button>}
 </section>;
}

function SettlementForm({bill,today,blocked,onSave}:{bill:SupplierBill;today:string;blocked:boolean;onSave:Save}){
 const [kind,setKind]=useState('payment'),[error,setError]=useState('');
 return <form className="supplier-payment-form" aria-label="Record supplier payment" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);try{const amount=supplierCents(String(f.get('amount')));if(amount>bill.balance)throw Error('Payment cannot exceed the remaining supplier balance.');setError('');void onSave(kind==='payment'?'supplier_record_payment':'supplier_credit_note',{billId:bill.id,expectedVersion:bill.version,expectedBalance:bill.balance,amount,method:kind==='payment'?String(f.get('method')):null,paidOn:String(f.get('paidOn')),reference:String(f.get('reference')).trim(),reason:String(f.get('reason')).trim(),confirmed:f.get('confirmed')==='on'},kind==='payment'?'Supplier payment recorded once.':'Supplier credit note recorded.').then(saved=>{if(saved)form.reset();});}catch(e){setError(e instanceof Error?e.message:'Check the payment amount.');}}}>
  <fieldset disabled={blocked}><legend>Record payment already made</legend>{error&&<p role="alert">{error}</p>}<label className="field"><span>Supplier entry type</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="payment">Payment already made</option><option value="credit_note">Supplier credit note received</option></select></label>
   <div className="supplier-form-grid"><label className="field"><span>{kind==='payment'?'Supplier payment amount (₱)':'Supplier credit amount (₱)'}</span><input name="amount" inputMode="decimal" required/></label><label className="field"><span>{kind==='payment'?'Actual payment date':'Supplier credit note date'}</span><input name="paidOn" type="date" max={today} required defaultValue={today}/></label>{kind==='payment'&&<label className="field"><span>Payment method / source</span><select name="method" required defaultValue=""><option value="" disabled>Select payment method</option>{Object.entries(supplierMethods).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}<label className="field"><span>Payment / credit reference</span><input name="reference" required minLength={1} maxLength={200}/></label></div>
   <label className="field"><span>Supplier payment note</span><textarea name="reason" required minLength={3} maxLength={2000}/></label><label className="checkbox"><input name="confirmed" type="checkbox" required/>{kind==='payment'?'I verified this payment was made or cleared outside the sales drawer.':'I verified the supplier issued this credit note against this invoice.'}</label><Button>{kind==='payment'?'Save supplier payment':'Save supplier credit note'}</Button>
  </fieldset>
 </form>;
}

function Correction({bill,entry,today,blocked,onSave}:{bill:SupplierBill;entry?:SupplierEntry;today:string;blocked:boolean;onSave:Save}){
 return <details className="supplier-correction"><summary>{entry?'Reverse this mistaken entry':'Void mistaken invoice'}</summary><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void onSave(entry?'supplier_reverse_entry':'supplier_void_invoice',{billId:bill.id,entryId:entry?.id??null,expectedVersion:bill.version,expectedBalance:bill.balance,paidOn:String(f.get('paidOn')),reference:String(f.get('reference')).trim(),reason:String(f.get('reason')).trim(),confirmed:f.get('confirmed')==='on'},entry?'Original entry reversed once. Both records remain in history.':'Invoice voided. Its original evidence remains in history.');}}><fieldset disabled={blocked}><legend>{entry?'Documented payment / credit correction':'Documented invoice cancellation'}</legend><p>{entry?'Reverse only a mistaken recorded entry. This does not request a bank refund or move drawer cash.':'Void only an incorrect invoice. Actual supplier debt must remain recorded; voiding does not return stock.'}</p><label className="field"><span>Correction date</span><input name="paidOn" type="date" required max={today} defaultValue={today}/></label><label className="field"><span>Correction reference</span><input name="reference" required minLength={1} maxLength={200}/></label><label className="field"><span>Correction reason</span><textarea name="reason" required minLength={3} maxLength={2000}/></label><label className="checkbox"><input name="confirmed" type="checkbox" required/>I checked the original evidence and this correction.</label><Button variant="outline">{entry?'Confirm entry reversal':'Confirm invoice void'}</Button></fieldset></form></details>;
}
