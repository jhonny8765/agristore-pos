"use client";
import {useEffect,useRef,useState} from 'react';
import {creditDueOn,creditSelectionSchema,lineAmounts,manilaDay,money,moneyCentavos,availableCredit,clientCreditValue,requireLease,type CreditBook,type CreditClient,type Lease} from '@agristore/domain';
import {setting,type PosDatabase} from '@agristore/offline';
import {command} from '../lib/api';
import {onlineOperation,pendingOperations} from '../lib/operations';
import {isDatabaseRejection} from '../lib/command-error';
import {hasCartErrors,useCart,cartAmount} from '../lib/cart';
import {heldSaleKey,type HeldSale} from '../lib/held-sale';
import {Button} from './ui/button';
import {matchesCreditClient} from '../lib/credit-client-search';

/** Inherit the November 3 catalog/current-sale layout. Credit names the client,
 * the real due date and debt before completion; the booklet remains official.
 * Original online requests survive uncertainty and held-draft reloads. */
export function CreditCheckout({db,organizationId,branchId,lease,online,disabled,onWorking,onSaved}:{db:PosDatabase;organizationId:string;branchId:string;lease?:Lease;online:boolean;disabled:boolean;onWorking:(working:boolean)=>void;onSaved:()=>Promise<void>}){
 const cart=useCart(),draft=cart.credit,[clients,setClients]=useState<CreditClient[]>([]),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(false),[confirmed,setConfirmed]=useState(false),[query,setQuery]=useState(''),[refresh,setRefresh]=useState(0),[checkedAt,setCheckedAt]=useState('');const lock=useRef(false);
 const ctx={organizationId,branchId};
 useEffect(()=>{let active=true;if(!online||!organizationId||!branchId)return;setLoading(true);setLoadError('');setConfirmed(false);void command<CreditBook>('credit_book',{organizationId,branchId}).then(b=>{if(!Array.isArray(b.clients)||!Number.isFinite(Date.parse(b.asOf)))throw Error('The saved client list could not be verified.');if(active){setClients(b.clients);setCheckedAt(b.asOf);const current=useCart.getState(),selected=b.clients.find(c=>c.id===current.credit.clientId);if(!current.creditAttempt&&selected?.enabled&&!selected.terms.includes(current.credit.term))useCart.setState({credit:{...current.credit,term:selected.terms[0]??30}});}}).catch(e=>{if(active)setLoadError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[organizationId,branchId,online,refresh]);
 const client=clients.find(c=>c.id===draft.clientId),checkedTotal=cartAmount(cart.items),total=checkedTotal??0;let amount:number|null=null;try{amount=moneyCentavos(draft.cash||'0');}catch{}const balance=amount===null?null:total-amount;
 const discountTotal=cart.items.reduce((n,i)=>n+BigInt(lineAmounts(i).discount),0n);
 const matching=clients.filter(c=>matchesCreditClient(c,query)),selectedOutsideSearch=client&&!matching.some(c=>c.id===client.id);
 const policyReady=!!client?.enabled&&client.terms.includes(draft.term)&&client.overdue===0;
 const balanceAllowed=balance!==null&&balance>0&&!!client&&balance<=availableCredit(client);
 const clientStatus=(c:CreditClient)=>!c.enabled?'Credit not enabled':c.overdue>0?'Overdue balance':availableCredit(c)===0?'No available credit':'Credit enabled';
 const patch=(value:Partial<typeof draft>)=>{useCart.setState({credit:{...draft,...value}});setConfirmed(false);};
 async function save(){if(lock.current)return;lock.current=true;onWorking(true);setError('');try{
  requireLease(lease);if(!online)throw Error('Reconnect before completing a credit sale. No credit was approved offline.');
  if(lease.organizationId!==organizationId||lease.branchId!==branchId)throw Error('Open your shift for this branch before making a credit sale.');
  let data=useCart.getState().creditAttempt;
  if(!data){
   if(loading||loadError||!checkedAt)throw Error('Refresh saved clients before making a new credit sale.');
   if((await pendingOperations(db)).length||await db.sales.where('status').anyOf(['pending','sending','retry','review_required']).count())throw Error('Confirm all saved sales and requests in Sync center before making a credit sale.');
   const selection=creditSelectionSchema.parse({clientId:draft.clientId,term:draft.term,officialReference:draft.officialReference});
   if(!client?.enabled||!client.terms.includes(draft.term)||client.overdue>0)throw Error('Choose a client with approved credit and no overdue balance.');
   if(amount===null||balance===null||amount>=total||balance>availableCredit(client))throw Error('Check cash paid now and the remaining approved credit limit.');
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
  <div className="amount-due"><span>Sale total</span><strong>{checkedTotal===null?'Check sale total':money(total)}</strong></div>
  {error&&<p className="notice error" role="alert">{error}</p>}
  {loadError&&<p className="notice error" role="alert">Could not load saved clients: {loadError} Use Refresh clients to try again.</p>}
  {!online&&<p className="notice">Reconnect to load or refresh saved clients. Credit sales require internet.</p>}
  {cart.creditAttempt?<p className="notice">An original credit sale needs confirmation. Retry this request or check Sync center before changing the basket.</p>:<fieldset disabled={disabled||loading||!online}>
   <legend>Client and payment terms</legend>
   <div className="credit-client-tools"><label className="field"><span>Search saved clients</span><input type="search" maxLength={180} value={query} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}} onChange={e=>{setQuery(e.target.value);setConfirmed(false);}} placeholder="Name or phone number" autoComplete="off"/></label><Button type="button" variant="outline" onClick={()=>setRefresh(n=>n+1)} disabled={disabled||loading||!online}>Refresh clients</Button></div>
   <p className="scope-note" role="status">{loading?'Loading saved clients…':checkedAt?`${clients.length} saved ${clients.length===1?'client':'clients'} · ${clients.filter(c=>c.enabled).length} credit-enabled${query?` · ${matching.length} search ${matching.length===1?'match':'matches'}`:''}`:'Saved clients not yet loaded.'}{checkedAt&&!loading?` · Checked ${new Date(checkedAt).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'})}`:''}</p>
   {!loading&&!loadError&&online&&checkedAt&&clients.length===0&&<p>No saved clients were found for this branch. Add a client in Customers &amp; credit, then refresh.</p>}
   {!loading&&clients.length>0&&matching.length===0&&<p>No clients match this search. Try another name or phone number.{client?' Your selected client is retained below.':''}</p>}
   <label className="field"><span>Credit client</span><select required value={draft.clientId} onChange={e=>{const c=clients.find(c=>c.id===e.target.value);patch({clientId:e.target.value,term:c?.terms[0]??30});}}><option value="">Select saved client</option>{selectedOutsideSearch&&<option value={client.id}>{client.name} · Selected · {clientStatus(client)}</option>}{matching.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''} · {clientStatus(c)}</option>)}</select></label>
   {client&&<div className="credit-client-summary"><strong>Selected: {client.name}</strong><p>Outstanding {money(clientCreditValue(client,'outstanding'))} · Available {money(availableCredit(client))}{client.overdue>0?` · Overdue ${money(clientCreditValue(client,'overdue'))}`:''}</p>{!client.enabled&&<p className="notice">This client is saved. New credit is not enabled. The owner must approve a credit limit and terms in Customers &amp; credit.</p>}{client.enabled&&client.overdue>0&&<p className="notice">An overdue balance prevents a new credit sale.</p>}{client.enabled&&client.overdue===0&&availableCredit(client)===0&&<p className="notice">This client has no available credit. Review the balance and approved limit before a new credit sale.</p>}</div>}
   <label className="field"><span>Payment term</span><select disabled={!client?.enabled} value={draft.term} onChange={e=>patch({term:Number(e.target.value) as 30|60|90})}>{client?.enabled?client.terms.map(n=><option key={n} value={n}>{n} calendar days</option>):<option value={draft.term}>Select a credit-enabled client</option>}</select></label>
   {client?.enabled&&<p><strong>Due {creditDueOn(manilaDay(),draft.term)}</strong> · Asia/Manila</p>}
   <label className="field"><span>Cash paid now (₱)</span><input type="text" inputMode="decimal" maxLength={17} value={draft.cash} onChange={e=>patch({cash:e.target.value})} placeholder="0.00"/></label>
   <label className="field"><span>Official booklet invoice number</span><input required minLength={3} maxLength={100} value={draft.officialReference} onChange={e=>patch({officialReference:e.target.value})} placeholder="Series and invoice number"/></label>
   <label className="checkbox"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I issued the authorized manual invoice and the client accepted this due date.</label>
  </fieldset>}
  <div className="change"><span>Balance due</span><strong>{balance===null||checkedTotal===null?'Check cash amount':balance<0?'Cash exceeds sale total':money(balance)}</strong></div>
  {!lease&&<p className="notice">Saved clients can be searched before opening a shift. Open your cashier shift to complete a credit sale.</p>}
  <Button className="complete-sale" disabled={disabled||!online||!lease||!cart.items.length||(!cart.creditAttempt&&(!policyReady||!balanceAllowed||loading||!!loadError||!checkedAt||!confirmed||hasCartErrors(cart)||amount===null||amount>=total))}>{cart.creditAttempt?'Confirm original credit sale':'Complete credit sale'}</Button>
  <p className="muted">Online only. Cash paid now is the exact amount retained in the drawer. The authorized booklet is your official VAT invoice.</p>
 </form>;
}
