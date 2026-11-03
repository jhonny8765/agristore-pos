import type {CreditClient} from '@agristore/domain';
const fold=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en-PH').trim();
const phones=(value:string)=>{const n=value.replace(/\D/g,'');return [n,n.startsWith('63')?'0'+n.slice(2):n.startsWith('0')?'63'+n.slice(1):n];};
export function matchesCreditClient(client:Pick<CreditClient,'name'|'phone'>,query:string):boolean{
 const words=fold(query).split(/\s+/).filter(Boolean);
 if(!words.length||words.every(word=>fold(client.name).includes(word)))return true;
 return /^[\d\s()+.\-]+$/.test(query)&&phones(query).some(q=>q.length>0&&phones(client.phone).some(p=>p.includes(q)));
}
