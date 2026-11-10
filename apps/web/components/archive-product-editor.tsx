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
  return <section className="panel owner-product-metadata" aria-label="Remove product from catalog">
    <h4 id="review-product-archive">Remove from active catalog</h4>
    <p>Stop selling a product you no longer carry. This archives its catalog entry; sales history and stock records are preserved. You can only archive it when recorded stock is zero and outstanding stock reviews, holds and transfers are resolved.</p>
    {!expanded?<Button type="button" variant="outline" disabled={disabled} onClick={()=>setExpanded(true)}>Review removal</Button>:<>
      {error&&<p className="notice error" role="alert">{error}</p>}
      <form aria-label={`Archive ${product.name}`} onSubmit={async e=>{
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
          setError(problem instanceof Error?problem.message:"Could not archive this product. Refresh and try again.");
        }finally{locking.current=false;setWorking(false);}
      }}>
        <fieldset disabled={disabled||working}>
          <p><strong>{product.name}</strong> · {product.sku}</p>
          <label className="field"><span>Enter the exact SKU to confirm removal</span><input value={typedSku} onChange={e=>setTypedSku(e.target.value)} required autoComplete="off" placeholder={product.sku}/></label>
          <label className="field"><span>Reason for removal</span><textarea rows={2} minLength={3} maxLength={1000} required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Example: Product discontinued by supplier"/></label>
          <label className="checkbox"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked that the product has no remaining stock or unresolved inventory activity. I understand this will hide it from new sales.</label>
          <div className="owner-product-metadata-actions">
            <Button type="submit" variant="destructive" disabled={!valid||disabled||working}>{working?"Archiving…":"Archive product"}</Button>
            <Button type="button" variant="outline" disabled={working} onClick={()=>{setExpanded(false);setTypedSku("");setReason("");setConfirmed(false);setError("");}}>Cancel</Button>
          </div>
        </fieldset>
      </form>
    </>}
  </section>;
}
