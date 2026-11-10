"use client";

import {useEffect,useId,useRef,useState} from "react";
import type {Product} from "@agristore/domain";
import {productMetadataRequest} from "../lib/product-metadata-edit";
import {Button} from "./ui/button";

type Draft={name:string;sku:string;category:string;minimumStock:string};
const fromProduct=(p:Product):Draft=>({
  name:p.name,sku:p.sku,category:p.category,minimumStock:String(p.minimumStock),
});

export function ProductMetadataEditor({product,disabled,onSave}:{
  product:Product;disabled:boolean;
  onSave:(action:string,data:Record<string,unknown>)=>Promise<void>;
}) {
  const [draft,setDraft]=useState<Draft>(()=>fromProduct(product));
  const [reason,setReason]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState("");
  const categoryList=useId();
  const locking=useRef(false);
  useEffect(()=>{
    setDraft(fromProduct(product));
    setConfirmed(false);
  },[product.id,product.name,product.sku,product.category,product.minimumStock]);
  function change(key:keyof Draft,value:string){setDraft(prev=>({...prev,[key]:value}));setSaved("");}
  return <section className="owner-product-metadata" aria-label="Edit product details">
    <h4 id="review-product-metadata">Edit product details</h4>
    <p>Update the product name, barcode, category or low-stock alert. The product ID, stock quantities, selling conversions and past transactions are not rewritten.</p>
    {error&&<p className="notice error" role="alert">{error}</p>}
    {saved&&<p className="notice success" role="status">{saved}</p>}
    <form aria-label={`Edit details for ${product.name}`} onSubmit={async e=>{
      e.preventDefault();
      if(locking.current||disabled)return;
      locking.current=true;setWorking(true);setError("");setSaved("");
      try{
        const request=productMetadataRequest(product,{...draft,reason,confirmed});
        await onSave("update_product_metadata",request);
        setReason("");setConfirmed(false);
        setSaved("Product details saved. Refresh or reopen the product if the updated label is not visible yet.");
      }catch(problem){
        setError(problem instanceof Error?problem.message:"Could not update the product. Refresh and try again.");
      }finally{locking.current=false;setWorking(false);}
    }}>
      <fieldset disabled={disabled||working} className="owner-product-metadata-grid">
        <label className="field"><span>Product name</span><input required maxLength={180} value={draft.name} onChange={e=>change("name",e.target.value)}/></label>
        <label className="field"><span>SKU / barcode</span><input required maxLength={80} autoComplete="off" value={draft.sku} onChange={e=>change("sku",e.target.value)}/></label>
        <label className="field"><span>Category</span><input required maxLength={80} list={categoryList} value={draft.category} onChange={e=>change("category",e.target.value)}/><datalist id={categoryList}>{["Feeds","Fertilizers","Seeds","Tools","Soil care","Animal care","Other"].map(value=><option key={value} value={value}/>)}</datalist></label>
        <label className="field"><span>Low-stock alert ({product.baseUnit})</span><input required inputMode="decimal" value={draft.minimumStock} onChange={e=>change("minimumStock",e.target.value)}/></label>
        <label className="field owner-product-metadata-wide"><span>Reason for correction</span><textarea rows={2} required minLength={3} maxLength={1000} placeholder="Example: Corrected barcode from supplier packaging" value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <label className="checkbox owner-product-metadata-wide"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked the product label and barcode. I understand that historical records stay intact, while reports that use the current catalog may show the new product name.</label>
        <div className="owner-product-metadata-wide owner-product-metadata-actions"><Button type="submit" disabled={disabled||working}>{working?"Saving…":"Save product details"}</Button><Button type="button" variant="outline" disabled={working||disabled} onClick={()=>{setDraft(fromProduct(product));setReason("");setConfirmed(false);setError("");setSaved("");}}>Reset changes</Button></div>
      </fieldset>
    </form>
  </section>;
}
