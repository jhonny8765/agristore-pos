"use client";
import {useEffect,useState} from 'react';
import {liveQuery} from 'dexie';
import {money} from '@agristore/domain';
import {unresolvedStates,type LocalSale,type PosDatabase} from '@agristore/offline';
import {onlineOperation} from '../lib/operations';
import {Button} from './ui/button';

export function OfflineOriginalReconciliation({db,organizationId,branchId,actorId,online,disabled,execute}:{db:PosDatabase;organizationId:string;branchId:string;actorId:string;online:boolean;disabled:boolean;execute:(fn:()=>Promise<void>)=>Promise<Error|undefined>}){
 const [records,setRecords]=useState<LocalSale[]>([]),[selectedId,setSelectedId]=useState(''),[reference,setReference]=useState(''),[reason,setReason]=useState(''),[verifiedId,setVerifiedId]=useState<string>(),[error,setError]=useState('');
 useEffect(()=>{setRecords([]);setError('');const subscription=liveQuery(()=>db.sales.where('status').anyOf(unresolvedStates).filter(s=>!!s.allocation&&!s.allocation.acknowledged&&s.payload.organizationId===organizationId&&s.payload.branchId===branchId).toArray()).subscribe({next:rows=>setRecords(rows.sort((a,b)=>a.allocation!.original.grantId.localeCompare(b.allocation!.original.grantId)||a.allocation!.original.sequence-b.allocation!.original.sequence).slice(0,100)),error:()=>setError('The saved originals could not be read. Keep site data and retry.')});return()=>subscription.unsubscribe();},[db,organizationId,branchId]);
 const selected=records.find(s=>s.id===selectedId)??records[0];if(!selected)return null;
 return <section className="panel offline-original-resolution" aria-label="Owner review of paid offline receipts"><h2>Resolve a paid offline receipt</h2><p>Use normal synchronization first. If a cashier’s original cannot upload, verify the original receipt and actual payment. The saved cashier, date, items and amounts are preserved. A previously recorded receipt is linked without another payment.</p>
 {error&&<p role="alert">{error}</p>}
 <form onSubmit={e=>{e.preventDefault();if(verifiedId!==selected.id||!selected.allocation)return;void execute(async()=>{await onlineOperation(db,actorId,'reconcile_allocated_cash_sale',{organizationId,branchId,original:selected.allocation!.original,reference,reason},'requestId');setVerifiedId(undefined);setReference('');setReason('');});}}>
  <label>Original paid receipt<select value={selected.id} disabled={disabled} onChange={e=>{setSelectedId(e.target.value);setVerifiedId(undefined);}}>{records.map(s=><option key={s.id} value={s.id}>Receipt {s.id.slice(0,8)} · #{s.allocation!.original.sequence} · {money(s.payload.total)} · {new Date(s.payload.occurredAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</option>)}</select></label>
  <p>{selected.payload.items.map(i=>`${i.quantity} ${i.unitName} ${i.name}`).join(' · ')}</p><p>Resolve originals in their order for each PC. Uncertain stock remains reserved; this does not rewrite an already counted drawer.</p>
  <label>Receipt / payment reference<input value={reference} onChange={e=>setReference(e.target.value)} required minLength={3} maxLength={1000} disabled={disabled}/></label>
  <label>Why owner resolution is needed<textarea value={reason} onChange={e=>setReason(e.target.value)} required minLength={3} maxLength={1000} disabled={disabled}/></label>
  <label className="checkbox"><input type="checkbox" checked={verifiedId===selected.id} onChange={e=>setVerifiedId(e.target.checked?selected.id:undefined)} disabled={disabled}/><span>I verified the original receipt and actual payment. Do not collect payment again.</span></label>
  <Button type="submit" disabled={!online||disabled||verifiedId!==selected.id||reference.trim().length<3||reason.trim().length<3}>Resolve this original receipt</Button>
 </form></section>;
}
