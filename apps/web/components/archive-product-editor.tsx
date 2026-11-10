"use client";

import {useRef,useState} from "react";
import type {Product} from "@agristore/domain";
import {Button} from "./ui/button";

/** Reversible catalog removal: never delete a product with historical transactions. */
export function ArchiveProductEditor({product,disabled,onSave,onArchived}:{
  product:Product;
  disabled:boolean;
  onSave:(action:string,data:Record<string,unknown>)=>Promise<void>;
  onArchived:()=>void;
}) {
  const [expanded,setExpanded]=useState(false);
  const [typedSku,setTypedSku]=useState("");
  const [reason,setReason]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const locking=useRef(false);
  const valid=typedSku.trim()===product.sku&&reason.trim().length>=3&&confirmed;
  return <section className="owner-product-metadata" aria-label="Hide product from checkout">
    <h4 id="review-product-archive">Hide product</h4>
    <p>Stop selling a product you no longer carry. Find it under Hidden products to restore it later. Recorded stock must be zero, and open stock counts, holds, transfers and purchase orders must be resolved first.</p>
    {!expanded?<Button type="button" variant="outline" disabled={disabled} onClick={()=>setExpanded(true)}>Hide this product</Button>:<>
      {error&&<p className="notice error" role="alert">{error}</p>}
      <form aria-label={`Hide ${product.name}`} onSubmit={async e=>{
        e.preventDefault();
        if(locking.current||disabled||!valid)return;
        locking.current=true;setWorking(true);setError("");
        try{
          await onSave("archive_product",{
            productId:product.id,expectedName:product.name,expectedSku:product.sku,
            typedSku:typedSku.trim(),reason:reason.trim(),confirmed:true,
          });
          onArchived();
        }catch(problem){
          setError(problem instanceof Error?problem.message:"Could not hide this product. Refresh and try again.");
        }finally{locking.current=false;setWorking(false);}
      }}>
        <fieldset disabled={disabled||working}>
          <p><strong>{product.name}</strong> · {product.sku}</p>
          <label className="field"><span>Enter the exact SKU to confirm hiding</span><input value={typedSku} onChange={e=>setTypedSku(e.target.value)} required autoComplete="off" placeholder={product.sku}/></label>
          <label className="field"><span>Reason for hiding</span><textarea rows={2} minLength={3} maxLength={1000} required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Example: Product discontinued by supplier"/></label>
          <label className="checkbox"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked that the product has no remaining stock or unresolved inventory activity. I understand this will hide it from new sales.</label>
          <div className="owner-product-metadata-actions">
            <Button type="submit" variant="destructive" disabled={!valid||disabled||working}>{working?"Hiding…":"Hide product"}</Button>
            <Button type="button" variant="outline" disabled={working} onClick={()=>{setExpanded(false);setTypedSku("");setReason("");setConfirmed(false);setError("");}}>Cancel</Button>
          </div>
        </fieldset>
      </form>
    </>}
  </section>;
}
