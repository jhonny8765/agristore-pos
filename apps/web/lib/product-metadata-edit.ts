import Decimal from "decimal.js";
import type { Product } from "@agristore/domain";

export interface ProductMetadataDraft {
  name: string;
  sku: string;
  category: string;
  minimumStock: string;
  reason: string;
  confirmed: boolean;
}

const printable = (value: string, label: string, max: number) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || /[\x00-\x1f\x7f]/.test(trimmed))
    throw new Error(`Enter ${label} between 1 and ${max} printable characters.`);
  return trimmed;
};

/** Form validation only; the owner-only SQL command revalidates every field. */
export function productMetadataRequest(product: Product, draft: ProductMetadataDraft) {
  if (!draft.confirmed) throw new Error("Confirm the product correction before saving.");
  const name = printable(draft.name, "a product name", 180);
  const sku = printable(draft.sku, "a SKU or barcode", 80);
  const category = printable(draft.category, "a category", 80);
  const reason = draft.reason.trim();
  if (reason.length < 3 || reason.length > 1000)
    throw new Error("Enter a correction reason between 3 and 1000 characters.");
  if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(draft.minimumStock.trim()))
    throw new Error("Enter a non-negative low-stock threshold with up to six decimal places.");
  const minimumStock = new Decimal(draft.minimumStock.trim()).toFixed();
  if (product.baseUnit === "piece" && !new Decimal(minimumStock).isInteger())
    throw new Error("Whole-piece products need a whole-number low-stock threshold.");
  if (name === product.name && sku === product.sku && category === product.category &&
      new Decimal(minimumStock).equals(product.minimumStock))
    throw new Error("No product details changed.");
  return {
    productId: product.id,
    expectedName: product.name,
    expectedSku: product.sku,
    expectedCategory: product.category,
    expectedMinimumStock: String(product.minimumStock),
    name, sku, category, minimumStock, reason, confirmed: true,
  };
}
