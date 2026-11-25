"use client";
import {useEffect,useRef,useState} from 'react';
import {manilaDay} from '@agristore/domain';
import {command} from '../lib/api';
import {maxSupplierTerm,supplierCents,supplierDueOn,supplierMoney,supplierTermOptions,type SupplierBook} from '../lib/supplier-accounts';
import {Button} from './ui/button';

export function purchaseInvoice(f:FormData){
 if(f.get('attachSupplierBill')!=='on')return null;
 if(f.get('supplierInvoiceMode')==='existing'){
  const billId=String(f.get('existingSupplierBill')??'');if(!billId)throw Error('Choose the supplier bill already recorded.');return {mode:'existing',billId};
 }
 const amount=supplierCents(String(f.get('supplierInvoiceAmount')??'')),paymentMode=String(f.get('supplierPaymentMode'));
 const termChoice=f.get('supplierCreditTerm');
 const term=paymentMode==='cash'?0:Number(termChoice==='other'?f.get('supplierCustomTerm'):termChoice);
 if(paymentMode!=='cash'&&(paymentMode!=='credit'||!Number.isInteger(term)||term<1||term>maxSupplierTerm))throw Error(`Enter a credit term from 1 to ${maxSupplierTerm} days.`);
 const paidRaw=String(f.get('supplierPaidAmount')??'').trim(),paidAmount=paymentMode==='cash'?amount:(!paidRaw||/^0(?:\.0{1,2})?$/.test(paidRaw)?0:supplierCents(paidRaw));
 if(paidAmount>amount)throw Error('Amount already paid cannot exceed the supplier invoice.');
 const issuedOn=String(f.get('supplierIssuedOn'));
 return {mode:'new',requestId:crypto.randomUUID(),paymentId:paidAmount?crypto.randomUUID():null,reference:String(f.get('supplierInvoiceReference')).trim(),issuedOn,term,expectedDueOn:supplierDueOn(issuedOn,term),amount,paymentMode,paidAmount,paidOn:String(f.get('supplierPaidOn')),paymentReference:String(f.get('supplierPaymentReference')).trim(),reason:String(f.get('supplierInvoiceReason')).trim(),confirmed:f.get('supplierInvoiceConfirmed')==='on',paymentConfirmed:f.get('supplierPaymentConfirmed')==='on'};
}

