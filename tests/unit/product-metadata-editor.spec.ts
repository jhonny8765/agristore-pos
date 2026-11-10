import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
import type {Product} from "@agristore/domain";
import {ProductMetadataEditor} from "../../apps/web/components/product-metadata-editor";

const product={
  id:"product-1",name:"Farm Fertilizer",sku:"FERT-1",category:"Fertilizers",
  minimumStock:"10",baseUnit:"kg",
} as Product;

describe("owner product details editor",()=>{
  it("exposes every editable field, safeguards and touch-friendly action",()=>{
    const html=renderToStaticMarkup(createElement(ProductMetadataEditor,{
      product,disabled:false,onSave:vi.fn(),
    }));
    for(const expected of ["Edit product details","Product name","SKU / barcode","Category",
      "Low-stock alert (kg)","Reason for correction","Save product details","Reset changes",
      "Farm Fertilizer","FERT-1","historical records stay intact"]){
      expect(html).toContain(expected);
    }
    expect(html).toContain("required");
  });
  it("disables edits when the store is offline or busy",()=>{
    const html=renderToStaticMarkup(createElement(ProductMetadataEditor,{
      product,disabled:true,onSave:vi.fn(),
    }));
    expect(html).toContain("fieldset disabled");
    expect(html).toContain("disabled");
  });
});
