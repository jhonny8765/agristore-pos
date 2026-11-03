"use client";
import { StateBadge } from "./state-badge";
import { SearchableSelect } from "./search-select";
import { Check,LockKeyhole,ChevronRight } from "lucide-react";
import { RecordTable } from "./record-pages";
import { ProductPhoto } from "./product-photo";
import { RecordPages } from "./record-pages";

// Extend the cooperative stock book: sealed entry first; comparisons and approval in a separate review view.
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import Decimal from 'decimal.js';
import type {Product} from '@agristore/domain';
import type {PosDatabase} from '@agristore/offline';
import {command} from '../lib/api';
import {onlineOperation} from '../lib/operations';
import {canApproveCount,countPage,countState,countLabel,type BlindCount} from '../lib/blind-counts';
import {MeasuredQuantity} from './measured-quantity';
import {ApprovalForm} from './approval-form';
import {Button} from './ui/button';

type Page = {rows:BlindCount[];openCount:number};
const field = (f:FormData,name:string) => String(f.get(name) ?? '').trim();
export function BlindCounts({db,organizationId,branchId,actorId,products,owner,online,disabled,revision,execute,children}: {
 db:PosDatabase;organizationId:string;branchId:string;actorId:string;products:Product[];owner:boolean;
 online:boolean;disabled:boolean;revision:number;execute:(fn:()=>Promise<void>)=>Promise<Error|undefined>;children?:ReactNode;
}) {
 const [rows,setRows]=useState<BlindCount[]>([]),[next,setNext]=useState<ReturnType<typeof countPage>['next']>();
 const [openCount,setOpenCount]=useState(0),[review,setReview]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(''),[feedback,setFeedback]=useState('');
 const [selectedId,setSelectedId]=useState(''),[showStart,setShowStart]=useState(false),[history,setHistory]=useState(false);
 const selected=rows.find(r=>r.id===selectedId)??rows[0];
 const generation=useRef(0);
 const load=useCallback(async(before?:{beforeAt:string;beforeId:string})=>{
  const token=++generation.current;setLoading(true);setError('');
  try {
   const response=await command<Page>('count_workspace',{organizationId,branchId,...before});
   if(token!==generation.current)return;
   const page=countPage(response.rows);
   setRows(old=>before ? [...old,...page.rows.filter(r=>!old.some(o=>o.id===r.id))] : page.rows);
   setNext(page.next);setOpenCount(response.openCount);
  }catch(e){if(token===generation.current)setError(e instanceof Error ? e.message : 'Could not load counts. Reconnect and refresh.');}
  finally{if(token===generation.current)setLoading(false);}
 },[organizationId,branchId]);
 const invalidate=useCallback(()=>{generation.current++;},[]);
 useEffect(()=>{if(online)void load();return invalidate;},[load,online,revision,invalidate]);
 const blocked=disabled || !online || loading;
 async function save(action:string,body:Record<string,unknown>,idField?:string){
  await onlineOperation(db,actorId,action,{organizationId,branchId,...body},idField);
  setFeedback(action==='approve_count' ? 'Adjustment approved once. Original count evidence is retained.' : 'Count step saved. Completed entries cannot be edited.');
  await load();
 }
 return <><section className="panel blind-counts" aria-label="Blind stock counts">
  <div className="section-heading"><h2>Blind stock counts</h2><Button aria-label="Start blind count: open new form" onClick={()=>{setShowStart(v=>!v);setHistory(false);setReview(false);}}>Start blind count</Button><Button variant="outline" disabled={disabled || !online || loading} onClick={()=>void execute(async()=>{await load();})}>Refresh counts</Button></div>
  <p className="notice">Close and synchronize every branch shift before counting.</p><div className="count-steps"><div><span className="step-number">1</span><section><strong>First count</strong><p>Count items without seeing the system quantity.</p></section><ChevronRight/></div><div><span className="step-number">2</span><section><strong>Independent recount</strong><p>A different person counts the same items.</p></section><ChevronRight/></div><div><span className="step-number">3</span><section><strong>Owner approval</strong><p>A separate owner reviews both sealed entries.</p></section></div></div>
  <div className="button-row"><Button variant={review?'outline':'default'} aria-pressed={!review} onClick={()=>{setReview(false);setHistory(false);}}>Enter blind counts</Button><Button variant={review?'default':'outline'} aria-pressed={review} onClick={()=>{setReview(true);setHistory(false);}}>Review sealed counts</Button><Button variant={history?"default":"outline"} aria-pressed={history} onClick={()=>setHistory(true)}>History</Button></div>
  <p className="sr-only">{openCount} open count{openCount===1?'':'s'}. {review ? 'Comparisons appear only after both entries are sealed.' : 'Expected stock and previous quantities are hidden in this entry view. Count from the physical goods.'}</p>
  {!online && <p role="status" className="notice">Counts and approvals require a connection. Saved evidence remains on the server.</p>}
  {feedback && <p role="status" className="notice success">{feedback}</p>}
  {error && <p role="alert" className="notice error">{error} Select Refresh counts to retry.</p>}
  {!review && !history && (showStart||!rows.length) && <form aria-label="Start a blind count" className="count-start" onSubmit={e=>{
   e.preventDefault();const form=e.currentTarget,f=new FormData(form);const [productId,batchId]=field(f,'stock').split(':');
   void execute(async()=>{await save('start_blind_count',{productId,batchId:batchId==='none'?null:batchId,reason:field(f,'reason')},'countId');form.reset();setSelectedId('');setShowStart(false);});
  }}>
   <h3>Start a blind count</h3>
   <label className="field"><span>Product / batch</span><SearchableSelect name="stock" aria-label="Product / batch" required disabled={blocked}>
    {products.flatMap(p=>p.batches.length ? p.batches.map(b=><option key={b.id} value={`${p.id}:${b.id}`} data-search={`${p.sku} ${("originalCode" in p ? String(p.originalCode??"") : "")}`}>{p.name} · {b.lot} ({p.baseUnit})</option>) : [<option key={p.id} value={`${p.id}:none`} data-search={`${p.sku} ${("originalCode" in p ? String(p.originalCode??"") : "")}`}>{p.name} ({p.baseUnit})</option>])}
   </SearchableSelect></label>
   <label className="field"><span>Counting scope / reason</span><input name="reason" required minLength={3} maxLength={1000} disabled={blocked} placeholder="For example, end-of-day loose feeds" /></label>
   <Button disabled={blocked || !products.length}>Start blind count</Button>
  </form>}
  {!loading && !rows.length && <p>No blind counts yet. Start after all sales are synchronized and shifts are closed.</p>}
  <div className="count-workspace-grid" hidden={history}><section className="panel count-entry-panel"><h2>{review?"Review sealed count":"Enter physical count"}</h2><div className="count-records" aria-busy={loading}>
   <RecordPages label="Saved records" showSummary={false}>{rows.filter(row=>row.id===selected?.id).map(row=>{
    const first=row.state==='first_count' && row.startedBy===actorId;
    const recount=row.state==='recount' && row.startedBy!==actorId;
    const unit=products.find(p=>p.id===row.productId)?.baseUnit ?? 'base units';
    return <article className="count-record" key={row.id} aria-label={countLabel(row,products)}>
     {products.find(p=>p.id===row.productId)&&<div className="count-record-photo"><ProductPhoto product={products.find(p=>p.id===row.productId)!}/></div>}<h3>{products.find(p=>p.id===row.productId)?.name??countLabel(row,products)}</h3><p className="count-context">Lot: {products.find(p=>p.id===row.productId)?.batches.find(b=>b.id===row.batchId)?.lot??'No lot'}<br/>Unit: {unit}<br/>Count reason: {row.reason}</p>
     <details className="count-record-meta"><summary>Original count details</summary><small>Count {row.id.slice(0,8)} · {new Date(row.createdAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</small>
     <p><strong>{countState[row.state]}</strong></p></details>
     {row.stale && <p className="notice error">Stock moved after this count started. Close this record and start a fresh count; it cannot adjust stock.</p>}
     {review && row.recounted!==null && <dl className="count-comparison">
      <div><dt>Expected</dt><dd>{new Decimal(row.expected!).toFixed()} {unit}</dd></div>
      <div><dt>First count</dt><dd>{new Decimal(row.counted!).toFixed()} {unit}</dd></div>
      <div><dt>Independent recount</dt><dd>{new Decimal(row.recounted).toFixed()} {unit}</dd></div>
      <div><dt>Difference from expected</dt><dd>{new Decimal(row.counted!).minus(row.expected!).toFixed()} {unit}</dd></div>
     </dl>}
     {review && row.recounted!==null && <><p>First count notes: {row.firstNotes}</p><p>Recount notes: {row.recountNotes}</p><small>First counter: {row.firstCounterName} · Recounted by: {row.recounterName}</small></>}
     {!review && !row.stale && (first || recount) && <form aria-label={first?'Seal first count':'Seal independent recount'} onSubmit={e=>{
      e.preventDefault();const form=e.currentTarget,f=new FormData(form);
      void execute(async()=>{await save('record_blind_count',{countId:row.id,stage:first?'first':'recount',quantity:field(f,'quantity'),notes:field(f,'notes')},'observationId');});
     }}>
      <p className="sr-only">{first?'Record your physical count without consulting expected stock.':'Count independently before asking the first counter for their result. Your entry is sealed before comparisons are revealed.'}</p>
      <MeasuredQuantity key={`${row.id}:${unit}:${first}`} label={`${first?"First physical quantity":"Independent recount quantity"} (${unit})`} entryLabel={first?"First physical quantity":"Independent recount quantity"} name="quantity" measurement={{baseUnit:unit,unitName:unit,factor:"1"}} disabled={blocked}/>
      <label className="field"><span>{first?'First count notes':'Independent recount notes'}</span><input name="notes" required minLength={3} maxLength={1000} placeholder="Record your count notes" disabled={blocked} /></label>
      <Button disabled={blocked}>{first?'Seal first count':'Seal independent recount'}</Button>
     </form>}
     {row.state==='recount' && row.startedBy===actorId && <p>Another signed-in person must recount. Your sealed first entry is retained.</p>}
     {review && canApproveCount(row,actorId,owner) && <ApprovalForm action="Approve adjustment" label="Approval evidence" description="Both signed-in counters agree. Verify their evidence before posting one linked stock adjustment. The discrepancy investigation remains open." confirmLabel="Confirm adjustment" disabled={blocked} onConfirm={reason=>execute(()=>save('approve_count',{countId:row.id,reason}))} />}
     {review && row.state==='ready' && owner && (row.firstCounter===actorId || row.recounter===actorId) && <p>An owner who entered neither count must approve. A typed witness name cannot replace their sign-in.</p>}
     {row.state==='disputed' && <p>No adjustment is allowed. Investigate the difference, close this record with an explanation, then start a fresh blind count. Both entries remain retained.</p>}
     {row.state==='cancelled' && <p>Closure reason: {row.cancelledReason}</p>}
     {row.state!=='approved' && row.state!=='cancelled' && (owner || row.startedBy===actorId) && <ApprovalForm action="Close without adjustment" label="Reason for closing this count" description="Keep the original evidence and close this count without changing stock. Start a fresh count if counting must continue." confirmLabel="Close count" disabled={blocked} onConfirm={reason=>execute(()=>save('cancel_blind_count',{countId:row.id,reason}))} />}
    </article>;
   })}</RecordPages>
  </div></section><aside className="panel count-checklist"><h2>Counting checklist</h2><ul>{['Separate held goods and stock in transit.','Count saleable goods only.','A different signed-in person performs the recount.','A separate owner reviews after both entries are sealed.'].map(item=><li key={item}><Check size={20}/>{item}</li>)}</ul><p className="notice"><LockKeyhole size={16}/> Expected stock stays hidden until both entries are sealed. Count the physical goods.</p></aside></div>
  <section className="panel count-open-list" aria-label="Count records"><h2>{history?'Count records':'Open and recent counts'}</h2><div className="table-wrap" role="region" aria-label="Count worklist" tabIndex={0}><RecordTable><thead><tr><th>Product / lot</th><th>Stage</th><th>Recorded</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className={selected?.id===row.id?'selected-record':''}><td><strong>{countLabel(row,products)}</strong><small>{row.reason}</small></td><td><StateBadge kind={row.state==='first_count'?'pending':row.state==='recount'?'recount':row.state==='ready'||row.state==='approved'?'confirmed':row.state==='cancelled'?'closed':'warning'}>{countState[row.state]}</StateBadge></td><td>{new Date(row.createdAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</td><td><Button variant="outline" size="sm" onClick={()=>{setSelectedId(row.id);setHistory(false);setReview(row.state!=='first_count'&&row.state!=='recount');}}>Continue</Button></td></tr>)}</tbody></RecordTable></div></section>
  {loading && <p role="status">Loading count records…</p>}
  {next && <Button variant="outline" disabled={blocked} onClick={()=>void load(next)}>Load older counts</Button>}
 </section>{history && children}</>;
}
