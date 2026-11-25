"use client";
import {useEffect,useRef,useState} from 'react';
import Decimal from 'decimal.js';
import {command} from '../lib/api';
import {roundToPack,suggestReplenishment,createSnapshotReadGuard} from '../lib/branch-replenishment';
import type {Shipment} from '../lib/branch-transfers';
import type {BranchNetwork} from '../lib/branch-network';
import {Button} from './ui/button';

type StockBranch={branchId:string;name:string;usable:string;held:string;incoming:string;outgoing:string;nearExpiry:string;planningOnHand:string;planningIncoming:string};
type StockItem={productId:string;name:string;sku:string;baseUnit:string;minimumStock:string;usable:string;held:string;transit:string;branches:StockBranch[]};
type Cursor={scope:string;organizationId:string;workingBranchId:string;actorId:string;id:string};
type Page<T>={kind:string;organizationId:string;checkedAt:string;items:T[];next:Cursor|null};
type Props={organizationId:string;branchId:string;actorId:string;network:BranchNetwork};
const decimal=Decimal.clone({precision:80});
export function BranchNetworkOverview({organizationId,branchId,actorId,network}:Props){
 const [kind,setKind]=useState<'stock'|'shipments'>('stock');
 const [page,setPage]=useState<Page<StockItem|Shipment>>();
 const [selectedBranch,setSelectedBranch]=useState('all');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const lifecycle=useRef({sequence:0}).current;
 const clocks=useRef(createSnapshotReadGuard()).current,[stale,setStale]=useState(true);
 useEffect(()=>{const tick=()=>{if(clocks.observe(Date.now(),performance.now()))setStale(true);};const timer=setInterval(tick,1000);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};},[clocks]);
 function checkSnapshot(){const invalid=clocks.observe(Date.now(),performance.now());if(invalid)setStale(true);return invalid;}
 useEffect(()=>{return()=>{lifecycle.sequence++;};},[organizationId,branchId,actorId,lifecycle]);
 useEffect(()=>{let live=true;const token=++lifecycle.sequence;clocks.begin(token,Date.now(),performance.now());
  command<Page<StockItem|Shipment>>('branch_network_overview',{organizationId,branchId,kind}).then(result=>{
   if(live&&token===lifecycle.sequence){if(result.kind!==kind||result.organizationId!==organizationId||!Array.isArray(result.items)||!Number.isFinite(Date.parse(result.checkedAt)))throw Error('Report scope could not be verified.');const resultStale=clocks.succeed(token,Date.now(),performance.now());if(resultStale===null)return;setStale(resultStale);setPage(result);setError('');}
  }).catch(e=>{clocks.fail(token);if(live&&token===lifecycle.sequence){setPage(undefined);setError(e instanceof Error?e.message:'Could not load the report.');}}).finally(()=>{if(live&&token===lifecycle.sequence)setLoading(false);});
  return()=>{live=false;clocks.fail(token);lifecycle.sequence++;};
 },[organizationId,branchId,actorId,kind,refresh,lifecycle,clocks]);
 async function next(){if(!page?.next||loading)return;const cursor=page.next,token=++lifecycle.sequence;clocks.begin(token,Date.now(),performance.now());setLoading(true);setError('');
  try{const result=await command<Page<StockItem|Shipment>>('branch_network_overview',{organizationId,branchId,kind,cursor});if(token!==lifecycle.sequence)return;
   if(result.kind!==kind||result.organizationId!==organizationId||!Array.isArray(result.items)||!Number.isFinite(Date.parse(result.checkedAt)))throw Error('Report scope could not be verified.');
   const resultStale=clocks.succeed(token,Date.now(),performance.now());if(resultStale===null)return;setStale(resultStale);setPage(result);
  }catch(e){clocks.fail(token);if(token===lifecycle.sequence){setPage(undefined);setError(e instanceof Error?e.message:'Could not load the report.');}}finally{if(token===lifecycle.sequence)setLoading(false);}
 }
 return <section className="panel network-stock-report" aria-label="Network stock overview"><h2>Network stock overview</h2>
  <p>Stock covers approved active network branches and is shown by product and base unit. Transfers are internal movements, separate from sales, payments and accounts. Report viewing does not change this PC’s working branch or cash drawer.</p>
  <div className="report-tools"><Button variant={kind==='stock'?'default':'outline'} onClick={()=>{if(kind!=='stock'){setPage(undefined);setLoading(true);setKind('stock');}}}>Stock and advice</Button><Button variant={kind==='shipments'?'default':'outline'} onClick={()=>{if(kind!=='shipments'){setPage(undefined);setLoading(true);setKind('shipments');}}}>Deliveries and differences</Button></div>
  {error&&<><p role="alert">{error}</p><Button variant="outline" onClick={()=>{setPage(undefined);setError('');setLoading(true);setRefresh(n=>n+1);}}>Retry report</Button></>}{loading&&<p role="status">Checking report…</p>}
  {page&&<><p className="scope-note">Checked {new Date(page.checkedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})} · Checked snapshot; stock may have changed. Refresh before using advice if more than five minutes have passed. Other pages have their own checked times.</p>
   {stale&&<p role="status">Snapshot needs refresh (five minutes have passed or the clock changed). Refresh before using advice.</p>}
   {kind==='stock'?<><label className="field"><span>Report branch</span><select value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)}><option value="all">Approved active branches</option>{network.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    {(page.items as StockItem[]).map(p=><StockCard key={p.productId} item={p} selectedBranch={selectedBranch} stale={stale} checkSnapshot={checkSnapshot}/>)}
   </>:<>{(page.items as Shipment[]).map(s=><article key={s.shipmentId}><h3>{s.reference} · {s.sourceName} to {s.destinationName}</h3><p>{s.status==='in_transit'?'Outstanding':'Closed'}{s.expectedArrival?` · Expected ${s.expectedArrival}${s.status==='in_transit'&&s.expectedArrival<new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})?' · Late':''}`:' · No expected date recorded'}</p>{s.lines.map(l=><p key={l.lineId}>{l.productName}: sent {l.quantity}, accepted {l.accepted}, held {l.held}, lost {l.lost}, returned unreceived {l.returned}, outstanding {l.outstanding} {l.unitName}</p>)}</article>)}</>}
   {!page.items.length&&<p>No records on this page.</p>}<Button variant="outline" disabled={loading} onClick={()=>{setPage(undefined);setLoading(true);setRefresh(n=>n+1);}}>First page / refresh</Button><Button variant="outline" disabled={loading||!page.next} onClick={()=>void next()}>Next page</Button>{page.next&&<p>More records are available.</p>}</>}
 </section>;
}
function StockCard({item,selectedBranch,stale,checkSnapshot}:{item:StockItem;selectedBranch:string;stale:boolean;checkSnapshot:()=>boolean}){
 const b=item.branches.find(x=>x.branchId===selectedBranch);const [open,setOpen]=useState(false);
 return <article><h3>{item.name} · {item.sku}</h3>{selectedBranch==='all'?<p>Shelf balance {item.usable} · Held {item.held} · In transit {item.transit} {item.baseUnit} · Total {new decimal(item.usable).plus(item.held).plus(item.transit).toFixed()} {item.baseUnit}</p>:b?<><p>{b.name}: shelf balance {b.usable} · held {b.held} · incoming {b.incoming} · outgoing {b.outgoing} {item.baseUnit}</p><p>{new decimal(b.planningOnHand).lte(item.minimumStock)?`Planning on hand at or below product minimum (${item.minimumStock} ${item.baseUnit}). `:''}Near expiry or expired (within 90 days): {b.nearExpiry} {item.baseUnit}, including held stock.</p><Button variant="outline" disabled={stale} onClick={()=>{if(!checkSnapshot())setOpen(!open);}}>Replenishment advice</Button>{open&&!stale&&<Advice key={`${item.productId}:${b.branchId}`} item={item} branch={b}/>}</>:<p>Branch stock unavailable for this product.</p>}</article>;
}
function Advice({item,branch}:{item:StockItem;branch:StockBranch}){
 const [daily,setDaily]=useState(''),[lead,setLead]=useState(''),[review,setReview]=useState(''),[buffer,setBuffer]=useState(''),[pack,setPack]=useState(''),[target,setTarget]=useState(''),[reason,setReason]=useState('');
 let suggestion:string|undefined,rounded:string|undefined,error='';
 if(daily&&lead&&review&&buffer){try{suggestion=suggestReplenishment({dailyDemand:daily,leadDays:lead,reviewDays:review,buffer,onHand:branch.planningOnHand,confirmedIncoming:branch.planningIncoming});if(pack)rounded=roundToPack(suggestion,pack);}catch(e){error=e instanceof Error?e.message:'Check the quantities.';}}
 return <div><p>Insufficient verified demand history. Enter a daily demand estimate and its source or reason; no order is created. Planning on hand excludes held and expired stock. Planning incoming excludes held-origin and already expired transit; it may still require inspection on arrival. Approved requests that have not been dispatched are not incoming.</p>
  <label className="field"><span>Reason or demand source</span><input value={reason} onChange={e=>setReason(e.target.value)}/></label>
  {[[`Daily demand (${item.baseUnit} per day)`,daily,setDaily],['Lead days',lead,setLead],['Review days',review,setReview],['Buffer in base units',buffer,setBuffer],['Optional pack size in base units',pack,setPack],['Optional manual target in base units',target,setTarget]].map(([label,value,change])=><label className="field" key={label as string}><span>{label as string}</span><input inputMode="decimal" value={value as string} onChange={e=>(change as (s:string)=>void)(e.target.value)}/></label>)}
  <p>Planning on hand {branch.planningOnHand} {item.baseUnit}; planning incoming {branch.planningIncoming} {item.baseUnit}. Formula: demand × (lead + review) + buffer − on hand − incoming, minimum zero.</p>
  {error&&<p role="alert">{error}</p>}{suggestion&&reason.trim()&&<p>Calculated suggestion: {suggestion} {item.baseUnit}.{rounded&&` Rounded separately to packs: ${rounded} ${item.baseUnit}.`}</p>}{target&&reason.trim()&&/^\d{1,12}(?:\.\d{1,6})?$/.test(target)&&<p>Manual target: {target} {item.baseUnit} · Reason: {reason}</p>}
 </div>;
}
