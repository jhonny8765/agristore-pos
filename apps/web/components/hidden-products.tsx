"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {command} from '../lib/api';
import {Button} from './ui/button';
import {RecordTable} from './record-pages';

interface HiddenProduct{id:string;name:string;sku:string;hiddenRequestId:string;hiddenAt:string;reason:string}
interface HiddenPage{rows:HiddenProduct[];total:number;next:string|null}
export function HiddenProducts({organizationId,branchId,disabled,onSave,onBack}:{organizationId:string;branchId:string;disabled:boolean;onSave:(action:string,data:Record<string,unknown>)=>Promise<void>;onBack:()=>void}){
 const [page,setPage]=useState<HiddenPage>(),[query,setQuery]=useState(''),[applied,setApplied]=useState(''),[selected,setSelected]=useState<HiddenProduct>();
 const [loading,setLoading]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const generation=useRef(0),lock=useRef(false);
 const load=useCallback(async(afterId?:string)=>{
  const token=++generation.current;setLoading(true);setError('');
  try{const response=await command<HiddenPage>('hidden_products',{organizationId,branchId,query:applied,...(afterId?{afterId}:{})});if(token===generation.current)setPage(old=>({...response,rows:afterId?[...(old?.rows??[]),...response.rows]:response.rows}));}
  catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Could not load hidden products. Reconnect and refresh.');}
  finally{if(token===generation.current)setLoading(false);}
 },[organizationId,branchId,applied]);
 const invalidate=useCallback(()=>{generation.current++;},[]);
 useEffect(()=>{void load();return invalidate;},[load,invalidate]);
 const blocked=disabled||loading||working;
 return <section className="panel hidden-products" aria-label="Hidden products"><Button variant="ghost" onClick={onBack}>Back to products</Button><h2>Hidden products</h2><p>Restore products hidden here. Their original prices, units and history stay attached. Any unresolved selling setup still needs confirmation.</p>
  {error&&<p role="alert" className="notice error">{error}</p>}{message&&<p role="status" className="notice">{message}</p>}
  <form className="register-filters" onSubmit={e=>{e.preventDefault();setSelected(undefined);if(applied===query.trim())void load();else setApplied(query.trim());}}><label className="field"><span>Search hidden products</span><input type="search" maxLength={180} value={query} onChange={e=>setQuery(e.target.value)}/></label><Button variant="outline" disabled={blocked}>Search</Button></form>
  {loading&&<p role="status">Loading hidden products…</p>}
  {page&&<><p>{page.total} hidden products match. Products retired during an inventory import are excluded.</p><div className="table-wrap" role="region" aria-label="Hidden product register" tabIndex={0}><RecordTable><thead><tr><th>Product / SKU</th><th>Hidden on</th><th>Reason</th><th>Action</th></tr></thead><tbody>{page.rows.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.sku}</small></td><td>{new Date(p.hiddenAt).toLocaleDateString('en-PH',{timeZone:'Asia/Manila'})}</td><td>{p.reason}</td><td><Button variant="outline" disabled={blocked} onClick={()=>{setSelected(p);setMessage('');}}>Restore {p.name}</Button></td></tr>)}</tbody></RecordTable></div>{!page.rows.length&&<p>No products have been hidden here.</p>}{page.next&&<Button variant="outline" disabled={blocked} onClick={()=>void load(page.next!)}>Load more hidden products</Button>}</>}
  {selected&&<form className="owner-product-metadata" key={selected.hiddenRequestId} aria-label={`Restore ${selected.name}`} onSubmit={async e=>{
   e.preventDefault();if(lock.current||blocked)return;const f=new FormData(e.currentTarget);lock.current=true;setWorking(true);setError('');
   try{await onSave('restore_product',{productId:selected.id,expectedName:selected.name,expectedSku:selected.sku,hiddenRequestId:selected.hiddenRequestId,reason:String(f.get('reason')).trim(),confirmed:f.get('confirmed')==='on'});setSelected(undefined);setMessage(`${selected.name} restored to the product list.`);await load();}
   catch(e){setError(e instanceof Error?e.message:'Could not restore this product. Refresh and retry.');}finally{lock.current=false;setWorking(false);}
  }}><fieldset disabled={blocked}><legend>Restore {selected.name}</legend><label className="field"><span>Reason for restoring</span><input name="reason" required minLength={3} maxLength={1000}/></label><label className="checkbox"><input name="confirmed" type="checkbox" required/>I checked this product and want it back in the catalog.</label><div className="owner-product-metadata-actions"><Button>{working?'Restoring…':'Restore product'}</Button><Button type="button" variant="outline" onClick={()=>setSelected(undefined)}>Cancel</Button></div></fieldset></form>}
 </section>;
}
