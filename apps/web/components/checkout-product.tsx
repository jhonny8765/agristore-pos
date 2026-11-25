"use client";
import Decimal from 'decimal.js';
import {useState} from 'react';
import {Plus} from 'lucide-react';
import {money,type Product} from '@agristore/domain';
import {kiloUnit} from '../lib/quantity-entry';
import {sellingUnitReady} from '../lib/branch-pricing';
import {ProductPhoto} from './product-photo';
export function CheckoutProduct({product:p,available,disabled,unavailable=false,offlineAllowance,onAdd}:{product:Product;available:{quantity:string;unit:string};disabled:boolean;unavailable?:boolean;offlineAllowance?:string;onAdd:(unitId?:string,mode?:'weight'|'budget')=>void}){
 const [selectedUnitId,setSelectedUnitId]=useState(p.units[0]?.id);
 const unit=p.units.find(u=>u.id===selectedUnitId)??p.units[0],kilo=kiloUnit(p),ready=sellingUnitReady(p,unit),looseReady=sellingUnitReady(p,kilo);
 const sealed=unit?.sellingPolicy==='sealed_whole',addLabel=sealed?`Add sealed ${unit.name}`:p.baseUnit==='kg'&&new Decimal(unit?.factor??'1').eq(1)?'Add 1 kg':`Add ${unit?.name??'item'}`;
 return <article className={unavailable?'product product-unavailable':'product'}><ProductPhoto product={p}/><div className="product-art"><span className="product-category">{p.category}</span></div><div className="product-details"><span className="product-sku">{p.sku}</span><h3>{p.name}</h3><span className="unit-label">{unit?.name}</span>
  {p.units.length>1&&<fieldset className="product-unit-picker"><legend>Choose selling unit</legend><div className="product-unit-options">{p.units.map(option=><button key={option.id} type="button" className="product-unit-option" aria-label={`Choose ${option.name} ${sellingUnitReady(p,option)&&option.price!==null?money(option.price):'Price needed'} for ${p.name}`} aria-pressed={option.id===unit?.id} disabled={!sellingUnitReady(p,option)} onClick={()=>setSelectedUnitId(option.id)}><span>{option.name}</span><strong>{sellingUnitReady(p,option)&&option.price!==null?money(option.price):'Price needed'}</strong></button>)}</div></fieldset>}
  <div className="product-footer"><strong>{ready&&unit.price!==null?money(unit.price):'Confirm price'}</strong><button className="add-product" disabled={disabled||!ready} aria-label={`Add ${p.name} — ${addLabel}`} onClick={()=>onAdd(unit?.id)}><Plus size={17}/><span>{addLabel}</span></button></div>
  <span className={new Decimal(available.quantity).lte(0)?'stock-label low':'stock-label'}>{available.quantity} {available.unit} on hand</span>
  {offlineAllowance!==undefined&&<p className="product-offline-allowance"><strong>This PC offline:</strong> {offlineAllowance} {p.baseUnit}</p>}
  {sealed&&<p className="scope-note sealed-pack-note">Check the pack is sealed and intact.</p>}
  {!ready&&<p className="catalog-warning">{p.setupPending?'Confirm selling unit in Inventory.':'Confirm this unit’s branch price in Inventory.'}</p>}
  {kilo&&looseReady&&kilo.price!==null&&<div className="catalog-retail"><div className="product-selling" role="group" aria-label={`Loose selling options for ${p.name}`}><span>{money(kilo.price)} / kg · loose</span><button type="button" disabled={disabled} aria-label={`Sell ${p.name} by weight`} onClick={()=>onAdd(kilo.id,'weight')}>By weight</button><button type="button" disabled={disabled||kilo.price<=0} aria-label={`Sell ${p.name} by peso amount`} onClick={()=>onAdd(kilo.id,'budget')}>By peso amount</button></div></div>}
 </div></article>;
}
