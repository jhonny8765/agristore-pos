"use client";
import {useState} from 'react';
import Decimal from 'decimal.js';
import type {Product} from '@agristore/domain';
import {SearchableSelect} from "./search-select";
import {Button} from './ui/button';

export function ImportedProductReview({products,disabled,onSave}:{products:Product[];disabled:boolean;onSave:(data:Record<string,unknown>)=>Promise<void>}){
 const pending=products.filter(p=>p.active&&p.catalogSource&&(p.pricePending||p.setupPending||p.costPending));
 const [selected,setSelected]=useState<string|null>(null);
 const product=pending.find(p=>p.id===selected)??pending[0];
 const [error,setError]=useState('');
 if(!product)return null;
 const selectedValue=selected===null?product.id:selected;
 const canConfirm=selectedValue===product.id;
 return <section className="panel imported-review">
  <h2>Confirm imported products</h2>
  <p>All listed products are saved. Confirm the actual selling unit, current price and purchase cost before adding opening stock. The photos did not include stock counts or costs.</p>
  <label className="field"><span>Product to confirm</span><SearchableSelect aria-label="Imported product to confirm" value={selectedValue} disabled={disabled} onValueChange={value=>{setSelected(value);setError('');}}>{pending.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</SearchableSelect></label>
  <p className="muted">{product.catalogSource}{product.originalCode?` · Original code ${product.originalCode}`:''}</p>
  {product.catalogNote&&<p>{product.catalogNote}</p>}
  <form key={product.id} hidden={!canConfirm} onSubmit={async e=>{
   e.preventDefault();setError('');const f=new FormData(e.currentTarget);
   try{
    if(!canConfirm)throw new Error('Choose a matching product before confirming its setup.');
    const price=new Decimal(String(f.get('price'))).mul(100),cost=new Decimal(String(f.get('cost'))).mul(100);
    if(!price.isInteger()||!cost.isInteger()||!price.gt(0)||cost.lt(0)||price.gt(Number.MAX_SAFE_INTEGER)||cost.gt(Number.MAX_SAFE_INTEGER))throw new Error('Enter a positive price and actual cost, using up to two decimal places.');
    await onSave({productId:product.id,baseUnit:f.get('baseUnit'),unitName:f.get('unitName'),factor:f.get('factor'),price:price.toNumber(),cost:cost.toNumber()});setSelected(null);
   }catch(e){setError(e instanceof Error?e.message:'Could not confirm this product.');}
  }}>
   <fieldset disabled={disabled} className="imported-fields"><legend>Selling setup</legend>
    <label className="field"><span>Stock measurement</span><select name="baseUnit" defaultValue={product.setupPending?'':product.baseUnit} required><option value="" disabled>Choose measurement</option><option value="piece">Whole sealed item / piece</option><option value="kg">Kilograms</option><option value="liter">Liters</option><option value="meter">Meters</option></select></label>
    <label className="field"><span>Selling unit name</span><input name="unitName" maxLength={40} defaultValue={product.setupPending?'':product.units[0]?.name} placeholder="Bottle, Packet, Kilo or Sack" required/></label>
    <label className="field"><span>Stock units per selling unit</span><input name="factor" type="number" min="0.000001" step="0.000001" defaultValue={product.setupPending?'':product.units[0]?.factor} required/></label>
    <label className="field"><span>Current selling price (₱)</span><input name="price" type="number" min="0.01" step="0.01" defaultValue={product.pricePending?'':(product.units[0]?.price??0)/100} required/></label>
    <label className="field"><span>Actual cost per selling unit (₱)</span><input name="cost" type="number" min="0" step="0.01" required/></label>
   </fieldset>
   {error&&<p role="alert">{error}</p>}
   <Button disabled={disabled||!canConfirm}>Confirm this product</Button>
  </form>
 </section>;
}
