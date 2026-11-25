"use client";
import { X } from "lucide-react";
import {useEffect,useId,useRef,useState} from 'react';
import {creditDueOn,creditSelectionSchema,isCreditSaleTerm,maxCreditSaleDays,lineAmounts,manilaDay,money,moneyCentavos,clientCreditValue,requireLease,validateSellingItem,type CreditBook,type CreditClient,type Lease} from '@agristore/domain';
import {setting,unresolvedStates,type PosDatabase} from '@agristore/offline';
import {command} from '../lib/api';
import {onlineOperation,pendingOperations} from '../lib/operations';
import {isDatabaseRejection} from '../lib/command-error';
import {hasCartErrors,useCart,cartAmount} from '../lib/cart';
import {heldSaleKey,type HeldSale} from '../lib/held-sale';
import {Button} from './ui/button';
import {creditConfirmation,type ConfirmedCreditSale} from '../lib/credit-confirmation';
import {SearchSelect} from './search-select';
import {matchesCreditClient} from '../lib/credit-client-search';

const checkoutTerms = [30, 45, 60] as const;

/** Inherit the November 3 catalog/current-sale layout. Credit names the client,
 * the real due date and debt before completion; the booklet remains official.
 * Original online requests survive uncertainty and held-draft reloads. */
export function CreditCheckout({db,organizationId,branchId,lease,online,disabled,onWorking,onSaved}:{db:PosDatabase;organizationId:string;branchId:string;lease?:Lease;online:boolean;disabled:boolean;onWorking:(working:boolean)=>void;onSaved:(sale:ConfirmedCreditSale)=>Promise<void>}){
 const cart=useCart(),draft=cart.credit,[clients,setClients]=useState<CreditClient[]>([]),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(false),[confirmed,setConfirmed]=useState(false),[refresh,setRefresh]=useState(0),[checkedAt,setCheckedAt]=useState('');const lock=useRef(false);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const [businessDay,setBusinessDay]=useState(()=>manilaDay()),dayRef=useRef(businessDay),confirmedOn=useRef<string|undefined>(undefined);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const checkDay=()=>{
   const day=manilaDay();
   if(day!==dayRef.current){dayRef.current=day;confirmedOn.current=undefined;setBusinessDay(day);setConfirmed(false);}
   clearTimeout(timer);
   timer=setTimeout(checkDay,Math.max(1,Date.parse(day+'T00:00:00+08:00')+86400000-Date.now()+25));
  };
  checkDay();window.addEventListener('focus',checkDay);document.addEventListener('visibilitychange',checkDay);
  return()=>{clearTimeout(timer);window.removeEventListener('focus',checkDay);document.removeEventListener('visibilitychange',checkDay);};
 },[]);
 const ctx={organizationId,branchId};
 const termName=useId(),searchLabel=useId(),customDays=useRef<HTMLInputElement>(null);
 useEffect(()=>{let active=true;if(!online||!organizationId||!branchId)return;setLoading(true);setLoadError('');setConfirmed(false);void command<CreditBook>('credit_book',{organizationId,branchId,includeHistory:false}).then(b=>{if(!Array.isArray(b.clients)||!Number.isFinite(Date.parse(b.asOf)))throw Error('The saved client list could not be verified.');if(active){setClients(b.clients);setCheckedAt(b.asOf);}}).catch(e=>{if(active)setLoadError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[organizationId,branchId,online,refresh]);
 const client=clients.find(c=>c.id===draft.clientId),checkedTotal=cartAmount(cart.items),total=checkedTotal??0;let amount:number|null=null;try{amount=moneyCentavos(draft.cash||'0');}catch{}const balance=amount===null?null:total-amount;
 const discountTotal=cart.items.reduce((n,i)=>n+BigInt(lineAmounts(i).discount),0n);
 const clientOptions=clients.map(c=>({value:c.id,label:c.name,search:c.phone,description:c.phone}));
 const isCustom=Boolean(draft.customTerm)||!checkoutTerms.some(term=>term===draft.term);
 const dueOn=isCreditSaleTerm(draft.term)?creditDueOn(businessDay,draft.term):null;
 const clientReady=Boolean(client&&dueOn);
 const balanceAllowed=balance!==null&&balance>0&&!!client;
 const patch=(value:Partial<typeof draft>)=>{
  useCart.setState(state=>({credit:{...state.credit,...value}}));
  setConfirmed(false);
 };
 async function save(){if(lock.current||!active.current)return;lock.current=true;onWorking(true);setError('');try{
  requireLease(lease);if(!online)throw Error('Reconnect before completing a credit sale. No credit was approved offline.');
  if(lease.organizationId!==organizationId||lease.branchId!==branchId)throw Error('Open your shift for this branch before making a credit sale.');
  let data=useCart.getState().creditAttempt;
  if(!data){
   if(loading||loadError||!checkedAt)throw Error('Refresh saved clients before making a new credit sale.');
   if((await pendingOperations(db)).length||await db.sales.where('status').anyOf(unresolvedStates).count())throw Error('Confirm all saved sales and requests in Sync center before making a credit sale.');
   if(!active.current)return;
   const selection=creditSelectionSchema.parse({clientId:draft.clientId,term:draft.term,officialReference:draft.officialReference});
   if(!client)throw Error('Choose a saved client for this credit sale.');
   if(amount===null||balance===null||amount<0||amount>=total)throw Error('Enter zero or a positive cash amount below the sale total.');
   if(!confirmed||hasCartErrors(cart))throw Error('Check quantities, discounts and the manual invoice due date.');
   cart.items.forEach(item=>validateSellingItem(item,lease.branchId));
   if(confirmedOn.current!==manilaDay()){setConfirmed(false);setBusinessDay(manilaDay());throw Error('The business day changed. Review the updated due date with the client and confirm it again.');}
   data={...ctx,version:2,requestId:cart.attempt(),deviceId:lease.deviceId,cashierId:lease.cashierId,shiftId:lease.shiftId,items:structuredClone(cart.items),total,cashReceived:amount,...selection,expectedDueOn:creditDueOn(confirmedOn.current,draft.term),manualInvoiceConfirmed:true};
   // A held draft must retain the complete original request before submission.
   if(cart.heldDraftId)await db.transaction('rw',db.settings,async()=>{const held=await setting<HeldSale>(db,heldSaleKey(lease));if(!held||held.id!==cart.heldDraftId)throw Error('The held draft changed. Keep this basket and review it.');await db.settings.put({key:heldSaleKey(lease),value:{...held,credit:draft,creditAttempt:data}});});
   if(!active.current)return;
   useCart.setState({creditAttempt:data});
  }
  if(!active.current)return;
  const saved=creditConfirmation(data,clients.find(c=>c.id===data.clientId)?.name);
  await onlineOperation(db,lease.cashierId,'record_credit_sale',data,'requestId');
  if(active.current)await onSaved(saved);
 }catch(e){if(active.current){setError(e instanceof Error?e.message:'Could not confirm the original credit sale. Keep this PC and check Sync center.');if(isDatabaseRejection(e))useCart.setState({creditAttempt:undefined});}}finally{lock.current=false;onWorking(false);}}
 return <form className="payment-form credit-checkout" aria-label="Credit checkout" onSubmit={e=>{e.preventDefault();void save();}}>
  {!online&&<p className="notice">Reconnect to load saved clients and complete a credit sale.</p>}
  {cart.creditAttempt?<p className="notice">An original credit sale needs confirmation. Retry this request or check Sync center before changing the basket.</p>:<>
   <fieldset disabled={disabled||loading||!online}>
    <legend className="sr-only">Client and payment terms</legend>
    <div className="credit-client-tools">
     <span id={searchLabel}>Search Client Name</span>
     <SearchSelect labelledBy={searchLabel} value={draft.clientId} options={clientOptions} onChange={clientId=>patch({clientId})}
      placeholder="Name or Phone Number" required maxLength={180} disabled={disabled||loading||!online}
      matchesQuery={(option,query)=>matchesCreditClient({name:option.label,phone:option.search??''},query)}/>
    </div>
    {client&&<div className="credit-client-summary" aria-live="polite">
     <strong>Selected: {client.name}</strong>
     <p>Outstanding {money(clientCreditValue(client,'outstanding'))}{client.overdue>0&&<> · Overdue {money(clientCreditValue(client,'overdue'))}</>}</p>
     {client.overdue>0&&<p className="notice">This client has overdue utang. Review it with the client before completing another credit sale.</p>}
     {(client.unconfirmedInvoices??0)>0&&<p className="notice">{client.unconfirmedInvoices} historical {client.unconfirmedInvoices===1?'invoice has an unconfirmed due date':'invoices have unconfirmed due dates'}.</p>}
    </div>}
    <fieldset className="credit-term-choices" disabled={!client}>
     <legend>Payment term</legend>
     <div className="credit-term-options">
      {checkoutTerms.map(days=><label key={days} className={!isCustom&&draft.term===days?'selected-term':''}>
       <input type="radio" name={termName} checked={!isCustom&&draft.term===days} onChange={()=>patch({term:days,customTerm:false})}/>{days} days
      </label>)}
      <div className={isCustom?'credit-custom-term selected-term':'credit-custom-term'}>
       <label><input type="radio" name={termName} checked={isCustom} onChange={()=>{patch({term:0,customTerm:true});customDays.current?.focus();}}/>Others</label>
       <input ref={customDays} type="text" inputMode="numeric" pattern="[0-9]{1,3}" maxLength={3} aria-label="Custom payment term in days"
        title={'1 to '+maxCreditSaleDays+' calendar days'} placeholder="Days" value={isCustom&&draft.term?draft.term:''} required={isCustom}
        aria-invalid={isCustom&&draft.term!==0&&!dueOn}
        onChange={e=>{if(/^[0-9]{0,3}$/.test(e.target.value))patch({term:Number(e.target.value),customTerm:true});}}/>
      </div>
     </div>
    </fieldset>
    <p className="credit-due-date"><span>Due date</span><strong>{client&&dueOn?'Due '+dueOn:isCustom?'Enter 1–365 days':'—'}</strong><small>Asia/Manila</small></p>
    <label className="field credit-cash-field"><span>Cash paid now (₱)</span><input type="text" inputMode="decimal" maxLength={17} value={draft.cash} onChange={e=>patch({cash:e.target.value})} placeholder="0.00"/></label>
    <label className="field credit-invoice-field"><span>Official booklet invoice number</span><input required minLength={3} maxLength={100} value={draft.officialReference} onChange={e=>patch({officialReference:e.target.value})} placeholder="Series and invoice number"/></label>
    <label className="checkbox"><input required type="checkbox" checked={confirmed} disabled={!clientReady} onChange={e=>{
     const day=manilaDay();
     if(day!==businessDay){dayRef.current=day;setBusinessDay(day);confirmedOn.current=undefined;setConfirmed(false);return;}
     confirmedOn.current=e.target.checked?businessDay:undefined;
     setConfirmed(e.target.checked);
    }}/>I issued the official booklet invoice and the client accepted the due date.</label>
   </fieldset>
   {loading&&<p className="scope-note" role="status">Loading saved clients.</p>}
   {loadError&&<div className="notice error" role="alert"><p>Could not load saved clients: {loadError}</p><Button type="button" variant="outline" disabled={disabled||loading||!online} onClick={()=>setRefresh(n=>n+1)}>Refresh clients</Button></div>}
   {!loading&&!loadError&&online&&checkedAt&&clients.length===0&&<p>No saved clients for this branch. Add a client in Customers &amp; credit, then <button type="button" className="record-link" onClick={()=>setRefresh(n=>n+1)}>refresh the list</button>.</p>}
  </>}
  {discountTotal>0&&<div className="subtotal discount-total"><span>Product discounts included</span><strong>-{money(discountTotal)}</strong></div>}
  <div className="change"><span>New credit balance{balance!==null&&balance>=0&&checkedTotal!==null&&amount!==null&&<small>{money(total)} − {money(amount)}</small>}</span><strong>{balance===null||checkedTotal===null?'Check cash amount':balance<0?'Cash exceeds sale total':money(balance)}</strong></div>
  {error&&<div className="notice error action-alert" role="alert">
    <span>{error}</span>
    <button type="button" aria-label="Dismiss checkout error" onClick={()=>setError("")}><X size={16} aria-hidden="true"/></button>
  </div>}
  <Button type="submit" className="complete-sale" disabled={disabled||!online||!lease||!cart.items.length||(!cart.creditAttempt&&(!clientReady||!balanceAllowed||loading||!!loadError||!checkedAt||!confirmed||hasCartErrors(cart)||amount===null||amount<0||amount>=total))}>{cart.creditAttempt?'Confirm original credit sale':'Complete credit sale'}</Button>
  {!lease&&<p className="muted">Open your cashier shift to complete a credit sale.</p>}
 </form>;
}
