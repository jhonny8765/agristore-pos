import {describe,expect,it} from "vitest";
import type {Product} from "@agristore/domain";
import {productMetadataRequest, type ProductMetadataDraft} from "../../apps/web/lib/product-metadata-edit";

const product={
  id:"9d5fa3b9-7b87-40bf-b5f9-74e8d6f3a918",
  name:"Original Farm Feed",
  sku:"FEED-100",
  category:"Feeds",
  baseUnit:"kg",
  minimumStock:"5.5",
} as Product;
const draft:ProductMetadataDraft={
  name:" Premium Farm Feed ",
  sku:" FEED-101 ",
  category:" Animal Care ",
  minimumStock:"8.50",
  reason:"Corrected after checking the supplier label",
  confirmed:true,
};
describe("owner product metadata correction",()=>{
  it("normalizes metadata and includes concurrency checks for existing values",()=>{
    expect(productMetadataRequest(product,draft)).toEqual({
      productId:product.id,
      expectedName:"Original Farm Feed",
      expectedSku:"FEED-100",
      expectedCategory:"Feeds",
      expectedMinimumStock:"5.5",
      name:"Premium Farm Feed",
      sku:"FEED-101",
      category:"Animal Care",
      minimumStock:"8.5",
      reason:"Corrected after checking the supplier label",
      confirmed:true,
    });
  });
  it("requires confirmation and an audit reason",()=>{
    expect(()=>productMetadataRequest(product,{...draft,confirmed:false})).toThrow(/confirm/i);
    expect(()=>productMetadataRequest(product,{...draft,reason:"no"})).toThrow(/reason/i);
  });
  it("rejects unchanged values so an audit event always represents a correction",()=>{
    expect(()=>productMetadataRequest(product,{
      ...draft,name:product.name,sku:product.sku,category:product.category,minimumStock:"5.500",
    })).toThrow(/no product details changed/i);
  });
  it("rejects blank, overlong and control-character labels",()=>{
    expect(()=>productMetadataRequest(product,{...draft,name:" " })).toThrow(/product name/i);
    expect(()=>productMetadataRequest(product,{...draft,sku:"x".repeat(81)})).toThrow(/SKU/i);
    expect(()=>productMetadataRequest(product,{...draft,category:"A\nB"})).toThrow(/category/i);
  });
  it("validates low-stock thresholds exactly",()=>{
    expect(()=>productMetadataRequest(product,{...draft,minimumStock:"-1"})).toThrow(/non-negative/i);
    expect(()=>productMetadataRequest(product,{...draft,minimumStock:"1.1234567"})).toThrow(/decimal/i);
    expect(()=>productMetadataRequest(product,{...draft,minimumStock:"Infinity"})).toThrow(/non-negative/i);
    expect(()=>productMetadataRequest({...product,baseUnit:"piece"} as Product,{...draft,minimumStock:"2.5"})).toThrow(/whole-number/i);
  });
});
