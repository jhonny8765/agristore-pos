import {useBusinessClock} from "./workspace-ui";
import Decimal from 'decimal.js';
import {AlertTriangle,CalendarClock,ClipboardCheck,ChevronRight} from 'lucide-react';
import type {Product} from '@agristore/domain';
import {Button} from './ui/button';
import {stockAwaitingConfirmation} from '../lib/product-review';
export function DashboardAttention({products,stock,pendingCounts,onInventory,onCounts,practice=false,canReview=false}:{practice?:boolean;canReview?:boolean;products:Product[];stock:Map<string,string>;pendingCounts:number;onInventory:(pane:string)=>void;onCounts:()=>void}) {
 const now=useBusinessClock();
 const current=products.filter(p=>p.active),end=new Date(now+30*86400000+8*3600000).toISOString().slice(0,10);
 const low=current.filter(p=>!p.setupPending&&!stockAwaitingConfirmation(p)&&[...stock].filter(([k])=>k.startsWith(`${p.id}:`)).reduce((n,[,v])=>n.plus(v),new Decimal(0)).lte(p.minimumStock)).length;
 const expiry=current.filter(p=>p.batches.some(b=>b.expiresOn&&b.expiresOn<=end&&new Decimal(stock.get(`${p.id}:${b.id}`)??0).gt(0))).length;
 return <aside className="dashboard-attention"><h3>Needs attention</h3>{current.some(stockAwaitingConfirmation)&&<div><AlertTriangle/><section><strong>{current.filter(stockAwaitingConfirmation).length} stock balances awaiting confirmation</strong><small>Source quantities are not yet usable stock.</small><Button variant="ghost" size="sm" onClick={()=>onInventory(canReview?'review':'products')}>Review imported stock<ChevronRight size={16}/></Button></section></div>}<div><AlertTriangle/><section><strong>{low} products at or below minimum</strong><small>From the downloaded catalog and local stock.</small><Button variant="ghost" size="sm" onClick={()=>onInventory('products')}>View inventory<ChevronRight size={16}/></Button></section></div><div><CalendarClock/><section><strong>{expiry} expiry labels to inspect</strong><small>Within 30 days or overdue; saleable stock only.</small><Button variant="ghost" size="sm" onClick={()=>onInventory('expiry')}>View expiry<ChevronRight size={16}/></Button></section></div><div><ClipboardCheck/><section><strong>{pendingCounts} counts awaiting approval</strong><small>{practice?"Practice mode does not submit stock counts.":"Confirmed server summary; refresh to check new work."}</small><Button variant="ghost" size="sm" onClick={onCounts}>Review counts<ChevronRight size={16}/></Button></section></div></aside>;
}