export function SupplierPurchaseFields({organizationId,branchId,supplierId,disabled=false,quickReceipt=false}:{organizationId:string;branchId:string;supplierId:string;disabled?:boolean;quickReceipt?:boolean}){
 const [attached,setAttached]=useState(quickReceipt),[mode,setMode]=useState('new'),[payment,setPayment]=useState('credit'),[paid,setPaid]=useState(''),[book,setBook]=useState<SupplierBook>(),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [term,setTerm]=useState('30');
 const scope=organizationId+':'+branchId+':'+supplierId;const currentScope=useRef(scope);currentScope.current=scope;
 const today=manilaDay(),hasPayment=payment==='cash'||(!!paid.trim()&&!/^0(?:\.0{1,2})?$/.test(paid.trim()));
 useEffect(()=>{setBook(undefined);setError('');if(!attached||mode!=='existing'||!supplierId)return;let active=true;setLoading(true);void command<SupplierBook>('supplier_account_book',{openingBalancesSupported:true,organizationId,branchId,supplierId,status:'all',term:'all',query:''}).then(b=>{if(active)setBook(b);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[organizationId,branchId,supplierId,attached,mode]);
 async function more(){if(!book||book.next==null)return;const started=scope;const previous=book;setLoading(true);try{const next=await command<SupplierBook>('supplier_account_book',{openingBalancesSupported:true,organizationId,branchId,supplierId,status:'all',term:'all',query:'',offset:book.next});setBook(current=>current===previous?{...next,invoices:[...previous.invoices,...next.invoices]}:current);}catch(e){if(started===currentScope.current)setError(e instanceof Error?e.message:'Could not load supplier bills.');}finally{if(started===currentScope.current)setLoading(false);}}
 return <fieldset className="supplier-purchase-fields" disabled={disabled}><legend>Supplier bill &amp; payment</legend><label className="checkbox"><input type="checkbox" name="attachSupplierBill" checked={attached} onChange={e=>setAttached(e.target.checked)}/>Save with supplier bill</label>
 {quickReceipt&&(!attached||mode==='existing')&&<DeliveryReference/>}
 {attached&&<>
 <label className="field"><span>Supplier invoice entry</span><select name="supplierInvoiceMode" value={mode} onChange={e=>setMode(e.target.value)}><option value="new">New invoice from supplier</option><option value="existing">More goods for an invoice already recorded</option></select></label>
 {!supplierId&&<p role="alert">Choose the delivery supplier first.</p>}
 {mode==='existing'?<><label className="field"><span>Existing supplier bill</span><select name="existingSupplierBill" required key={supplierId} defaultValue=""><option value="">Choose the original invoice</option>{book?.invoices.filter(b=>!b.voided&&b.source!=='opening'&&b.supplierId===supplierId).map(b=><option value={b.id} key={b.id}>{b.reference} · {supplierMoney(b.amount)} · {b.balance===0?'Paid':`${supplierMoney(b.balance)} owed`}</option>)}</select></label><p>Links this delivery to an existing bill without recording another invoice or payment.</p>{book?.next!=null&&<Button type="button" variant="outline" disabled={loading} onClick={()=>void more()}>Load older supplier bills</Button>}{loading&&<p role="status">Loading supplier bills…</p>}{error&&<p role="alert">{error}</p>}</>:<>
 <div className="form-grid"><label className="field"><span>Supplier invoice number</span><input name="supplierInvoiceReference" required maxLength={150}/></label><label className="field"><span>Supplier invoice date</span><input name="supplierIssuedOn" type="date" required max={today} defaultValue={today}/></label><label className="field"><span>Actual invoice amount (₱)</span><input name="supplierInvoiceAmount" inputMode="decimal" required/></label><label className="field"><span>Supplier payment terms</span><select name="supplierPaymentMode" value={payment} onChange={e=>setPayment(e.target.value)}><option value="credit">Credit · pay later</option><option value="cash">Cash · already paid in full</option></select></label>{payment==='credit'&&<><label className="field"><span>Agreed supplier credit term</span><select name="supplierCreditTerm" value={term} onChange={e=>setTerm(e.target.value)}>{supplierTermOptions.map(n=><option key={n} value={n}>{n} days</option>)}<option value="other">Other</option></select></label>{term==='other'&&<label className="field"><span>Custom number of days</span><input name="supplierCustomTerm" type="number" min={1} max={maxSupplierTerm} step={1} required/></label>}<label className="field"><span>Amount already paid (₱, optional)</span><input name="supplierPaidAmount" inputMode="decimal" value={paid} onChange={e=>setPaid(e.target.value)} placeholder="0.00"/></label></>}</div>
 <label className="field"><span>Supplier bill evidence / goods purchased</span><textarea name="supplierInvoiceReason" required minLength={3} maxLength={2000}/></label><label className="checkbox"><input type="checkbox" name="supplierInvoiceConfirmed" required/>I checked the original supplier invoice, amount and agreed terms.</label>
 {hasPayment&&<><p>Records owner/business cash already paid outside the sales drawer.</p><div className="form-grid"><label className="field"><span>Actual supplier payment date</span><input name="supplierPaidOn" type="date" required max={today} defaultValue={today}/></label><label className="field"><span>Supplier payment reference</span><input name="supplierPaymentReference" required maxLength={150}/></label></div><label className="checkbox"><input type="checkbox" name="supplierPaymentConfirmed" required/>This payment was already made from owner/business cash outside the sales drawer.</label></>}
 </>}
 </>}</fieldset>;
}

export function DeliveryReference(){
 return <label className="field"><span>Delivery reference</span><input name="reference" required maxLength={200}/></label>;
}
