"use client";

import { useRef, useState, type FormEvent, type Ref } from "react";
import { ArrowDownToLine, Plus, Search, X } from "lucide-react";
import Decimal from "decimal.js";
import { measuredQuantity, money, type Product } from "@agristore/domain";
import { compareProductNames } from "../lib/inventory-order";
import { supplierCents } from "../lib/supplier-accounts";
import { sellingUnitReady } from "../lib/branch-pricing";
import { stockAwaitingConfirmation } from "../lib/product-review";
import { productStock } from "../lib/stock-display";
import { ProductPhoto } from "./product-photo";
import { RecordPages } from "./record-pages";
import { SearchSelect } from "./search-select";
import { DeliveryReference, purchaseInvoice, SupplierPurchaseFields } from "./supplier-purchase-fields";
import { Button } from "./ui/button";

type DraftLine = { id: string; unitId: string; quantity: string };
type StockLine = {
  productId: string;
  unitId: string;
  quantity: string;
  documentQuantity: string | null;
  deliveryNotes: string;
  lot: string;
  expiresOn: string | null;
  unitCost?: number;
};

export function AddStock({ organizationId, branchId, products, stock, stockLoaded, suppliers, initialUnitId, canAttachBill, disabled, headingRef, onReceive }: {
  organizationId: string;
  branchId: string;
  products: Product[];
  stock: ReadonlyMap<string, string>;
  stockLoaded: boolean;
  suppliers: { id: string; name: string }[];
  initialUnitId?: string;
  canAttachBill: boolean;
  disabled: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  onReceive: (delivery: { supplierId: string | null; reference: string; items: StockLine[] }, invoice: ReturnType<typeof purchaseInvoice>) => Promise<Error | undefined>;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => initialUnitId ? [{ id: crypto.randomUUID(), unitId: initialUnitId, quantity: "1" }] : []);
  const [formVersion, setFormVersion] = useState(0);
  const [error, setError] = useState("");
  const itemsHeading = useRef<HTMLHeadingElement>(null);
  const catalog = products.filter(product => product.active && !product.setupPending && product.units.length);
  const availableUnits = new Map(catalog.flatMap(product => product.units.map(unit => [unit.id, { product, unit }] as const)));
  const search = query.trim().toLowerCase();
  const matches = catalog
    .filter(product => [product.name, product.sku, product.originalCode, ...product.units.map(unit => unit.name)].some(value => value?.toLowerCase().includes(search)))
    .sort(compareProductNames);

  function addLine(unitId: string, separateLot = false) {
    const newLine = { id: crypto.randomUUID(), unitId, quantity: "1" };
    setLines(current => {
      const existing = separateLot ? undefined : current.find(line => line.unitId === unitId);
      if (!existing) return [...current, newLine];
      return current.map(line => {
        if (line.id !== existing.id) return line;
        const quantity = /^\d+(\.\d+)?$/.test(line.quantity) ? new Decimal(line.quantity).plus(1).toFixed() : "1";
        return { ...line, quantity };
      });
    });
  }

  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setError("");
    const fields = new FormData(event.currentTarget);
    const read = (name: string) => String(fields.get(name) ?? "").trim();
    try {
      if (!lines.length) throw Error("Add at least one product.");
      const invoice = canAttachBill ? purchaseInvoice(fields) : null;
      if (invoice && !supplierId) throw Error("Choose a supplier for the bill.");
      const reference = invoice?.mode === "new" ? invoice.reference : read("reference");
      if (!reference) throw Error("Enter a delivery or invoice reference.");
      const items = lines.map(line => {
        const item = availableUnits.get(line.unitId);
        if (!item) throw Error("Remove any product that is no longer available.");
        const { product, unit } = item;
        const measurement = { baseUnit: product.baseUnit, unitName: unit.name, factor: unit.factor };
        const reported = read(`document-${line.id}`);
        const cost = read(`cost-${line.id}`);
        return {
          productId: product.id,
          unitId: unit.id,
          quantity: measuredQuantity(line.quantity, "unit", measurement, true).quantity,
          documentQuantity: reported ? measuredQuantity(reported, "unit", measurement).quantity : null,
          deliveryNotes: read(`notes-${line.id}`),
          lot: read(`lot-${line.id}`),
          expiresOn: read(`expiry-${line.id}`) || null,
          ...(cost ? { unitCost: /^0(?:\.0{1,2})?$/.test(cost) ? 0 : supplierCents(cost) } : {}),
        };
      });
      const failure = await onReceive({ supplierId: supplierId || null, reference, items }, invoice);
      if (failure) { setError(failure.message); return; }
      setLines([]);
      setSupplierId("");
      setFormVersion(version => version + 1);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not receive stock.");
    }
  }

  return <form className="add-stock" aria-label="Add stock" onSubmit={receive}>
    <section className="panel add-stock-invoice">
      <h2 ref={headingRef} tabIndex={-1}>Add stock</h2>
      <div className="field"><span>Supplier</span>
        <SearchSelect label="Supplier" placeholder="Search supplier name" value={supplierId} onChange={setSupplierId} disabled={disabled}
          options={suppliers.map(supplier => ({ value: supplier.id, label: supplier.name }))}/>
      </div>
      {canAttachBill ? <SupplierPurchaseFields key={formVersion} organizationId={organizationId} branchId={branchId} supplierId={supplierId} disabled={disabled} quickReceipt/> : <DeliveryReference key={formVersion}/>}
      <Button type="button" size="sm" variant="outline" className="add-stock-items-link"
        onClick={() => itemsHeading.current?.focus()}>Items to receive ({lines.length})</Button>
    </section>

    <section className="panel add-stock-products">
      <label className="field search-field">
        <span className="sr-only">Search products to receive</span><Search size={18} aria-hidden="true"/>
        <input type="search" placeholder="Search products, SKU or unit" value={query} onChange={event => setQuery(event.target.value)}/>
      </label>
      <RecordPages key={search} label="Products to receive" pageSize={3} paginationPosition="bottom" showSummary={false} className="stock-product-grid">
        {matches.map(product => {
          const available = productStock(product, stock);
          const onHand = !stockLoaded ? "Stock unavailable" : stockAwaitingConfirmation(product) ? "Stock pending confirmation" : `${available.quantity} ${available.unit} on hand`;
          return <article key={product.id} className="stock-product-card">
          <ProductPhoto product={product}/>
          <div><small>{product.category} · {product.sku}</small><h3>{product.name}</h3></div>
          <small className="stock-product-on-hand">{onHand}</small>
          <div className="stock-product-units">
            {product.units.map(unit => <div key={unit.id} className="stock-product-unit">
              <small>{unit.price !== null && sellingUnitReady(product, unit) && (!unit.branchId || unit.branchId === branchId)
                ? `Selling price ${money(unit.price)} / ${unit.name}` : `Selling price pending / ${unit.name}`}</small>
              <Button type="button" size="sm" disabled={disabled}
                aria-label={`Add ${product.name}, ${unit.name}`} onClick={() => addLine(unit.id)}><Plus size={15} aria-hidden="true"/>{unit.name}</Button>
            </div>)}
          </div>
          </article>;
        })}
      </RecordPages>
      {!matches.length && <p>No matching products.</p>}
      <h3 ref={itemsHeading} tabIndex={-1}>Items to receive <span className="status-tag" aria-live="polite">{lines.length}</span></h3>
      {lines.map(line => {
        const item = availableUnits.get(line.unitId);
        const remove = <Button type="button" size="sm" variant="ghost" disabled={disabled}
          aria-label={`Remove ${item?.product.name ?? "unavailable product"}`} onClick={() => setLines(current => current.filter(candidate => candidate.id !== line.id))}><X size={17}/></Button>;
        if (!item) return <div className="stock-receipt-line" key={line.id}>Product unavailable {remove}</div>;
        const { product, unit } = item;
        return <fieldset className="stock-receipt-line" key={line.id} disabled={disabled}>
          <legend>{product.name} · {unit.name}</legend>
          <div className="form-grid">
            <label className="field"><span>Quantity received</span><input inputMode="decimal" required value={line.quantity}
              onChange={event => {
                const quantity = event.currentTarget.value;
                setLines(current => current.map(candidate => candidate.id === line.id ? { ...candidate, quantity } : candidate));
              }}/></label>
            <label className="field"><span>Capital per {unit.name} (₱)</span><input name={`cost-${line.id}`} inputMode="decimal" placeholder={!product.costPending && unit.cost != null && unit.cost > 0 ? `Catalog cost ${money(unit.cost)}` : "Optional"}/></label>
            <label className="field"><span>Lot / batch</span><input name={`lot-${line.id}`} maxLength={180} required={product.tracksExpiry}/></label>
            <label className="field"><span>Expiry date</span><input type="date" name={`expiry-${line.id}`} required={product.tracksExpiry}/></label>
          </div>
          <div className="stock-line-actions">
            <details><summary>Delivery difference</summary>
              <label className="field"><span>Documented quantity</span><input name={`document-${line.id}`} inputMode="decimal"/></label>
              <label className="field"><span>Reason</span><input name={`notes-${line.id}`} maxLength={1000}/></label>
            </details>
            <Button type="button" size="sm" variant="ghost" onClick={() => addLine(line.unitId, true)}>Add another lot</Button>
            {remove}
          </div>
        </fieldset>;
      })}
      {error && <p className="notice error" role="alert">{error}</p>}
      <Button disabled={disabled || !lines.length}>Receive stock <ArrowDownToLine size={16}/></Button>
    </section>
  </form>;
}
