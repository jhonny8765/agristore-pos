"use client";
import {useEffect,useRef,useState} from 'react';
import {unresolvedStates,type LocalSale,type PosDatabase} from '@agristore/offline';
import {supabase} from '../lib/api';
import {ownFinancialOriginals,pendingOperations,retryFinancialOriginal,recoverSavedCashOriginal,type PendingOperation} from '../lib/operations';
import {Button} from './ui/button';

/** This entry never restores a business session or downloads branch records. */
export function FinancialOriginalRecovery({db,online,disabled=false}:{db:PosDatabase;online:boolean;disabled?:boolean}){
 const [actor,setActor]=useState(''),[originals,setOriginals]=useState<PendingOperation[]>([]),[sales,setSales]=useState<LocalSale[]>([]),[error,setError]=useState(''),[working,setWorking]=useState(false),[revision,setRevision]=useState(0);
 const busy=useRef(false);
 useEffect(()=>{let active=true;setActor('');setOriginals([]);setSales([]);if(!online)return;
  void (async()=>{const {data,error}=await supabase.auth.getUser();if(error||!data.user)return;const [saved,localSales]=await Promise.all([pendingOperations(db),db.sales.where('status').anyOf(unresolvedStates).toArray()]);if(active){setActor(data.user.id);setOriginals(ownFinancialOriginals(saved,data.user.id));setSales(localSales.filter(s=>!s.allocation&&s.payload.cashierId===data.user!.id));}})().catch(()=>{});
  return()=>{active=false;};
 },[db,online,revision]);
 if(!online||!actor||(!originals.length&&!sales.length))return null;
 async function retry(op:PendingOperation){if(busy.current)return;busy.current=true;setWorking(true);setError('');try{
  const {data,error}=await supabase.auth.getUser();if(error||data.user?.id!==actor)throw Error('Sign in again as the employee who saved this original.');
  await retryFinancialOriginal(db,actor,op);setRevision(value=>value+1);
 }catch(e){setError(e instanceof Error?e.message:'The original remains saved.');}finally{busy.current=false;setWorking(false);}}
 async function retrySale(sale:LocalSale){if(busy.current)return;busy.current=true;setWorking(true);setError('');try{
  const {data,error}=await supabase.auth.getUser();if(error||data.user?.id!==actor)throw Error('Sign in again as the cashier who saved this sale.');
  await recoverSavedCashOriginal(db,actor,sale.id);setRevision(value=>value+1);
 }catch(e){setError(e instanceof Error?e.message:'The original sale remains saved.');}finally{busy.current=false;setWorking(false);}}
 return <details className="panel" aria-label="Saved financial originals"><summary>Confirm your saved financial or price requests</summary><p>Only an exact previously committed request can be confirmed here. Your store access and cashier branch remain unchanged.</p>{error&&<p role="alert">{error}</p>}
  {sales.map(sale=><div key={sale.id}><p>Cash sale {sale.id} · Branch {sale.payload.branchId}{sale.receipt?' · Original receipt confirmed; stock snapshot still needs reconciliation':''}</p><Button variant="outline" disabled={disabled||working} onClick={()=>void retrySale(sale)}>Check original cash sale</Button></div>)}
  {originals.map(op=><div key={op.key}><p>{op.action.replaceAll('_',' ')} · {op.action==='publish_branch_unit_price'?'Target branch':op.action==='copy_branch_unit_prices'?'Source branch':'Branch'} {String(op.data.branchId)}{Array.isArray(op.data.copies)?` · Target branches: ${[...new Set((op.data.copies as {branchId:string}[]).map(item=>item.branchId))].join(', ')}`:''}</p><Button variant="outline" disabled={disabled||working} onClick={()=>void retry(op)}>Check original confirmation</Button></div>)}
 </details>;
}
