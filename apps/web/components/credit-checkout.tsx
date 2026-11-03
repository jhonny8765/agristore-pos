"use client";
import {useEffect,useRef,useState} from 'react';
import {creditDueOn,creditSelectionSchema,creditTerms,lineAmounts,manilaDay,money,moneyCentavos,clientCreditValue,requireLease,type CreditBook,type CreditClient,type Lease} from '@agristore/domain';
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
 useEffect(()=>{let active=true;if(!online||!organizationId||!branchId)return;setLoading(true);setLoadError('');setConfirmed(false);void command<CreditBook>('credit_book',{organizationId,branchId}).then(b=>{if(!Array.isArray(b.clients)||!Number.isFinite(Date.parse(b.asOf)))throw Error('The saved client list could not be verified.');if(active){setClients(b.clients);setCheckedAt(b.asOf);}}).catch(e=>{if(active)setLoadError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[organizationId,branchId,online,refresh]);
 const client=clients.find(c=>c.id===draft.clientId),checkedTotal=cartAmount(cart.items),total=checkedTotal??0;let amount:number|null=null;try{amount=moneyCentavos(draft.cash||'0');}catch{}const balance=amount===null?null:total-amount;
 const discountTotal=cart.items.reduce((n,i)=>n+BigInt(lineAmounts(i).discount),0n);
 const matching=clients.filter(c=>matchesCreditClient(c,query)),selectedOutsideSearch=client&&!matching.some(c=>c.id===client.id);
 const clientReady=!!client&&creditTerms.includes(draft.term);
 const balanceAllowed=balance!==null&&balance>0&&!!client;
 const clientStatus=(c:CreditClient)=>c.overdue>0?'Has overdue balance':(c.unconfirmedInvoices??0)>0?'Historical due dates unconfirmed':'';
 const patch=(value:Partial<typeof draft>)=>{useCart.setState({credit:{...draft,...value}});setConfirmed(false);};
 async function save(){if(lock.current)return;lock.current=true;onWorking(true);setError('');try{
  requireLease(lease);if(!online)throw Error('Reconnect before completing a credit sale. No credit was approved offline.');
  if(lease.organizationId!==organizationId||lease.branchId!==branchId)throw Error('Open your shift for this branch before making a credit sale.');
  let data=useCart.getState().creditAttempt;
  if(!data){
   if(loading||loadError||!checkedAt)throw Error('Refresh saved clients before making a new credit sale.');
   if((await pendingOperations(db)).length||await db.sales.where('status').anyOf(['pending','sending','retry','review_required']).count())throw Error('Confirm all saved sales and requests in Sync center before making a credit sale.');
   const selection=creditSelectionSchema.parse({clientId:draft.clientId,term:draft.term,officialReference:draft.officialReference});
   if(!client)throw Error('Choose a saved client for this credit sale.');
   if(amount===null||balance===null||amount<0||amount>=total)throw Error('Enter zero or a positive cash amount below the sale total.');
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
   <p className="scope-note" role="status">{loading?'Loading saved clients…':checkedAt?`${clients.length} saved ${clients.length===1?'client':'clients'}${query?` · ${matching.length} search ${matching.length===1?'match':'matches'}`:''}`:'Saved clients not yet loaded.'}{checkedAt&&!loading?` · Checked ${new Date(checkedAt).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'})}`:''}</p>
   {!loading&&!loadError&&online&&checkedAt&&clients.length===0&&<p>No saved clients were found for this branch. Add a client in Customers &amp; credit, then refresh.</p>}
   {!loading&&clients.length>0&&matching.length===0&&<p>No clients match this search. Try another name or phone number.{client?' Your selected client is retained below.':''}</p>}
   <label className="field"><span>Credit client</span><select required value={draft.clientId} onChange={e=>patch({clientId:e.target.value})}><option value="">Select saved client</option>{selectedOutsideSearch&&<option value={client.id}>{client.name} · Selected{clientStatus(client)?` · ${clientStatus(client)}`:''}</option>}{matching.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?` · ${c.phone}`:''}{clientStatus(c)?` · ${clientStatus(c)}`:''}</option>)}</select></label>
   {client&&<div className="credit-client-summary"><strong>Selected: {client.name}</strong><p>Outstanding {money(clientCreditValue(client,'outstanding'))}{client.overdue>0?` · Overdue ${money(clientCreditValue(client,'overdue'))}`:''}</p>{client.overdue>0&&<p className="notice">This client has overdue utang. Review it with the client before completing another credit sale.</p>}{(client.unconfirmedInvoices??0)>0&&<p className="notice">{client.unconfirmedInvoices} historical {client.unconfirmedInvoices===1?'invoice has an unconfirmed due date':'invoices have unconfirmed due dates'}. This new sale keeps its own agreed due date.</p>}</div>}
   <label className="field"><span>Payment term</span><select disabled={!client} value={draft.term} onChange={e=>patch({term:Number(e.target.value) as 30|60|90})}>{creditTerms.map(n=><option key={n} value={n}>{n} calendar days</option>)}</select></label>
   {client&&<p><strong>Due {creditDueOn(manilaDay(),draft.term)}</strong> · Asia/Manila</p>}
   <label className="field"><span>Cash paid now (₱)</span><input type="text" inputMode="decimal" maxLength={17} value={draft.cash} onChange={e=>patch({cash:e.target.value})} placeholder="0.00"/></label>
   <label className="field"><span>Official booklet invoice number</span><input required minLength={3} maxLength={100} value={draft.officialReference} onChange={e=>patch({officialReference:e.target.value})} placeholder="Series and invoice number"/></label>
   <label className="checkbox"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I issued the authorized manual invoice and the client accepted this due date.</label>
  </fieldset>}
  <div className="change"><span>Balance due</span><strong>{balance===null||checkedTotal===null?'Check cash amount':balance<0?'Cash exceeds sale total':money(balance)}</strong></div>
  {!lease&&<p className="notice">Saved clients can be searched before opening a shift. Open your cashier shift to complete a credit sale.</p>}
  <Button className="complete-sale" disabled={disabled||!online||!lease||!cart.items.length||(!cart.creditAttempt&&(!clientReady||!balanceAllowed||loading||!!loadError||!checkedAt||!confirmed||hasCartErrors(cart)||amount===null||amount<0||amount>=total))}>{cart.creditAttempt?'Confirm original credit sale':'Complete credit sale'}</Button>
  <p className="muted">Online only. Cash paid now is the exact amount retained in the drawer. The authorized booklet is your official VAT invoice.</p>
 </form>;
}
