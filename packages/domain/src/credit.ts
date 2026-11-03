import {z} from 'zod';

export const creditTerms = [30,60,90] as const;
export type CreditTerm = typeof creditTerms[number];
export interface CreditClient {id:string;name:string;phone:string;address:string;tin:string;enabled:boolean;limit:number;terms:CreditTerm[];version:number;outstanding:number;overdue:number}
export interface CreditInvoice {id:string;clientId:string;clientName:string;reference:string;officialReference:string;issuedAt:string;dueOn:string|null;term:CreditTerm|null;source?:'sale'|'opening';sourceRow?:number;sourceNotes?:string;total:number;paid:number;credited:number;balance:number;payload:{items:{name:string;quantity:string;unitName:string;lineTotal:number}[]};clientSnapshot:{name:string;address:string;tin:string};sellerName:string}
export interface CreditEntry {id:string;invoiceId:string;kind:string;amount:number;cash:number;reference:string;reason:string;at:string;reverses?:string|null}
export interface CreditBook {asOf:string;clients:CreditClient[];invoices:CreditInvoice[];entries:CreditEntry[];next?:number|null;totalInvoices:number;outstanding:number;overdue:number;cashCollected:number;creditSales:number;openingBalances?:number;aging:{unconfirmed?:number;notDue:number;days1to30:number;days31to60:number;days61to90:number;days91plus:number}}
export function manilaDay(now:Date|number=new Date()):string {return new Date(+now+8*3600000).toISOString().slice(0,10);}
export function creditDueOn(issuedOn:string,term:CreditTerm):string {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)||!creditTerms.includes(term))throw Error('Choose a valid issue date and 30, 60 or 90 days.');
 const date=new Date(issuedOn+'T00:00:00Z');if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==issuedOn)throw Error('Choose a real issue date.');
 date.setUTCDate(date.getUTCDate()+term);return date.toISOString().slice(0,10);
}
export function creditAging(dueOn:string|null,balance:number,today=manilaDay()):keyof CreditBook['aging'] {
 if(dueOn===null)return 'unconfirmed';
 const days=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(dueOn+'T00:00:00Z'))/86400000);
 if(!Number.isFinite(days)||!Number.isSafeInteger(balance)||balance<0)throw Error('Invalid credit balance or due date.');
 return days<=0?'notDue':days<=30?'days1to30':days<=60?'days31to60':days<=90?'days61to90':'days91plus';
}
export function creditBalance(total:number,netPaid:number,credited:number):number {
 if(![total,netPaid,credited].every(n=>Number.isSafeInteger(n)&&n>=0)||netPaid+credited>total)throw Error('Credit totals do not reconcile.');
 return total-netPaid-credited;
}
export const creditSelectionSchema=z.object({clientId:z.uuid(),term:z.union([z.literal(30),z.literal(60),z.literal(90)]),officialReference:z.string().trim().min(3).max(100)}).strict();

