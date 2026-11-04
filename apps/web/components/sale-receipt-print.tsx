"use client";

import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal,flushSync} from 'react-dom';
import {lineAmounts,money,type SaleItem} from '@agristore/domain';

export interface SaleReceiptPrintProps {
 id:string;
 receipt?:string;
 occurredAt:string;
 branchName:string;
 items:SaleItem[];
 total:number;
 cashReceived:number;
 practice:boolean;
 paymentMode?:'cash'|'credit';
 copy?:boolean;
 statusLabel?:string;
 credit?:{clientName:string;officialReference:string;issuedOn:string;dueOn:string;term:number};
}

/** Separate from the till layout so print never includes its controls or columns.
 * The paper height follows the rendered receipt; no fixed-height blank roll page.
 * This view reads the original sale and never changes a financial record. */
export function SaleReceiptPrint({id,receipt,occurredAt,branchName,items,total,cashReceived,practice,paymentMode='cash',copy=false,statusLabel,credit}:SaleReceiptPrintProps){
 const paper=useRef<HTMLDivElement>(null),[height,setHeight]=useState(200),[printing,setPrinting]=useState(false);
 useLayoutEffect(()=>{
  const before=()=>flushSync(()=>setPrinting(true)),after=()=>setPrinting(false);
  window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);
  return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after);};
 },[]);
 useLayoutEffect(()=>{
  const element=paper.current;if(!element)return;
  const measure=()=>setHeight(Math.max(60,Math.ceil(element.getBoundingClientRect().height*25.4/96)+11));
  measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[printing,id,receipt,occurredAt,branchName,items,total,cashReceived,practice,paymentMode,copy,statusLabel,credit]);
 if(!printing||typeof document==='undefined')return null;
 const discount=items.reduce((sum,item)=>sum+BigInt(lineAmounts(item).discount),0n);
 const date=credit?`Invoice date: ${credit.issuedOn} · Asia/Manila`:new Date(occurredAt).toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 return createPortal(<div ref={paper} className="thermal-receipt" data-paper-mm="58" data-receipt-id={id} aria-hidden="true">
  <style>{`@media print{@page better-yield-receipt{size:58mm ${height}mm;margin:5mm}}`}</style>
  <div className="thermal-header">
   <strong className="thermal-brand">Better Yield</strong>
   <div>Agri Trading and Services</div>
   <div>{branchName}</div>
   <strong className="thermal-title">{paymentMode==='credit'?'CREDIT SALE RECORD':'SALES RECEIPT'}{copy?' · COPY':''}</strong>
   {practice&&<strong className="thermal-practice">PRACTICE ONLY · NO REAL SALE</strong>}
  </div>
  <div className="thermal-reference">
   {receipt&&<div>Receipt: <strong>{receipt}</strong></div>}
   {copy&&statusLabel&&<div>Original sale · {statusLabel}</div>}
   <div>{date}</div>
   {credit&&<><div>Customer: <strong>{credit.clientName}</strong></div><div>Official booklet invoice: <strong>{credit.officialReference}</strong></div></>}
   <div className="thermal-id">Transaction: {id}</div>
  </div>
  <div className="thermal-items">
   {items.map((item,index)=><div className="thermal-line" key={index}>
    <strong className="thermal-product">{item.name}</strong>
    <div className="thermal-line-amount"><span>{item.quantity} {item.unitName} × {money(item.unitPrice)}</span><strong>{money(item.lineTotal)}</strong></div>
    {lineAmounts(item).discount>0&&<div className="thermal-discount"><span>{item.discountAmount!==undefined?'Line discount':`${item.discountBps!/100}% discount`}</span><span>−{money(lineAmounts(item).discount)}</span></div>}
   </div>)}
  </div>
  <dl className="thermal-totals">
   {discount>0&&<><div><dt>Subtotal</dt><dd>{money(BigInt(total)+discount)}</dd></div><div><dt>Discounts</dt><dd>−{money(discount)}</dd></div></>}
   <div className="thermal-total"><dt>TOTAL</dt><dd>{money(total)}</dd></div>
   <div><dt>{paymentMode==='credit'?'Cash paid':'Cash received'}</dt><dd>{money(cashReceived)}</dd></div>
   <div><dt>{paymentMode==='credit'?'Balance on credit':'Change'}</dt><dd>{money(paymentMode==='credit'?total-cashReceived:cashReceived-total)}</dd></div>
   {credit&&<><div><dt>Due date</dt><dd>{credit.dueOn}</dd></div><div><dt>Payment term</dt><dd>{credit.term} calendar days</dd></div></>}
  </dl>
  <div className="thermal-footer"><strong>Thank you for shopping with us!</strong><p>Store sale record · Not a tax invoice.</p>{credit&&<p>Balance from this checkout. Later payments appear in customer accounts.</p>}<p>Please refer to your official VAT invoice from the authorized booklet.</p></div>
 </div>,document.body);
}
