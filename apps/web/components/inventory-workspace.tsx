"use client";
import {useState,type ReactNode} from 'react';
import Decimal from 'decimal.js';
import {AlertTriangle,CalendarClock,Package,Search,Plus,ArrowUpDown,ArrowUp,ArrowDown,Pencil,Ellipsis} from 'lucide-react';
import {money,type Product} from '@agristore/domain';
import {RecordPages,RecordTable} from './record-pages';
import {ProductPhoto} from './product-photo';
import {WorkspaceStat,useBusinessClock} from './workspace-ui';
import {Button} from './ui/button';
import {stockAwaitingConfirmation} from '../lib/product-review';
import {stockCost} from '../lib/stock-display';
import {inventoryQuantities,inventoryState,inventoryStates,orderInventory,type InventorySort} from '../lib/inventory-order';

export function InventoryWorkspace({products,stock,onAdd,onReceive=()=>{},onEdit=()=>{},onCount,onEditCatalog=()=>{},canManage,tabs,section,children}:{tabs:ReactNode;section:string;children?:ReactNode;products:Product[];stock:Map<string,string>;onAdd:()=>void;onReceive?:(product?:Product)=>void;onEdit?:(product:Product)=>void;onCount?:(product:Product)=>void;onEditCatalog?:()=>void;canManage:boolean}) {
 const showProducts=section==='products';
 const now=useBusinessClock();
 const [query,setQuery]=useState(''),[category,setCategory]=useState('all'),[availability,setAvailability]=useState('all');
 const [sort,setSort]=useState<InventorySort>();
 const active=products.filter(p=>p.active);
 const quantities=inventoryQuantities(stock);
 const quantity=(p:Product)=>quantities.get(p.id)??new Decimal(0);
 const state=(p:Product)=>inventoryState(p,quantity(p));
 function sortHeader(key:InventorySort['key'],label:string){const selected=sort?.key===key,direction=selected?sort.direction:'none',Icon=selected?(sort.direction==='ascending'?ArrowUp:ArrowDown):ArrowUpDown;return <th className={key==='quantity'?'numeric':undefined} aria-sort={direction}><button type="button" className="inventory-sort" onClick={()=>setSort({key,direction:selected&&sort.direction==='ascending'?'descending':'ascending'})} title={`Sort ${label.toLowerCase()} ${selected&&sort.direction==='ascending'?'descending':'ascending'}`}><span>{label}</span><Icon size={16} aria-hidden="true"/></button></th>;}
 const today=new Date(now+8*3600000).toISOString().slice(0,10),end=new Date(now+30*86400000+8*3600000).toISOString().slice(0,10);
 const expiry=active.filter(p=>p.batches.some(b=>b.expiresOn&&b.expiresOn<=end&&new Decimal(stock.get(`${p.id}:${b.id}`)??0).gt(0)));
 const filtered=active.filter(p=>`${p.name} ${p.sku} ${'originalCode' in p?p.originalCode:''}`.toLowerCase().includes(query.toLowerCase())&&(category==='all'||p.category===category)&&(availability==='all'||state(p)===availability));
 const rows=sort?orderInventory(filtered,quantities,sort):filtered;
 return <div className="inventory-workspace inventory-compact">
  <div className="workspace-stats three inventory-summary">
    <WorkspaceStat icon={Package} label="Catalog products" value={active.length}/>
    <WorkspaceStat icon={AlertTriangle} label="Low stock" value={active.filter(p=>["low","out"].includes(state(p))).length}/>
    <WorkspaceStat icon={CalendarClock} label="Approaching expiry" value={expiry.length}/>
  </div>
  <div className="inventory-command-bar">
    {tabs}
    {canManage&&<div className="inventory-catalog-actions">
      <Button type="button" size="sm" onClick={onAdd}><Plus size={16} aria-hidden="true"/>Add product</Button>
      <Button type="button" size="sm" variant="outline" onClick={onEditCatalog}><Pencil size={16} aria-hidden="true"/>Edit product</Button>
    </div>}
  </div>
  {showProducts&&
    <div className="register-filters inventory-filters"><label className="field search-field"><span className="sr-only">Search inventory</span><Search size={18}/><input type="search" placeholder="Search product name or SKU" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="field"><span className="sr-only">Inventory category</span><select aria-label="Inventory category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{[...new Set(active.map(p=>p.category))].map(c=><option key={c}>{c}</option>)}</select></label><label className="field"><span className="sr-only">Stock availability</span><select aria-label="Stock availability" value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">All stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="pending">Stock awaiting confirmation</option><option value="unit">Unit needed</option></select></label></div>
  }
  {section!=='counts'&&<div hidden={!showProducts}>
  <section className="panel inventory-register" aria-label="Product inventory">
    {rows.length?<div className="table-wrap" role="region" aria-label="Inventory products" tabIndex={0}><RecordTable paginationPosition="bottom" className={canManage?"owner-inventory-table":undefined} key={`${query}:${category}:${availability}:${sort?.key}:${sort?.direction}`}><thead><tr><th>Product / SKU</th><th>Category</th>{sortHeader('quantity','On hand')}<th>Selling unit</th>{sortHeader('price','Price')}<th>Batch / expiry</th>{sortHeader('status','Status')}</tr></thead><tbody>{rows.map(p=><tr key={p.id}><td data-label="Product"><div className="product-cell"><ProductPhoto product={p}/><div className="inventory-product-identity">{canManage?<button type="button" className="record-link inventory-product-name" aria-label={`Open ${p.name} details and prices`} onClick={()=>onEdit(p)}>{p.name}</button>:<strong>{p.name}</strong>}<small>SKU: {p.sku}</small></div>{canManage&&<details className="inventory-row-tools">
   <summary aria-label={`Stock actions for ${p.name}`}><Ellipsis size={17} aria-hidden="true"/></summary>
   <div>
     <Button type="button" size="sm" variant="outline" disabled={p.setupPending} aria-label={`Add received stock for ${p.name}`} onClick={()=>onReceive(p)}>Add stock</Button>
     {onCount&&!p.setupPending&&<Button type="button" size="sm" variant="outline" aria-label={`Start stock count for ${p.name}`} onClick={()=>onCount(p)}>Count</Button>}
   </div>
 </details>}</div></td><td data-label="Category">{p.category}</td><td className="numeric" data-label="On hand"><strong>{stockAwaitingConfirmation(p)&&(p.setupPending||quantity(p).eq(0))?"Stock not posted":p.setupPending?"Confirm unit":`${quantity(p).toFixed()} ${p.baseUnit}`}</strong>{stockAwaitingConfirmation(p)&&<small>Source: {p.sourceStock?.quantity} source units</small>}</td><td data-label="Selling unit" className={canManage?"inventory-unit-list":undefined}>{p.units.map(u=><div key={u.id}>{("setupPending" in p&&p.setupPending)?"Confirm selling unit":u.name}</div>)}</td><td data-label="Price" className="inventory-price-list">{p.units.map(u=><div key={u.id}><strong>{u.price===null||p.pricePending&&!u.branchId?"Confirm price":money(u.price)}</strong>{canManage&&<small>{stockCost(p,u.cost)}</small>}</div>)}</td><td data-label="Batch / expiry">{p.batches.length?p.batches.map(b=><div key={b.id}>Lot: {b.lot}<small className={b.expiresOn&&b.expiresOn<today?'expiry-overdue':''}>Exp: {b.expiresOn??'Not recorded'}</small></div>):'No batches'}</td><td data-label="Status"><span className={`status-tag ${state(p)==='in'?'good':state(p)==='low'?'warn':''}`}>{inventoryStates[state(p)]}</span></td></tr>)}</tbody></RecordTable></div>:<div className="register-empty"><h3>No matching products</h3><Button variant="outline" onClick={()=>{setQuery('');setCategory('all');setAvailability('all');}}>Clear inventory filters</Button><RecordPages label="Matching products">{[]}</RecordPages></div>}
  </section></div>}
  {children}
 </div>;
}
