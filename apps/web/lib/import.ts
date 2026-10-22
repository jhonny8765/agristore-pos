import type { Product } from "@agristore/domain";
import { canonicalQuantity, quantitySchema } from "@agristore/domain";
export function parseOpeningCSV(text: string, products: Product[]) {
  const lines: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field.trim());
      if (row.some(Boolean)) lines.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quote");
  row.push(field.trim());
  if (row.some(Boolean)) lines.push(row);
  const headers = lines.shift()?.map((h) => h.replace(/^\uFEFF/, ""));
  if (
    !headers ||
    ["sku", "unit", "quantity", "lot", "expiresOn"].some(
      (h) => !headers.includes(h),
    )
  )
    throw new Error("CSV needs sku,unit,quantity,lot,expiresOn headers");
  if (!lines.length || lines.length > 1000)
    throw new Error("Import between 1 and 1000 rows");
  return lines.map((values, i) => {
    const r = Object.fromEntries(headers.map((h, j) => [h, values[j] ?? ""]));
    const p = products.find((p) => p.sku === r.sku),
      u = p?.units.find((u) => u.name === r.unit);
    if (!p || !u) throw new Error(`Row ${i + 2}: unknown SKU or selling unit`);
    quantitySchema.parse(r.quantity);
    canonicalQuantity(r.quantity, u.factor);
    if (p.tracksExpiry && (!r.lot || !/^\d{4}-\d{2}-\d{2}$/.test(r.expiresOn)))
      throw new Error(`Row ${i + 2}: lot and expiry are required`);
    return {
      productId: p.id,
      unitId: u.id,
      quantity: r.quantity,
      lot: r.lot,
      expiresOn: r.expiresOn || null,
    };
  });
}
