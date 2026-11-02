import type {Sale} from '@agristore/domain';
export type ReceiptStatus='completed'|'partial'|'refunded'|'corrected'|'review'|'local';
export interface ReceiptView {id:string;receipt:string;occurredAt:string;total:number;cashReceived:number;status:ReceiptStatus;payload?:Sale;original:Record<string,unknown>}
export const receiptStatus:Record<ReceiptStatus,string>={completed:'Completed',partial:'Partially refunded',refunded:'Refunded',corrected:'Refund corrected',review:'Needs review',local:'Saved on this PC'};
export function inReceiptPeriod(date:string,period:string,now=Date.now()) {
 if(period==='all')return true;
 const offset=8*3600000,today=new Date(now+offset),day=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate());
 const start=period==='week'?day-((today.getUTCDay()+6)%7)*86400000:period==='month'?Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1):day;
 const time=Date.parse(date);return Number.isFinite(time)&&time>=start-offset&&time<day+86400000-offset;
}
export function receiptMatches(row:ReceiptView,query:string,period:string,status:string,now=Date.now()) {
 return `${row.receipt} ${row.id}`.toLowerCase().includes(query.trim().toLowerCase())&&inReceiptPeriod(row.occurredAt,period,now)&&(status==='all'||row.status===status);
}
