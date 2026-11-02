"use client";
import { useState,type ReactNode } from 'react';
import {CalendarDays,FileText,MapPin,Printer,ReceiptText,RotateCcw,Search,Wallet} from 'lucide-react';
import {money,type Product} from '@agristore/domain';
import {receiptMatches,receiptStatus,type ReceiptView} from '../lib/receipt-view';
import {RecordTable} from './record-pages';
import {ProductPhoto} from './product-photo';
import {WorkspaceStat,useBusinessClock} from './workspace-ui';
import {Button} from './ui/button';

export function ReceiptWorkspace({rows,products,branchName,actions,practice}:{rows:ReceiptView[];products:Product[];branchName:string;actions:(row:ReceiptView)=>ReactNode;practice:boolean}) {
 const now=useBusinessClock();
 const [query,setQuery]=useState(''),[period,setPeriod]=useState('all'),[status,setStatus]=useState('all'),[selectedId,setSelectedId]=useState('');
 const filtered=rows.filter(r=>receiptMatches(r,query,period,status,now)).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id.localeCompare(a.id));
 const selected=filtered.find(r=>r.id===selectedId)??filtered[0];
 const gross=filtered.reduce((n,r)=>n+r.total,0),affected=filtered.filter(r=>r.status==='partial'||r.status==='refunded').length;
 return <div className="receipt-workspace"><div className="receipt-register">
  <div className="register-filters"><label className="field search-field"><span className="sr-only">Search receipt number</span><Search size={19} aria-hidden="true"/><input type="search" placeholder="Search receipt number or transaction ID" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <label className="field"><span className="sr-only">Receipt period</span><select aria-label="Receipt period" value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">All dates</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option></select></label>
   <label className="field"><span className="sr-only">Receipt status</span><select aria-label="Receipt status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{Object.entries(receiptStatus).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
  </div>
  <div className="workspace-stats three"><WorkspaceStat icon={Wallet} label="Recorded sales (loaded)" value={money(gross)}/><WorkspaceStat icon={RotateCcw} label="Receipts with refunds" value={affected}/><WorkspaceStat icon={ReceiptText} label="Matching receipts loaded" value={filtered.length}/></div>
  <section className="panel receipt-list-panel" aria-label="Receipt register"><h2 className="sr-only">{branchName} · cash sales</h2><p className="scope-note">Filters and totals cover loaded receipts. Load older receipts to search more history.</p>
   {filtered.length?<div className="table-wrap" role="region" aria-label="Receipt list" tabIndex={0}><RecordTable key={`${query}:${period}:${status}`}><thead><tr><th>Receipt</th><th>Date / time</th><th className="numeric">Amount</th><th>Status</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} className={row.id===selected?.id?'selected-record':''}><td><button type="button" className="record-link" aria-pressed={row.id===selected?.id} onClick={()=>setSelectedId(row.id)}>{row.receipt}</button><small>{row.id.slice(0,8)}</small></td><td>{new Date(row.occurredAt).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</td><td className="numeric"><strong>{money(row.total)}</strong></td><td><span className={`status-tag ${row.status==='completed'?'good':row.status==='partial'||row.status==='review'?'warn':''}`}>{receiptStatus[row.status]}</span></td></tr>)}</tbody></RecordTable></div>:<div className="register-empty"><FileText size={30}/><h3>No matching receipts</h3><p>Try another receipt number, date or status.</p><Button variant="outline" onClick={()=>{setQuery('');setPeriod('all');setStatus('all');}}>Clear receipt filters</Button></div>}
  </section>
 </div><aside className="panel receipt-detail printable-record" aria-label="Selected receipt">
  {selected?<><div className="section-heading"><h2>{selected.receipt}</h2><span className={`status-tag ${selected.status==='completed'?'good':''}`}>{practice?'Practice · cash':receiptStatus[selected.status]}</span></div><p className="receipt-context"><MapPin size={18}/>{branchName}</p><p className="receipt-context"><CalendarDays size={18}/>{new Date(selected.occurredAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</p><small className="receipt-original-id">Original ID: {selected.id}</small><h3>Items</h3>
   {selected.payload?.items?.map((item,n)=>{const product=products.find(p=>p.id===item.productId);return <div className="receipt-detail-item" key={`${item.productId}:${n}`}>{product&&<ProductPhoto product={product}/>}<div><strong>{item.name}</strong><small>{item.unitName}{item.batchId?` · Lot ${product?.batches.find(b=>b.id===item.batchId)?.lot??item.batchId}`:''}</small><small>{item.quantity} × {money(item.unitPrice)}</small></div><strong>{money(item.lineTotal)}</strong></div>;})??<p>Item details are unavailable in this downloaded record. Reconnect and refresh before using it for a correction.</p>}
   <dl className="receipt-totals"><div><dt>Original amount due</dt><dd>{money(selected.total)}</dd></div><div><dt>Cash received</dt><dd>{money(selected.cashReceived)}</dd></div><div className="receipt-change"><dt>Change</dt><dd>{money(selected.cashReceived-selected.total)}</dd></div></dl>
   <Button type="button" className="print-record-button" disabled={!selected.payload?.items?.length} onClick={()=>window.print()}><Printer size={20}/>Print receipt</Button>
   <div className="receipt-corrections">{actions(selected)}</div><p className="muted">Original records remain available after corrections. Cash sales only · Not a tax invoice.</p>
  </>:<><h2>Receipt details</h2><p>Choose a receipt to see its original items, cash and change.</p></>}
 </aside></div>;
}
