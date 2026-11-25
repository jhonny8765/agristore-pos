"use client";

import { useEffect, useId, useRef, useState } from "react";
import { money, type Product } from "@agristore/domain";
import type { HistoryRow } from "../lib/history";
import { RecordTable } from "./record-pages";
import { RecordRow } from "./record-row";
import { Button } from "./ui/button";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function lineItems(row: HistoryRow): Record<string, unknown>[] {
  const items = asRecord(row.payload)?.items;
  return Array.isArray(items) ? items.map(asRecord).filter(item => item !== undefined) : [];
}

function receivedAt(row: HistoryRow) {
  const time = Date.parse(text(row.created_at));
  return Number.isFinite(time) ? new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
  }).format(time) : "Not recorded";
}

function recordedCapital(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return money(value);
  if (typeof value === "string" && /^\d{1,16}$/.test(value) && BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER)) return money(value);
  return "Not recorded";
}

export function ReceivingRecords({ rows, products, suppliers, active }: {
  rows: HistoryRow[];
  products: Product[];
  suppliers: { id: string; name: string }[];
  active: boolean;
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = active && rows.find(row => row.id === selectedId);
  const supplierNames = new Map(suppliers.map(supplier => [supplier.id, supplier.name]));
  const supplierName = (row: HistoryRow) => {
    const id = text(row.supplier_id);
    return text(asRecord(row.payload)?.supplierName) || (id ? supplierNames.get(id) || id : "No supplier");
  };
  const reference = (row: HistoryRow) => text(row.reference) || text(row.id);
  return <>
    <div className="table-wrap history-table" data-kind="purchases" role="region" aria-label="Receiving history records" tabIndex={0}>
      <RecordTable>
        <thead><tr>{["Recorded", "Reference", "Source", "Supplier", "Lines"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <RecordRow key={text(row.id)} onOpen={() => setSelectedId(text(row.id))}>
          <td>{receivedAt(row)}</td>
          <td><button type="button" className="record-link" onClick={() => setSelectedId(text(row.id))}>{reference(row)}</button></td>
          <td>{row.source === "opening" ? "Opening stock" : "Purchase"}</td>
          <td>{supplierName(row)}</td>
          <td>{lineItems(row).length}</td>
        </RecordRow>)}</tbody>
      </RecordTable>
    </div>
    {selected && <ReceivingDetails key={selectedId} row={selected} reference={reference(selected)} supplier={supplierName(selected)} products={products} onClose={() => setSelectedId("")}/>}
  </>;
}

function ReceivingDetails({ row, reference, supplier, products, onClose }: {
  row: HistoryRow;
  reference: string;
  supplier: string;
  products: Product[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const catalog = new Map(products.map(product => [product.id, product]));
  const items = lineItems(row);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  return <dialog ref={dialog} aria-labelledby={heading} className="panel receiving-details" onClose={onClose}>
    <div className="section-heading">
      <h2 id={heading}>Receipt {reference}</h2>
      <Button type="button" size="sm" variant="outline" onClick={() => dialog.current?.close()}>Close</Button>
    </div>
    <dl className="receiving-details-summary">
      <div><dt>Supplier</dt><dd>{supplier}</dd></div>
      <div><dt>Recorded</dt><dd>{receivedAt(row)}</dd></div>
    </dl>
    {items.length ? <div className="table-wrap" role="region" aria-label="Received items" tabIndex={0}>
      <RecordTable>
        <thead><tr>{["Product", "Unit", "Quantity", "Capital per unit", "Lot / expiry"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{items.map((item, index) => {
          const product = catalog.get(text(item.productId));
          const unit = product?.units.find(entry => entry.id === item.unitId);
          const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? String(item.quantity) : text(item.quantity);
          return <tr key={index}>
            <td>{text(item.name) || product?.name || text(item.productId) || "Not recorded"}</td>
            <td>{text(item.unitName) || unit?.name || text(item.unitId) || "Not recorded"}</td>
            <td>{quantity || "Not recorded"}</td>
            <td>{recordedCapital(item.unitCost)}</td>
            <td>{text(item.lot) || text(item.batchId) || "—"}{text(item.expiresOn) && <small>{text(item.expiresOn)}</small>}</td>
          </tr>;
        })}</tbody>
      </RecordTable>
    </div> : <p>No item details were recorded.</p>}
  </dialog>;
}
