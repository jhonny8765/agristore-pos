"use client";

import {reportQualification} from '../lib/report-qualification';
import {useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';

import type {Lease} from '@agristore/domain';

import type {PosDatabase} from '@agristore/offline';

import {refreshDrawerBaseline} from '../lib/local-drawer-cash';
import {LocalDrawerCash} from './local-drawer-cash';
import {command,expenseDrawerChoices,type ExpenseDrawerCursor,type ExpenseDrawerChoice} from '../lib/api';

import {onlineOperation,retryOperation,type PendingOperation} from '../lib/operations';

import {drawerExpenseActions,drawerExpenseCategories,readDrawerExpenseRecords,drawerExpenseRecordsCsv,validateDrawerExpenseOwnerInput,type DrawerExpenseRecord,type DrawerExpenseRecords,type DrawerExpenseRecordsFilters,type DrawerExpenseSummary} from '../lib/drawer-expenses';

import {drawerExpenseUnavailable,drawerExpenseConfirmation,expenseMoney,expensePesos} from '../lib/drawer-expense-ui';

import {Button} from './ui/button';



interface Props {db:PosDatabase;organizationId:string;branchId:string;branchName:string;actorId:string;actorName:string;role:string;online:boolean;practice:boolean;lease?:Lease;pending:PendingOperation[];unresolvedSales:boolean;disabled:boolean;revision:number;execute:(fn:()=>Promise<void>)=>Promise<unknown>;onSync:()=>void}

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

const stamp=(value:string)=>new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila'});

const text=(form:FormData,key:string)=>String(form.get(key)??'').trim();

function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}

