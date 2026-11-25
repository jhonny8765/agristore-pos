"use client";
import {useState} from 'react';
import Decimal from 'decimal.js';
import type {Product} from '@agristore/domain';
import type {LocalOfflineGrant} from '@agristore/offline';
import type {OfflineBranchStatus} from '../lib/offline-stock-ui';
import {Button} from './ui/button';
const quantity=(value:string)=>{try{return new Decimal(value).toFixed();}catch{return 'Check stock';}};
export function OfflineStockStatus({grant,status,products,ready,online,pending,issue,owner=false,disabled=false,onRefresh,onConfigure}:{grant?:LocalOfflineGrant;status?:OfflineBranchStatus;products:Product[];ready:boolean;online:boolean;pending:number;issue?:string;owner?:boolean;disabled?:boolean;onRefresh:()=>void;onConfigure?:(enabled:boolean,reason:string)=>Promise<void>}){
 const [reason,setReason]=useState('');
 return <section className="offline-stock-status" aria-label={owner?'Branch offline cash status':'This PC offline cash status'}>
  <h3>{ready?'Offline cash ready':status?.enabled?'Offline cash needs attention':'Multiple PCs · Online checkout'}</h3>
  <p>{ready?`Cash sales can use this PC’s remaining allowance until ${new Date(grant!.grant.expiresAt).toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Manila'})}.`:'Reconnect and prepare this PC before taking an offline payment.'} Credit, expenses and refunds require internet.</p>
  {pending>0&&<p role="status"><strong>{pending} paid receipt{pending===1?'':'s'} awaiting upload on this PC.</strong> Do not collect payment again.</p>}
  {issue&&<p className="offline-stock-issue" role="status">{issue}</p>}
  {grant&&<details><summary>Remaining allowance on this PC</summary><p>Every selling unit uses the same product balance. Stock quantity does not confirm intact sealed packs.</p><div className="offline-stock-scroll"><table><thead><tr><th>Product / lot</th><th>Remaining</th></tr></thead><tbody>{grant.remaining.map(a=>{const p=products.find(p=>p.id===a.productId),batch=p?.batches.find(b=>b.id===a.batchId);return <tr key={`${a.productId}:${a.batchId}`}><td>{p?.name??grant.grant.priceBook.find(u=>u.productId===a.productId)?.name??'Saved product'}{batch&&<small>Lot {batch.lot}</small>}</td><td>{quantity(a.remaining)} {p?.baseUnit??grant.grant.priceBook.find(u=>u.productId===a.productId)?.baseUnit}</td></tr>;})}</tbody></table></div></details>}
  {online&&status?.enabled&&<Button type="button" variant="outline" disabled={disabled} onClick={onRefresh}>Sync & refresh this PC’s allowance</Button>}
  {owner&&status&&<>
   <p>Last checked {new Date(status.checkedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}. {status.cloudComplete?'No outstanding grants at that checked time; another PC may have opened a new grant since.':'Cloud reports include confirmed receipts. A disconnected PC may still have unreported paid sales.'}</p>
   <details><summary>PC readiness and reserved stock</summary><div className="offline-stock-scroll"><table><thead><tr><th>PC</th><th>Readiness</th><th>Reconciliation</th></tr></thead><tbody>{status.pcs.map(pc=><tr key={pc.deviceId}><td>{pc.name}</td><td>{pc.prepared?'Updated and prepared':'Open this PC online to prepare it'}</td><td>{pc.reconciled?pc.shiftOpen?'Online drawer open':'No stock grant outstanding':'Stock reserved; unreported receipts unknown'}</td></tr>)}</tbody></table></div><p>Recorded stock below is the last cloud balance. It can include goods already sold by a disconnected PC. Reconcile all PCs before counting stock.</p><div className="offline-stock-scroll"><table><thead><tr><th>Product</th><th>Recorded</th><th>Reserved for PCs</th><th>Unreserved</th></tr></thead><tbody>{status.stocks.map(s=>{const p=products.find(p=>p.id===s.productId);return <tr key={`${s.productId}:${s.batchId}`}><td>{p?.name??'Saved product'}{s.batchId&&<small>Lot {p?.batches.find(b=>b.id===s.batchId)?.lot??'not loaded'}</small>}</td><td>{quantity(s.physical)} {p?.baseUnit}</td><td>{quantity(s.reserved)}</td><td>{quantity(s.unreserved)}</td></tr>;})}</tbody></table></div></details>
   {onConfigure&&<form onSubmit={e=>{e.preventDefault();void onConfigure(!status.enabled,reason);}}><label>Reason for changing offline cash<input value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={1000} required disabled={disabled}/></label><p>Every real shift must be closed, every paid original synchronized, and every registered PC prepared. Unknown lost-PC stock remains reserved.</p><Button type="submit" disabled={disabled||!online||reason.trim().length<3||status.pcs.some(pc=>pc.shiftOpen||!pc.reconciled||!pc.prepared)}>{status.enabled?'Pause automatic offline cash':'Enable automatic offline cash'}</Button></form>}
  </>}
 </section>;
}
