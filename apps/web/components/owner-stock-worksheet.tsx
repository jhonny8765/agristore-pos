"use client";

import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import { Button } from "./ui/button";
import { command } from "../lib/api";

interface StockRow {
  productId: string;
  batchId: string | null;
  sku: string;
  name: string;
  batch: string | null;
  expiresOn: string | null;
  baseUnit: string;
  expected: string;
  revision: string;
}

interface CountDraft {
  row: StockRow;
  quantity: string;
}

type StockPage = { rows: StockRow[]; next: number | null; total: number };

const rowKey = (row: StockRow) => `${row.productId}:${row.batchId ?? ""}`;
const manilaToday = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const quantityPattern = /^\d{1,14}(?:\.\d{1,6})?$/;

export function OwnerStockWorksheet({ organizationId, branchId, branchName, online, disabled, revision, onPost }: {
  organizationId: string;
  branchId: string;
  branchName: string;
  online: boolean;
  disabled: boolean;
  revision: number;
  onPost: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [date, setDate] = useState(manilaToday);
  const [started, setStarted] = useState(false);
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<StockPage>();
  const [drafts, setDrafts] = useState<Record<string, CountDraft>>({});
  const [review, setReview] = useState<CountDraft[]>();
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    if (!online || !started) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await command<StockPage>("owner_count_worksheet", { organizationId, branchId, countDate: date, query, offset: pageIndex });
        if (active) setPage(result);
      } catch (e) {
        if (active) {
          setPage(undefined);
          setError(e instanceof Error ? e.message : "Could not load the stock worksheet.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 160);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [organizationId, branchId, started, online, date, query, pageIndex, refresh, revision]);

  const entries = Object.values(drafts);
  const blocked = !online || disabled || loading || posting;
  function reviseRow(row: StockRow, quantity: string) {
    setDrafts(existing => {
      const next = { ...existing };
      const key = rowKey(row);
      if (!quantity.trim()) delete next[key];
      else next[key] = { row, quantity };
      return next;
    });
    setError("");
  }

  async function reviewCounts(previous: CountDraft[], afterStale = false) {
    if (previous.some(({ row, quantity }) => !quantityPattern.test(quantity.trim()) || (row.baseUnit === "piece" && !new Decimal(quantity).isInteger()))) {
      setError("Enter nonnegative counts with up to six decimal places. Items measured in pieces require whole counts.");
      return;
    }
    setMessage("");
    setError("");
    setReviewNotice("");
    setLoading(true);
    try {
      const current = await command<StockPage>("owner_count_worksheet", {
        organizationId, branchId, countDate: date,
        reviewItems: previous.map(({ row }) => ({ productId: row.productId, batchId: row.batchId })),
      });
      const rows = new Map(current.rows.map(row => [rowKey(row), row]));
      const next: CountDraft[] = [];
      let updated = false;
      for (const entry of previous) {
        const row = rows.get(rowKey(entry.row));
        if (!row || row.baseUnit !== entry.row.baseUnit) {
          setReview(undefined);
          setError("A counted item or its measurement changed. Clear that entry and count it again before saving.");
          return;
        }
        updated ||= row.revision !== entry.row.revision || row.expected !== entry.row.expected;
        next.push({ row, quantity: entry.quantity });
      }
      setDrafts(Object.fromEntries(next.map(entry => [rowKey(entry.row), entry])));
      setReview(next);
      if (updated || afterStale) {
        setReviewNotice("On Hand changed. Review the refreshed balances and confirm the counts again.");
        setRefresh(n => n + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh the reviewed stock balances.");
    } finally {
      setLoading(false);
    }
  }

  async function post(reason: string) {
    if (!review || blocked || pending.current) return;
    pending.current = true;
    setPosting(true);
    setError("");
    try {
      await onPost({
        countDate: date,
        confirmed: true,
        reason,
        items: review.map(({ row, quantity }) => ({
          productId: row.productId,
          batchId: row.batchId,
          baseUnit: row.baseUnit,
          expected: row.expected,
          revision: row.revision,
          quantity: new Decimal(quantity).toFixed(),
        })),
      });
      setReview(undefined);
      setDrafts({});
      setRefresh(n => n + 1);
      setMessage(`${review.length} physical counts saved. On Hand updated.`);
    } catch (e) {
      const problem = e instanceof Error ? e.message : "Could not confirm the stock count.";
      if (problem.includes("Stock changed")) {
        setReview(undefined);
        await reviewCounts(review, true);
      } else setError(problem);
    } finally {
      pending.current = false;
      setPosting(false);
    }
  }

  return <section className="panel owner-stock-worksheet" aria-label="Owner stock worksheet">
    <h2>Stock counts</h2>
    <p>{branchName}. Enter physical counts in the displayed base unit. Blank rows are left uncounted.</p>
    <form className="register-filters" onSubmit={e => {
      e.preventDefault();
      setError("");
      setLoading(true);
      setStarted(true);
      setRefresh(n => n + 1);
    }}>
      <label className="field"><span>Count date</span><input type="date" required max={manilaToday()} value={date} disabled={entries.length > 0 || posting} onChange={e => {
        setDate(e.target.value);
        setStarted(false);
        setPage(undefined);
        setLoading(false);
        setPageIndex(0);
        setMessage("");
        setError("");
      }}/></label>
      <Button type="submit" variant="outline" disabled={blocked || !date || !!review}>{started ? "Refresh inventory" : "Start Inventory"}</Button>
      <Button type="button" disabled={blocked || !entries.length || !!review} onClick={() => void reviewCounts(entries)}>Save</Button>
    </form>
    {!online && <p role="status">Reconnect to load or save this branch worksheet.</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {started && <>
      <div className="register-filters">
        <label className="field"><span>Find item</span><input type="search" placeholder="Item description, code or barcode" maxLength={180} value={query} disabled={posting || !!review} onChange={e => {
          setQuery(e.target.value);
          setPageIndex(0);
          setPage(undefined);
          if (online) setLoading(true);
        }}/></label>
        <p>{entries.length} rows entered</p>
        {entries.length > 0 && <Button type="button" variant="outline" disabled={blocked || !!review} onClick={() => { setDrafts({}); setError(""); }}>Clear entered counts</Button>}
      </div>
      {loading && online && <p role="status">Loading branch stock…</p>}
      {online && page && <>
        <div className="table-wrap inventory-count-grid" tabIndex={0} role="region" aria-label="Physical count worksheet"><table>
          <thead><tr><th>Item Code</th><th>Item Description</th><th>Stock Bin</th><th>Batch #</th><th>Exp Date</th><th>On Hand</th><th>Physical Count</th></tr></thead>
          <tbody>{page.rows.map(row => {
            const draft = drafts[rowKey(row)];
            const stale = draft && (draft.row.revision !== row.revision || draft.row.expected !== row.expected);
            return <tr key={rowKey(row)}>
              <td>{row.sku}</td><th scope="row">{row.name}</th><td>—</td><td>{row.batch ?? "—"}</td><td>{row.expiresOn ?? "—"}</td><td>{row.expected} {row.baseUnit}</td>
              <td><input aria-label={`Physical count for ${row.name}${row.batch ? ` · ${row.batch}` : ""}`} inputMode={row.baseUnit === "piece" ? "numeric" : "decimal"} value={draft?.quantity ?? ""} disabled={blocked || !!review} onChange={e => reviseRow(row, e.target.value)}/>
                {stale && <Button size="sm" variant="outline" disabled={blocked || !!review} onClick={() => reviseRow(row, draft.quantity)}>Use updated On Hand</Button>}
              </td>
            </tr>;
          })}</tbody>
        </table></div>
        {!page.rows.length && <p>No products or recorded lots match this search.</p>}
        <div className="inventory-panel-actions">
          <Button variant="outline" disabled={blocked || pageIndex === 0} onClick={() => { setLoading(true); setPageIndex(n => Math.max(0, n - 50)); }}>Previous</Button>
          <span>{page.rows.length ? `${pageIndex + 1}–${pageIndex + page.rows.length} of ${page.total}` : `0 of ${page.total}`}</span>
          <Button variant="outline" disabled={blocked || page.next === null} onClick={() => { if (page.next !== null) { setLoading(true); setPageIndex(page.next); } }}>Next</Button>
        </div>
      </>}
    </>}
    {review && <form className="inventory-inline-panel" aria-label="Confirm physical counts" onSubmit={e => {
      e.preventDefault();
      void post(String(new FormData(e.currentTarget).get("reason")).trim());
    }}>
      <fieldset disabled={blocked}>
        <legend>Confirm physical counts · {branchName} · {date}</legend>
        {reviewNotice && <p className="notice" role="status">{reviewNotice}</p>}
        <div className="table-wrap inventory-review-scroll" tabIndex={0} role="region" aria-label="Reviewed stock adjustments"><table>
          <thead><tr><th>Item / batch</th><th>On Hand</th><th>Physical Count</th><th>Adjustment</th></tr></thead>
          <tbody>{review.map(({ row, quantity }) => <tr key={rowKey(row)}>
            <th scope="row">{row.name}<small>{row.sku}{row.batch ? ` · ${row.batch}` : ""}</small></th>
            <td>{row.expected} {row.baseUnit}</td><td>{new Decimal(quantity).toFixed()} {row.baseUnit}</td><td>{new Decimal(quantity).minus(row.expected).toFixed()} {row.baseUnit}</td>
          </tr>)}</tbody>
        </table></div>
        <label className="field"><span>Count reason</span><input name="reason" required minLength={3} maxLength={1000}/></label>
        <label className="checkbox"><input required type="checkbox"/>I confirm these counts and want to update On Hand.</label>
        <div className="inventory-panel-actions"><Button>Confirm and update On Hand</Button><Button variant="outline" type="button" onClick={() => setReview(undefined)}>Back to worksheet</Button></div>
      </fieldset>
    </form>}
  </section>;
}
