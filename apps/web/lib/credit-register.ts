import {creditAging,clientCreditValue,exactCentavos,type CreditClient,type CreditBook,type CreditInvoice} from '@agristore/domain';
export const clientTypes={normal:'Normal customer',distributor:'Distributor',owner:'Owner'};
export function customerType(client:CreditClient){return client.clientType??'normal';}
export type CreditRegister='customers'|'distribution'|'statements';
export function creditRegisterClients(clients:CreditClient[],register:CreditRegister){
 return clients.filter(client=>register==='statements'||(register==='distribution'?customerType(client)==='distributor':customerType(client)!=='distributor'));
}
/** Register totals use every account in the group, independent of search or table pages. */
export function creditRegisterSummary(clients:CreditClient[]){
 return clients.reduce((summary,client)=>{const balance=exactCentavos(clientCreditValue(client,'outstanding'));return {count:summary.count+1,outstanding:summary.outstanding+balance,owing:summary.owing+(balance>0n?1:0),unconfirmed:summary.unconfirmed+(client.unconfirmedInvoices??0)};},{count:0,outstanding:0n,owing:0,unconfirmed:0});
}
export function sortCreditClients(clients:CreditClient[],direction:'ascending'|'descending'='descending'){
 return [...clients].sort((a,b)=>{const order={normal:0,distributor:1,owner:2},group=order[customerType(a)]-order[customerType(b)];if(group)return group;const av=exactCentavos(clientCreditValue(a,'outstanding')),bv=exactCentavos(clientCreditValue(b,'outstanding'));return av===bv?a.name.localeCompare(b.name,'en',{numeric:true})||a.id.localeCompare(b.id):(av>bv?1:-1)*(direction==='ascending'?1:-1);});
}
export type InvoiceFilter='all'|'unpaid'|'partial'|'paid'|'overdue'|'unconfirmed'|'opening';
export function invoiceStatus(i:CreditInvoice){return i.balance===0?(i.credited>0?'Settled with credit':'Paid'):i.paid>0||i.credited>0?'Part paid':'Unpaid';}
export function invoiceMatches(i:CreditInvoice,query:string,status:InvoiceFilter){const match=`${i.officialReference} ${i.reference} ${i.clientName}`.toLocaleLowerCase('en-PH').includes(query.trim().toLocaleLowerCase('en-PH'));return match&&(status==='all'||status==='paid'&&i.balance===0||status==='unpaid'&&i.balance>0&&i.paid===0&&i.credited===0||status==='partial'&&i.balance>0&&(i.paid>0||i.credited>0)||status==='overdue'&&i.balance>0&&!!i.dueOn&&creditAging(i.dueOn,i.balance)!=='notDue'||status==='unconfirmed'&&i.balance>0&&!i.dueOn||status==='opening'&&i.source==='opening');}
export function accountActivity(book:Pick<CreditBook,'invoices'|'entries'>){return [...book.invoices.flatMap(i=>[{id:'invoice:'+i.id,at:i.issuedAt,label:i.source==='opening'?'Opening unpaid balance · source date':'Credit sale recorded',reference:i.officialReference,amount:i.total},...(i.source!=='opening'&&Number.isSafeInteger(i.payload.cashReceived)&&i.payload.cashReceived!>0?[{id:'down:'+i.id,at:i.issuedAt,label:'Cash paid at sale',reference:i.officialReference,amount:i.payload.cashReceived!}]:[])]),...book.entries.map(e=>({id:e.id,at:e.at,label:({collection:'Payment received',collection_reversal:'Payment reversed',credit_note:'Credit note recorded'} as Record<string,string>)[e.kind]??e.kind.replaceAll('_',' '),reference:e.reference,amount:e.amount}))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));}
