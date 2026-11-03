import Decimal from 'decimal.js';
import {creditDueOn,manilaDay} from '@agristore/domain';
export type SupplierTerm=0|30|60|90;
export interface SupplierBill{id:string;supplierId:string;supplierName:string;reference:string;issuedOn:string;term:SupplierTerm;dueOn:string;amount:number;paid:number;credited:number;balance:number;voided:boolean;version:number;description:string;receiptId:string|null;replacesId:string|null;recordedAt:string}
export interface SupplierEntry{id:string;kind:'invoice'|'payment'|'payment_reversal'|'credit_note'|'credit_reversal'|'void';amount:number;method:'bank'|'owner_cash'|'cheque'|null;paidOn:string;reference:string;reason:string;at:string;reverses:string|null;reversedBy:string|null;actorName:string|null}
export interface SupplierBook{asOf:string;suppliers:{id:string;name:string}[];receipts:{id:string;reference:string;supplierId:string}[];invoices:SupplierBill[];next:number|null;matchingTotal:number;outstanding:string;overdue:string;dueSoon:string;paidCount:number}
export interface SupplierHistory{invoice:SupplierBill;entries:SupplierEntry[];next:number|null;receipt:{id:string;reference:string;recordedAt:string;items:unknown[]}|null}
export const supplierEntryLabels:Record<SupplierEntry['kind'],string>={invoice:'Invoice recorded',payment:'Payment made',payment_reversal:'Payment reversed',credit_note:'Supplier credit note',credit_reversal:'Credit note reversed',void:'Invoice voided'};
export const supplierMethods={bank:'Bank transfer',owner_cash:'Owner cash / outside till',cheque:'Cleared cheque'};
export function supplierCents(input:string){if(!/^\d+(\.\d{1,2})?$/.test(input))throw Error('Enter an amount with up to two decimal places.');const value=new Decimal(input).mul(100);if(!value.isInteger()||value.lte(0)||value.gt(Number.MAX_SAFE_INTEGER))throw Error('Enter a positive amount within the supported range.');return value.toNumber();}
export function supplierAmountInput(centavos:number){return new Decimal(centavos).div(100).toFixed(2);}
export function supplierMoney(centavos:string|number){const value=BigInt(centavos),absolute=value<0n?-value:value;return `${value<0n?'-':''}₱${new Intl.NumberFormat('en-PH').format(absolute/100n)}.${String(absolute%100n).padStart(2,'0')}`;}
export function supplierDueOn(issued:string,term:SupplierTerm){if(term===0){creditDueOn(issued,30);return issued;}return creditDueOn(issued,term);}
export function supplierStatus(b:SupplierBill,today=manilaDay()){if(b.voided)return 'Voided';if(b.balance===0)return b.credited>0?'Settled with credit':'Paid';if(b.dueOn<today)return 'Overdue';return b.paid>0?'Partly paid':'Unpaid / May utang';}
export function supplierReminder(b:SupplierBill,today=manilaDay()){if(b.voided||b.balance===0)return '';const days=Math.round((Date.parse(b.dueOn+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);return days<0?`${-days} day${days===-1?'':'s'} overdue`:days===0?'Due today':`Due in ${days} day${days===1?'':'s'}`;}
