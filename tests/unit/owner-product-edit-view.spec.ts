import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
import type {Product} from "@agristore/domain";
import {ImportedProductReview} from "../../apps/web/components/imported-product-review";

const product={
  id:"1fba234c-f9f2-4d30-a5b0-115bfc616e99",active:true,
  name:"Farm Feed",sku:"FEED-1",category:"Feeds",
  baseUnit:"kg",minimumStock:"5",setupPending:false,
  pricePending:false,costPending:false,batches:[],
  units:[{id:"unit-1",name:"Bag",price:10000,cost:7500,factor:"25",priceVersion:1}],
} as Product;
const options={
  products:[product],disabled:false,organizationId:"org-1",branchId:"branch-1",
  onSave:vi.fn(async()=>undefined),initialProductId:product.id,showCatalog:true,
};
describe("owner's selected product edit view",()=>{
  it("shows metadata and existing price editing in the same owner view",()=>{
    const html=renderToStaticMarkup(createElement(ImportedProductReview,options));
    expect(html).toContain("Edit products");
    expect(html).toContain("Edit product details");
    expect(html).toContain("Product name");
    expect(html).toContain("SKU / barcode");
    expect(html).toContain("Low-stock alert");
    expect(html).toContain("Update selling price or cost");
    expect(html).toContain("Save product details");
    expect(html).toContain("Save price / cost version");
  });
  it("keeps details editing out of the review-only flow",()=>{
    const html=renderToStaticMarkup(createElement(ImportedProductReview,{
      ...options,showCatalog:false,
    }));
    expect(html).not.toContain("Save product details");
    expect(html).toContain("Needs review");
  });
});
