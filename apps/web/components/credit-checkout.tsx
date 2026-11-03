"use client";
import {useEffect,useRef,useState} from 'react';
import {creditDueOn,creditSelectionSchema,lineAmounts,manilaDay,money,requireLease,type CreditBook,type CreditClient,type Lease} from '@agristore/domain';
import {setting,type PosDatabase} from '@agristore/offline';
import {command} from '../lib/api';
import {onlineOperation,pendingOperations} from '../lib/operations';
import {isDatabaseRejection} from '../lib/command-error';
import {hasCartErrors,useCart} from '../lib/cart';
import {heldSaleKey,type HeldSale} from '../lib/held-sale';
import {Button} from './ui/button';

/** Inherit the November 3 catalog/current-sale layout. Credit names the client,
 * the real due date and debt before completion; the booklet remains official.
 * Original online requests survive uncertainty and held-draft reloads. */
export function CreditCheckout({db,lease,online,disabled,onWorking,onSaved}:{db:PosDatabase;lease?:Lease;online:boolean;disabled:boolean;onWorking:(working:boolean)=>void;onSaved:()=>Promise<void>}){
 const cart=useCart(),draft=cart.credit,[clients,setClients]=useState<CreditClient[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[confirmed,setConfirmed]=useState(false);const lock=useRef(false);
 const ctx=lease?{organizationId:lease.organizationId,branchId:lease.branchId}:undefined;
 useEffect(()=>{let active=true;if(!ctx||!online)return;setLoading(true);void command<CreditBook>('credit_book',ctx).then(b=>{if(active){setClients(b.clients);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[lease?.organizationId,lease?.branchId,online]); // eslint-disable-line react-hooks/exhaustive-deps
 const client=clients.find(c=>c.id===draft.clientId),total=cart.items.reduce((n,i)=>n+i.lineTotal,0),amount=Math.round(Number(draft.cash||0)*100),balance=total-amount;
 const discountTotal=cart.items.reduce((n,i)=>n+lineAmounts(i).discount,0);
 const patch=(value:Partial<typeof draft>)=>{useCart.setState({credit:{...draft,...value}});setConfirmed(false);};
 async function save(){if(lock.current)return;lock.current=true;onWorking(true);setError('');try{
  requireLease(lease);if(!online)throw Error('Reconnect before completing a credit sale. No credit was approved offline.');
  let data=useCart.getState().creditAttempt;
  if(!data){
   if((await pendingOperations(db)).length||await db.sales.where('status').anyOf(['pending','sending','retry','review_required']).count())throw Error('Confirm all saved sales and requests in Sync center before making a credit sale.');
   const selection=creditSelectionSchema.parse({clientId:draft.clientId,term:draft.term,officialReference:draft.officialReference});
   if(!client?.enabled||!client.terms.includes(draft.term)||client.overdue>0)throw Error('Choose a client with approved credit and no overdue balance.');
   if(!Number.isSafeInteger(amount)||!/^\d+(\.\d{1,2})?$/.test(draft.cash||'0')||amount<0||amount>=total||balance>client.limit-client.outstanding)throw Error('Check cash paid now and the remaining approved credit limit.');
   if(!confirmed||hasCartErrors(cart))throw Error('Check quantities, discounts and the manual invoice due date.');
   data={...ctx,version:2,requestId:cart.attempt(),deviceId:lease.deviceId,cashierId:lease.cashierId,shiftId:lease.shiftId,items:structuredClone(cart.items),total,cashReceived:amount,...selection,expectedDueOn:creditDueOn(manilaDay(),draft.term),manualInvoiceConfirmed:true};
   // A held draft must retain the complete original request before submission.
   if(cart.heldDraftId)await db.transaction('rw',db.settings,async()=>{const held=await setting<HeldSale>(db,heldSaleKey(lease));if(!held||held.id!==cart.heldDraftId)throw Error('The held draft changed. Keep this basket and review it.');await db.settings.put({key:heldSaleKey(lease),value:{...held,credit:draft,creditAttempt:data}});});
   useCart.setState({creditAttempt:data});
  }
  await onlineOperation(db,lease.cashierId,'record_credit_sale',data,'requestId');
  await onSaved();
 }catch(e){setError(e instanceof Error?e.message:'Could not confirm the original credit sale. Keep this PC and check Sync center.');if(isDatabaseRejection(e))useCart.setState({creditAttempt:undefined});}finally{lock.current=false;onWorking(false);}}
 return <form className="payment-form credit-checkout" aria-label="Credit checkout" onSubmit={e=>{e.preventDefault();void save();}}>
  {discountTotal>0&&<div className="subtotal discount-total"><span>Product discounts included</span><strong>−{money(discountTotal)}</strong></div>}
  <div className="amount-due"><span>Sale total</span><strong>{money(total)}</strong></div>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {cart.creditAttempt?<p className="notice">An original credit sale needs confirmation. Retry this request or check Sync center before changing the basket.</p>:<fieldset disabled={disabled||loading||!online}>
   <legend>Client and payment terms</legend>
   <label className="field"><span>Credit client</span><select required value={draft.clientId} onChange={e=>{const c=clients.find(c=>c.id===e.target.value);patch({clientId:e.target.value,term:c?.terms[0]??30});}}><option value="">Select approved client</option>{clients.map(c=><option key={c.id} value={c.id} disabled={!c.enabled}>{c.name}{c.enabled?'':' · suspended'}</option>)}</select></label>
   {client&&<p>Outstanding {money(client.outstanding)} · Available {money(Math.max(0,client.limit-client.outstanding))}{client.overdue>0?` · Overdue ${money(client.overdue)}`:''}</p>}
   <label className="field"><span>Payment term</span><select value={draft.term} onChange={e=>patch({term:Number(e.target.value) as 30|60|90})}>{(client?.terms??[30,60,90]).map(n=><option key={n} value={n}>{n} calendar days</option>)}</select></label>
   <p><strong>Due {creditDueOn(manilaDay(),draft.term)}</strong> · Asia/Manila</p>
   <label className="field"><span>Cash paid now (₱)</span><input type="number" min="0" step="0.01" value={draft.cash} onChange={e=>patch({cash:e.target.value})} placeholder="0.00"/></label>
   <label className="field"><span>Official booklet invoice number</span><input required minLength={3} maxLength={100} value={draft.officialReference} onChange={e=>patch({officialReference:e.target.value})} placeholder="Series and invoice number"/></label>
   <label className="checkbox"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I issued the authorized manual invoice and the client accepted this due date.</label>
  </fieldset>}
  <div className="change"><span>Balance due</span><strong>{money(Number.isSafeInteger(balance)&&balance>=0?balance:total)}</strong></div>
  <Button className="complete-sale" disabled={disabled||!online||!lease||!cart.items.length||(!cart.creditAttempt&&(!client||!confirmed||hasCartErrors(cart)))}>{cart.creditAttempt?'Confirm original credit sale':'Complete credit sale'}</Button>
  <p className="muted">Online only. Cash paid now is the exact amount retained in the drawer. The authorized booklet is your official VAT invoice.</p>
 </form>;
}