function Metadata({defaults}:{defaults?:DrawerExpenseRecord['metadata']}){return <><Field label="Category"><select name="category" defaultValue={defaults?.category??'transport'}>{drawerExpenseCategories.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></Field><Field label="Purpose"><input name="purpose" required minLength={3} maxLength={500} defaultValue={defaults?.purpose}/></Field><Field label="Payee"><input name="payee" required maxLength={200} defaultValue={defaults?.payee} placeholder="Person/business or Not applicable"/></Field><Field label="Receipt / reference (optional)"><input name="reference" maxLength={200} defaultValue={defaults?.reference}/></Field></>;}

function Amount({label="Amount paid (₱)"}:{label?:string}){return <Field label={label}><input name="amount" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00"/></Field>;}

function Closing({record}:{record:DrawerExpenseRecord}){const c=record.closingRestatement;if(!c)return null;return <dl className="compact-ledger"><div><dt>Original expected cash</dt><dd>{c.originalExpectedCash===null?'Unknown':expenseMoney(c.originalExpectedCash)}</dd></div><div><dt>Original counted cash</dt><dd>{c.countedCash===null?'Unknown':expenseMoney(c.countedCash)}</dd></div><div><dt>Original difference</dt><dd>{c.originalDifference===null?'Unknown':expenseMoney(c.originalDifference)}</dd></div><div><dt>Restated expected cash (separate)</dt><dd>{expenseMoney(c.restatedExpectedCash)}</dd></div><div><dt>Restated difference (separate)</dt><dd>{c.restatedDifference===null?'Unknown':expenseMoney(c.restatedDifference)}</dd></div></dl>;}



export function DrawerExpenses(p:Props){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15_000);return()=>clearInterval(timer);},[]);

 const owner=p.role==='owner',ownShift=!!p.lease&&p.lease.cashierId===p.actorId&&p.lease.organizationId===p.organizationId&&p.lease.branchId===p.branchId&&p.lease.role===p.role&&p.lease.expiresAt>now;

 const originals=p.pending.filter(o=>drawerExpenseActions.has(o.action));

 const unavailable=drawerExpenseUnavailable({practice:p.practice,online:p.online,role:p.role,ownShift,pending:p.unresolvedSales||p.pending.length>0});

 const [continuationBlocked,setContinuationBlocked]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[summary,setSummary]=useState<DrawerExpenseSummary>(),[report,setReport]=useState<DrawerExpenseRecords>(),[selected,setSelected]=useState<DrawerExpenseRecord>(),[evidence,setEvidence]=useState<PendingOperation>(),[amountPreview,setAmountPreview]=useState(''),[confirmed,setConfirmed]=useState(false);

 const initial={fromDate:today(),throughDate:today(),view:'restated' as const};

 const [filters,setFilters]=useState<Pick<DrawerExpenseRecordsFilters,'fromDate'|'throughDate'|'view'>>(initial),[draft,setDraft]=useState(filters);

 const [paid,setPaid]=useState(true),[drawers,setDrawers]=useState<ExpenseDrawerChoice[]>([]),[paperShift,setPaperShift]=useState(''),[drawerCursor,setDrawerCursor]=useState<ExpenseDrawerCursor|null>(null),[drawerBusy,setDrawerBusy]=useState(false);

 const recordForm=useRef<HTMLFormElement>(null);
 const lock=useRef(false),generation=useRef(0),readId=useRef(0),drawerRead=useRef(0);

 useEffect(()=>()=>{generation.current++;readId.current++;drawerRead.current++;},[]);

 const load=useCallback(async(cursor?:DrawerExpenseRecords['nextCursor'])=>{

  if(p.practice||!p.online||!['owner','cashier'].includes(p.role))return;

  const id=++readId.current,scope=generation.current;setBusy(true);setError('');

  try{const f={organizationId:p.organizationId,branchId:p.branchId,...filters,limit:25,...(cursor?{cursor}:{})};

   const r=readDrawerExpenseRecords(await command('drawer_expense_records',f),f,p.actorId);


   let s:DrawerExpenseSummary|undefined;

   if(ownShift&&p.lease)s=(await refreshDrawerBaseline(p.db,p.lease)).summary;

   if(id===readId.current&&scope===generation.current){setReport(old=>cursor&&old?{...old,records:[...old.records,...r.records],nextCursor:r.nextCursor}:r);setSummary(s);setContinuationBlocked(false);if(!cursor)setSelected(old=>r.records.find(row=>row.id===old?.id));}

  }catch(e){if(id===readId.current&&scope===generation.current){setError(e instanceof Error?e.message:'Could not refresh. Keep the original evidence.');if(cursor)setContinuationBlocked(true);}}

  finally{if(id===readId.current&&scope===generation.current)setBusy(false);}

 },[p.db,p.practice,p.online,p.role,p.organizationId,p.branchId,p.actorId,p.lease,ownShift,filters,setBusy,setError,setReport,setSummary,setSelected,setContinuationBlocked]);

 useEffect(()=>{const reads=readId;void load();return()=>{reads.current++;};},[load,p.revision]);

 const loadDrawers=useCallback(async(cursor?:ExpenseDrawerCursor)=>{
  if(!owner||p.practice||!p.online)return;
  const token=++drawerRead.current,scope=generation.current;setDrawerBusy(true);setError('');
  try{const page=await expenseDrawerChoices(p.organizationId,p.branchId,cursor);if(token===drawerRead.current&&scope===generation.current){setDrawers(page.items);setDrawerCursor(page.nextCursor);setPaperShift('');}}
  catch(e){if(token===drawerRead.current&&scope===generation.current)setError(e instanceof Error?e.message:'Could not load original drawers. Reconnect and retry.');}
  finally{if(token===drawerRead.current&&scope===generation.current)setDrawerBusy(false);}
 },[owner,p.practice,p.online,p.organizationId,p.branchId,setDrawerBusy,setError,setDrawers,setDrawerCursor,setPaperShift]);
 useEffect(()=>{const reads=drawerRead;void loadDrawers();return()=>{reads.current++;};},[loadDrawers]);

 const blocked=p.disabled||busy||lock.current,dirty=JSON.stringify(filters)!==JSON.stringify(draft);

 async function perform(action:string,data:Record<string,unknown>,after?:()=>void){

  if(lock.current||p.disabled||!p.online||p.practice)return;lock.current=true;setBusy(true);setError('');const scope=generation.current;

  try{let acknowledged=false;const problem=await p.execute(async()=>{

   const result=await onlineOperation(p.db,p.actorId,action,{organizationId:p.organizationId,branchId:p.branchId,...data},'requestId');

   acknowledged=true;if(scope===generation.current){setSuccess(drawerExpenseConfirmation(result));after?.();}

  });if(!acknowledged)throw problem instanceof Error?problem:Error('No verified confirmation received. Keep the saved original in Sync center; do not pay again.');

  }catch(e){if(scope===generation.current)setError(e instanceof Error?e.message:'Keep the original evidence in Sync center.');}

  finally{lock.current=false;if(scope===generation.current){setBusy(false);void load();}}

 }

 async function retry(op:PendingOperation){if(lock.current||p.disabled||!p.online||p.practice||op.actorId!==p.actorId)return;lock.current=true;setBusy(true);const scope=generation.current;try{let ack=false;const issue=await p.execute(async()=>{const r=await retryOperation(p.db,p.actorId,op);ack=true;if(scope===generation.current){setSuccess(drawerExpenseConfirmation(r));recordForm.current?.reset();setAmountPreview('');setConfirmed(false);}});if(!ack)throw issue instanceof Error?issue:Error('Original remains unverified. Do not pay again.');}catch(e){if(scope===generation.current)setError(e instanceof Error?e.message:'Keep original.');}finally{lock.current=false;if(scope===generation.current){setBusy(false);void load();}}}

 async function exportAll(){if(lock.current||blocked||!p.online||dirty||p.practice)return;lock.current=true;setBusy(true);setError('');const scope=generation.current;try{const f={organizationId:p.organizationId,branchId:p.branchId,...filters,export:true};const r=readDrawerExpenseRecords(await command('drawer_expense_records',f),f,p.actorId);if(scope!==generation.current)return;const url=URL.createObjectURL(new Blob([drawerExpenseRecordsCsv(r)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`drawer-expenses-${r.view}-${r.fromDate}-${r.throughDate}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setReport(r);setSuccess(`Complete CSV downloaded: ${r.records.length} records, checked ${stamp(r.asOf)}.`);}catch(e){if(scope===generation.current)setError(e instanceof Error?e.message:'Export failed. Narrow the date range and retry.');}finally{lock.current=false;if(scope===generation.current)setBusy(false);}}

 function record(event:FormEvent<HTMLFormElement>){event.preventDefault();if(unavailable||blocked||!p.lease)return;const form=event.currentTarget,f=new FormData(form);try{const amount=expensePesos(text(f,'amount'));if(!confirmed)throw Error('Confirm the exact cash already paid from this drawer.');void perform('record_drawer_expense',{deviceId:p.lease.deviceId,shiftId:p.lease.shiftId,amount,category:text(f,'category'),purpose:text(f,'purpose'),payee:text(f,'payee'),reference:text(f,'reference'),confirmedPaid:true},()=>{form.reset();setAmountPreview('');setConfirmed(false);});}catch(e){setError((e as Error).message);}}

 function ownerForm(event:FormEvent<HTMLFormElement>,action:string){event.preventDefault();if(!owner||p.practice||blocked)return;const f=new FormData(event.currentTarget);try{let data:Record<string,unknown>={organizationId:p.organizationId,branchId:p.branchId,requestId:crypto.randomUUID(),reason:text(f,'reason')};

  if(action==='reconcile_drawer_expense'){

   const actualPaid=text(f,'actualPaid')==='yes';let occurredAt='';if(actualPaid){const local=text(f,'occurredAt');if(!local)throw Error('Enter actual payment date and time in Manila.');occurredAt=`${local}:00+08:00`;}

   data={...data,originalShiftId:evidence?.data.shiftId??evidence?.data.originalShiftId??paperShift,originalDeviceId:evidence?.data.deviceId??evidence?.data.originalDeviceId??drawers.find(d=>d.id===paperShift)?.deviceId,actualPaid,occurredAt,payerEvidence:text(f,'payerEvidence'),reference:text(f,'paperReference'),...(evidence?{originalAction:evidence.action,originalData:evidence.data,originalActorId:evidence.actorId}:{})};

   if(actualPaid)data={...data,amount:expensePesos(text(f,'amount')),category:text(f,'category'),purpose:text(f,'purpose'),payee:text(f,'payee')};

  }else{if(!selected)throw Error('Select an expense first.');const returning=action==='return_drawer_expense_cash';if(returning&&!ownShift)throw Error('Open your own current drawer to receive actual cash.');const mode=text(f,'mode');data={...data,expenseId:selected.expenseId,shiftId:returning?p.lease?.shiftId:selected.rootContext.shiftId,deviceId:returning?p.lease?.deviceId:selected.rootContext.deviceId,...(returning?{}:{mode})};if(returning||mode!=='metadata')data.amount=expensePesos(text(f,'amount'),!returning);else data={...data,category:text(f,'category'),purpose:text(f,'purpose'),payee:text(f,'payee'),reference:text(f,'reference')};}

  validateDrawerExpenseOwnerInput(action,data);void perform(action,data,()=>{setEvidence(undefined);setPaid(true);setSelected(undefined);});

 }catch(e){setError((e as Error).message);}}

 if(p.practice)return <section className="panel drawer-expenses"><p className="notice">{unavailable}</p></section>;

 return <div className="drawer-expenses">

 <section className="panel"><h2>Record cash already paid</h2><p>{p.branchName} · Current account: <strong>{p.actorName}</strong> ({p.role}). Each person should use their own cashier login for accurate attribution.</p><details><summary>Registered PC and drawer</summary><p>PC: {p.lease?.deviceId??'No own current drawer'}<br/>Shift: {p.lease?.shiftId??'Not open'}</p></details>

 {p.disabled&&!unavailable&&<p className="notice">Finish the basket or current synchronization before posting an expense.</p>}{unavailable&&<p className="notice" role="status">{unavailable}</p>}{(p.pending.length>0||p.unresolvedSales)&&<Button variant="outline" onClick={p.onSync}>Open Sync center</Button>}

 {success&&<p className="notice good" role="status">{success}</p>}{error&&<p className="notice error" role="alert">{error}</p>}

 {summary&&<><h3>Current drawer</h3><dl className="compact-ledger">{[['Opening cash',summary.openingCash],['Cash payments / collections',summary.paymentCash],['Expenses paid',summary.expenseCashOut],['Cash returned',summary.expenseCashReturned],['Cloud expected cash at last check',summary.expectedCash]].map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{value===null?'Unknown':expenseMoney(value as number)}</dd></div>)}</dl>{summary.negativeBalance&&<p className="notice error">Expected cash is negative. Ask the owner to investigate the drawer discrepancy; do not invent cash.</p>}</>}

 {p.lease&&<LocalDrawerCash db={p.db} lease={p.lease}/>}
 <form ref={recordForm} onSubmit={record} aria-label="Record drawer expense"><fieldset disabled={!!unavailable||blocked}><div className="form-grid"><Field label="Amount paid (₱)"><input required name="amount" inputMode="decimal" value={amountPreview} onChange={e=>{setAmountPreview(e.target.value);setConfirmed(false);}} placeholder="0.00"/></Field><Metadata/></div><label className="check-field"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm ₱{amountPreview||'0.00'} was already paid from my drawer on this PC ({p.lease?.deviceId.slice(0,8)??'no shift'}). Record immediately.</label><Button disabled={!confirmed||!amountPreview}>Record paid expense</Button></fieldset></form>

 </section>

 {originals.length>0&&<section className="panel"><h2>Saved expense originals</h2><p>Keep this PC and the exact original. An interrupted or rejected posting does not prove whether cash was paid. Never pay again to retry.</p>{originals.map(op=><div key={op.key} className="pending-operation"><div><strong>{op.action.replaceAll('_',' ')}</strong><p>{op.error??'Awaiting verified confirmation'}</p><details><summary>Exact original evidence</summary><p>Request: {String(op.data.requestId)} · Actor: {op.actorId}</p><pre>{JSON.stringify(op.data,null,2)}</pre></details>{op.actorId!==p.actorId&&<p>The original cashier must sign in to verify settlement. Owner resolution does not impersonate them.</p>}</div><Button variant="outline" disabled={!p.online||blocked||op.actorId!==p.actorId} onClick={()=>void retry(op)}>Check exact expense original</Button>{owner&&<Button variant="outline" disabled={blocked||!p.online} onClick={()=>{setEvidence(op);setPaid(true);}}>Resolve with owner evidence</Button>}</div>)}</section>}

 <section className="panel record-report"><h2>{owner?'Expense records & exports':'My expense records'}</h2><form className="report-filters" onSubmit={e=>{e.preventDefault();setSelected(undefined);setReport(undefined);setFilters({...draft});}}><Field label="From date"><input type="date" required value={draft.fromDate} onChange={e=>setDraft({...draft,fromDate:e.target.value})}/></Field><Field label="Through date"><input type="date" required max={today()} value={draft.throughDate} onChange={e=>setDraft({...draft,throughDate:e.target.value})}/></Field><Field label="Reporting view"><select value={draft.view} onChange={e=>setDraft({...draft,view:e.target.value as 'original'|'restated'})}><option value="original">Original</option><option value="restated">Restated with owner evidence</option></select></Field><Button disabled={!p.online||blocked}>Show expense records</Button></form>

 {dirty&&<p className="notice">Apply changed dates/view before exporting.</p>}{busy&&<p role="status">Checking expense records…</p>}{!p.online&&<p className="notice">Offline: retained records show their original checked scope. Reconnect to refresh or export.</p>}

 {continuationBlocked&&<p className="notice" role="status">More pages could not be verified. The last verified records, totals and checked time are retained. Refresh expense records to start a fresh report.</p>}
 {report&&<><p className="notice" role="status">{reportQualification(report)}</p><p className="scope-note">{p.branchName} · {report.scope==='branch'?'Owner branch records':'Only this cashier’s expenses'} · {report.fromDate} through {report.throughDate} · {report.view} · Asia/Manila<br/>Checked: {stamp(report.asOf)}</p><dl className="compact-ledger">{[['Gross expenses',report.totals.grossExpenses],['Cash returns',report.totals.cashReturns],['Non-cash corrections',report.totals.nonCashCorrections],['Net expenses',report.totals.netExpenses],...(report.salesAnalytics?[['Gross sales',report.salesAnalytics.totals.grossSales],['Refund cash paid',report.salesAnalytics.totals.refunds],['Refund correction cash recovered',report.salesAnalytics.totals.recoveries],['Sales after expenses',report.salesAfterExpenses!]]:[])].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{expenseMoney(value)}</dd></div>)}</dl>{report.salesAnalytics&&<p className="muted">Sales after expenses is gross sales less refunds plus refund corrections less net expenses. It is not profit or drawer cash. Old debt collections do not count as new sales.</p>}

 <Button variant="outline" disabled={blocked||!p.online||dirty} onClick={()=>void exportAll()}>Export all matching expenses (CSV)</Button><Button variant="ghost" disabled={blocked||!p.online} onClick={()=>void load()}>Refresh expense records</Button>

 <div className="table-wrap" role="region" aria-label="Expense records" tabIndex={0}><table><thead><tr>{['Number / Manila date','Purpose / payee','Kind','Amount','Cash movement','Details'].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{report.records.map(r=><tr key={r.id}><td><strong>{r.number}</strong><small>{stamp(r.occurredAt)}</small></td><td>{r.metadata.purpose}<small>{r.metadata.payee} · {r.metadata.category}</small></td><td>{r.kind}{r.late?' · late evidence':''}</td><td>{expenseMoney(r.amount)}</td><td>{expenseMoney(r.cashDelta)}</td><td><Button size="sm" variant="ghost" onClick={()=>setSelected(r)}>View {r.number}</Button></td></tr>)}</tbody></table></div>{!report.records.length&&<p>No expenses in this selection. Record cash already paid above, or choose other dates.</p>}{report.nextCursor&&<Button disabled={blocked||!p.online||dirty||continuationBlocked} variant="outline" onClick={()=>void load(report.nextCursor)}>Load more expenses</Button>}</>}

 {selected&&<div className="expense-details"><h3>{selected.number} · {selected.rootNumber}</h3><p>{selected.metadata.purpose} · {selected.metadata.payee} · Reference: {selected.metadata.reference||'None'}<br/>Recorded {stamp(selected.recordedAt)} · Actual event {stamp(selected.occurredAt)}<br/>Reason: {selected.reason??'Original payment'}</p><details><summary>Original identity</summary><p>Expense: {selected.expenseId}<br/>Actor: {selected.actorId}<br/>PC: {selected.deviceId}<br/>Shift: {selected.shiftId}</p></details><Closing record={selected}/><Button variant="ghost" onClick={()=>setSelected(undefined)}>Close expense details</Button>

 {owner&&<><details><summary>Append an owner correction</summary><p>Corrects original expense <strong>{selected.rootNumber}</strong>, including when opened from a later return. Original drawer: {selected.rootContext.closingRestatement?'Closed':'Open at checked time'}. Metadata changes no cash. Actual total amount corrections require this original drawer still open. Closed report corrections restate reporting only; historical counts remain intact. Enter 0.00 if nothing was paid; a verified total cannot be below cash already returned.</p><form key={selected.id} onSubmit={e=>ownerForm(e,'correct_drawer_expense')}><fieldset disabled={blocked||!p.online||originals.length>0}><div className="form-grid"><Field label="Correction mode"><select name="mode"><option value="metadata">Metadata only (no cash)</option><option value="amount" disabled={!!selected.rootContext.closingRestatement}>Actual total paid in original open drawer</option><option value="report" disabled={!selected.rootContext.closingRestatement}>Closed-shift reporting total (no cash)</option></select></Field><Field label="Verified actual total (₱) — amount/report only"><input name="amount" inputMode="decimal"/></Field><Metadata defaults={selected.metadata}/><Field label="Correction reason"><input name="reason" required minLength={3} maxLength={500}/></Field></div><Button>Append correction</Button></fieldset></form></details>

 <details><summary>Record actual cash returned</summary><p>Use only after receiving physical cash in your own current drawer. This creates a separate return, capped by the remaining actual expense.</p><form onSubmit={e=>ownerForm(e,'return_drawer_expense_cash')}><fieldset disabled={blocked||!!unavailable}><Amount label="Cash returned (₱)"/><Field label="Cash return reason"><input name="reason" required minLength={3} maxLength={500}/></Field><label className="check-field"><input required type="checkbox"/>I physically received this exact cash in my current drawer.</label><Button>Record cash returned</Button></fieldset></form></details></>}

 </div>}

 </section>

 {owner&&<section className="panel"><h2>Owner evidence & reconciliation</h2><p>For a saved unresolved request, use its exact original from this PC or a supported recovery archive. A request rejected before reaching the server cannot be discovered remotely. Paper entries require the actual original shift/PC and a stable paper reference. Closed-shift evidence never deducts from the current drawer.</p>{evidence?<><p className="notice">Resolving saved request {String(evidence.data.requestId)} for {evidence.actorId}. Original proposed amount: {evidence.data.amount===undefined?'See original':expenseMoney(evidence.data.amount as number)}. A previously committed result wins; the verified confirmation will show its actual amount.</p><Button variant="ghost" disabled={blocked} onClick={()=>{setEvidence(undefined);setPaid(true);}}>Use paper evidence instead</Button></>:<p>Paper evidence: verify the original PC and shift identifiers before entering.</p>}

 {!evidence&&<div className="report-tools"><Button type="button" variant="outline" disabled={blocked||drawerBusy||!p.online||!drawerCursor} onClick={()=>void loadDrawers(drawerCursor??undefined)}>Load older drawers</Button><Button type="button" variant="ghost" disabled={blocked||drawerBusy||!p.online} onClick={()=>void loadDrawers()}>Start with recent drawers</Button>{drawerBusy&&<p role="status">Checking permitted original drawers…</p>}</div>}
 <form key={evidence?.key??`paper:${paperShift}`} aria-label="Owner expense reconciliation" onSubmit={e=>ownerForm(e,'reconcile_drawer_expense')}><fieldset disabled={blocked||!p.online||drawerBusy}><div className="form-grid">{!evidence&&<><Field label="Original cashier drawer"><select required value={paperShift} onChange={e=>setPaperShift(e.target.value)}><option value="">Choose original cashier, PC and time</option>{drawers.map(d=><option key={d.id} value={d.id}>{d.cashier} · {d.pc} · {stamp(d.openedAt)} · {d.closedAt?'Closed':'Open'}</option>)}</select></Field><p className="muted">{drawers.length} permitted drawers on this page, newest first. Load older drawers to find earlier paper-only payments; each page is bounded to 1,000. No history cutoff.</p></>}

 <Field label="What physically happened?"><select name="actualPaid" value={paid?'yes':'no'} onChange={e=>setPaid(e.target.value==='yes')}><option value="yes">Cash actually paid / returned</option>{evidence&&<option value="no">Never paid / returned (no cash)</option>}</select></Field><Field label="Actual payment date and time (Asia/Manila) — paid only"><input name="occurredAt" type="datetime-local" disabled={!paid} required={paid}/></Field>{paid&&<><Amount/><Metadata/></>}<Field label="Stable paper / evidence reference"><input name="paperReference" required maxLength={200}/></Field><Field label="Payer / physical payment evidence"><textarea name="payerEvidence" required minLength={3} maxLength={500}/></Field><Field label="Resolution reason"><textarea name="reason" required minLength={3} maxLength={500}/></Field></div><label className="check-field"><input type="checkbox" required/>I checked the physical payment and original evidence. This does not authorize paying again.</label><Button>Record owner resolution</Button></fieldset></form>

 </section>}

 </div>;

}
