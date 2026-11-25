"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import { money, moneyCentavos, moneyInput, type Product } from "@agristore/domain";
import type { PosDatabase } from "@agristore/offline";
import { branchNetwork, branchPriceBook, command } from "../lib/api";
import type { BranchPriceBook, BranchPriceRow, PriceCopyReview } from "../lib/branch-pricing";
import { onlineOperation } from "../lib/operations";
import { Button } from "./ui/button";

type Props = {
  organizationId: string;
  branchId: string;
  actorId: string;
  db: PosDatabase;
  online: boolean;
  disabled: boolean;
  products: Product[];
  execute: (fn: () => Promise<void>) => Promise<Error | undefined>;
  history: ReactNode;
};

export function BranchPriceEditor({ organizationId, branchId, actorId, db, online, disabled, products, execute, history }: Props) {
  const [books, setBooks] = useState<BranchPriceBook[]>([]);
  const [mobileBranch, setMobileBranch] = useState(branchId);
  const [source, setSource] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<"copy" | "history">();
  const [edit, setEdit] = useState<{ book: BranchPriceBook; row: BranchPriceRow }>();
  const generation = useRef(0);
  const pageLock = useRef(false);
  const lock = useRef(false);

  useEffect(() => {
    const token = ++generation.current;
    if (!online) return;
    let active = true;
    const timer = setTimeout(async () => {
      if (!active || token !== generation.current) return;
      setLoading(true);
      setError("");
      try {
        const current = await branchPriceBook({ organizationId, branchId, query });
        const network = current.networkEnabled && current.pricingMode === "branch" ? await branchNetwork(organizationId) : undefined;
        const branches = network?.branches ?? [{ id: branchId, name: current.branchName }];
        const next = await Promise.all(branches.map(b => b.id === branchId ? current : branchPriceBook({ organizationId, branchId: b.id, query })));
        if (!active || token !== generation.current) return;
        setBooks(next);
        setSource(previous => branches.some(b => b.id === previous) ? previous : network?.hubBranchId ?? branchId);
      } catch (e) {
        if (active && token === generation.current) {
          setBooks([]);
          setError(e instanceof Error ? e.message : "Could not load branch prices.");
        }
      } finally {
        if (active && token === generation.current) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [organizationId, branchId, online, query, revision]);

  const first = books[0];
  const sourceBook = books.find(book => book.branchId === source);
  const network = first?.networkEnabled && first.pricingMode === "branch" && books.length > 1;
  const blocked = disabled || working || !online || loading;
  const setupPending = new Set(products.filter(product => product.setupPending).map(product => product.id));
  const prices = books.map(book => new Map(book.rows.map(row => [row.unitId, row])));
  const sourceIndex = books.findIndex(book => book.branchId === source);
  const shownBranch = books.some(book => book.branchId === mobileBranch) ? mobileBranch : first?.branchId;

  async function more() {
    if (!first?.next || blocked || pageLock.current) return;
    const token = generation.current;
    pageLock.current = true;
    setLoading(true);
    setError("");
    try {
      const next = await Promise.all(books.map(b => branchPriceBook({ organizationId, branchId: b.branchId, query, cursor: first.next! })));
      if (token === generation.current) {
        setBooks(next.map((b, i) => ({ ...b, rows: [...books[i].rows, ...b.rows] })));
      }
    } catch (e) {
      if (token === generation.current) setError(e instanceof Error ? e.message : "Could not load more selling units.");
    } finally {
      pageLock.current = false;
      if (token === generation.current) setLoading(false);
    }
  }

  async function publish(action: string, data: Record<string, unknown>) {
    if (lock.current || blocked) return false;
    lock.current = true;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const failure = await execute(async () => {
        await onlineOperation(db, actorId, action, { organizationId, ...data }, "requestId");
      });
      if (failure) throw failure;
      setEdit(undefined);
      setSelected([]);
      setLoading(true);
      setRevision(n => n + 1);
      setMessage(action === "apply_branch_price_copy" ? "Reviewed prices copied." : "Selling price saved.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm this price. Check the original request in Sync center.");
      return false;
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }

  return <section className="panel inventory-pricing" aria-label="Branch pricing">
    <div className="section-heading">
      <h2>Pricing</h2>
      <div className="inventory-panel-actions">
        {network && <Button variant="outline" aria-expanded={panel === "copy"} onClick={() => setPanel(panel === "copy" ? undefined : "copy")}>Copy prices</Button>}
        <Button variant="outline" aria-expanded={panel === "history"} onClick={() => setPanel(panel === "history" ? undefined : "history")}>Price history</Button>
      </div>
    </div>
    {!online && <p role="status">Reconnect to view or update selling prices.</p>}
    {loading && online && <p role="status">Loading confirmed prices…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {first?.pricingMode === "legacy" && <p>Use Edit product to update selling prices for this catalog.</p>}
    {online && first?.pricingMode !== "legacy" && <>
      <div className="register-filters">
        <label className="field"><span>Find selling unit</span><input type="search" maxLength={180} value={query} onChange={e => { setQuery(e.target.value); setLoading(true); }} placeholder="Product, SKU or unit"/></label>
        {network && <label className="field"><span>Copy source branch</span><select value={source} disabled={blocked} onChange={e => { setSource(e.target.value); setSelected([]); }}>{books.map(b => <option key={b.branchId} value={b.branchId}>{b.branchName}</option>)}</select></label>}
        <Button variant="outline" disabled={blocked || pageLock.current} onClick={() => { setLoading(true); setRevision(n => n + 1); }}>Refresh prices</Button>
      </div>
      {panel === "copy" && network && sourceBook && <PriceCopyPanel key={source} organizationId={organizationId} source={sourceBook} books={books} selected={selected} blocked={blocked} publish={publish}/>}
      {edit && <BranchUnitPriceForm key={`${edit.book.branchId}:${edit.row.unitId}:${edit.row.version}`} {...edit} blocked={blocked} onClose={() => setEdit(undefined)} publish={publish}/>}
      {panel === "history" && <>
        {first?.pricingMode === "branch" && <BranchPriceHistory books={books}/>}
        {history}
      </>}
      {network && <label className="field pricing-mobile-branch"><span>Show branch prices</span><select value={shownBranch} onChange={e => setMobileBranch(e.target.value)}>{books.map(book => <option key={book.branchId} value={book.branchId}>{book.branchName}</option>)}</select></label>}
      {first && <div className="table-wrap inventory-pricing-grid" tabIndex={0} role="region" aria-label="Selling prices by branch"><table>
        <thead><tr><th>Product / selling unit</th>{books.map(b => <th key={b.branchId} className={b.branchId === shownBranch ? undefined : "pricing-mobile-hidden"}>{b.branchName}</th>)}</tr></thead>
        <tbody>{first.rows.map(row => <tr key={row.unitId}>
          <th scope="row"><div className="pricing-product">
            {network && <input type="checkbox" aria-label={`Select ${row.name} · ${row.unitName}`} disabled={blocked || !prices[sourceIndex]?.get(row.unitId)?.ready} checked={selected.includes(row.unitId) && !!prices[sourceIndex]?.get(row.unitId)?.ready} onChange={e => setSelected(previous => e.target.checked ? [...previous, row.unitId] : previous.filter(id => id !== row.unitId))}/>}
            <div><strong>{row.name}</strong><small>{row.sku} · {row.unitName}</small></div>
          </div></th>
          {books.map((b, index) => {
            const value = prices[index].get(row.unitId);
            return <td key={b.branchId} className={b.branchId === shownBranch ? undefined : "pricing-mobile-hidden"}>{value ? <div className="pricing-cell">
              <strong>{value.ready && value.price !== null ? money(value.price) : "Price needed"}</strong>
              <Button type="button" size="sm" variant="outline" disabled={blocked || setupPending.has(row.productId)} aria-label={`Edit ${row.name} · ${row.unitName} in ${b.branchName}`} onClick={() => { setEdit({ book: b, row: value }); setError(""); }}>Edit</Button>
            </div> : "—"}</td>;
          })}
        </tr>)}</tbody>
      </table></div>}
      {first && <p className="scope-note">{first.rows.length} of {first.total} selling units{selected.length ? ` · ${selected.length} selected` : ""}</p>}
      {first?.next && <Button variant="outline" disabled={blocked} onClick={() => void more()}>Load more selling units</Button>}
    </>}
    {panel === "history" && (!online || first?.pricingMode === "legacy") && history}
  </section>;
}

type Publish = (action: string, data: Record<string, unknown>) => Promise<boolean>;

export function BranchUnitPriceForm({ book, row, blocked, onClose, publish }: {
  book: Pick<BranchPriceBook, "branchId" | "branchName">;
  row: Pick<BranchPriceRow, "unitId" | "name" | "unitName" | "version" | "price" | "sellingPolicy" | "baseUnit" | "factor">;
  blocked: boolean;
  onClose?: () => void;
  publish: Publish;
}) {
  const [error, setError] = useState("");
  function submit(form: FormData) {
    try {
      setError("");
      void publish("publish_branch_unit_price", {
        branchId: book.branchId,
        unitId: row.unitId,
        expectedVersion: row.version,
        price: moneyCentavos(String(form.get("price"))),
        sellingPolicy: form.get("policy"),
        reason: String(form.get("reason")).trim(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the selling price.");
    }
  }
  return <form className="inventory-inline-panel" aria-label="Edit branch selling price" onSubmit={e => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
    <fieldset disabled={blocked}>
      <legend>{book.branchName} · {row.name} · {row.unitName}</legend>
      <div className="form-grid">
        <label className="field"><span>Selling price (₱)</span><input name="price" required inputMode="decimal" defaultValue={row.price === null ? "" : moneyInput(row.price)}/></label>
        <label className="field"><span>Selling policy</span><select name="policy" defaultValue={row.sellingPolicy}><option value="fractional">Fractional quantities allowed</option><option value="sealed_whole">Whole sealed packs only</option></select></label>
      </div>
      {row.baseUnit === "kg" && row.price !== null && new Decimal(row.factor).gt(1) && <p>Current pack price per kg is ₱{new Decimal(row.price).div(100).div(row.factor).toFixed(2)}. Loose kilos have their own price.</p>}
      <label className="field"><span>Reason</span><input name="reason" required minLength={3} maxLength={1000}/></label>
      <label className="checkbox"><input required type="checkbox"/>I confirm the branch, selling unit, price and selling policy.</label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="inventory-panel-actions"><Button>Publish confirmed price</Button>{onClose && <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>}</div>
    </fieldset>
  </form>;
}

function PriceCopyPanel({ organizationId, source, books, selected, blocked, publish }: {
  organizationId: string;
  source: BranchPriceBook;
  books: BranchPriceBook[];
  selected: string[];
  blocked: boolean;
  publish: Publish;
}) {
  const [scope, setScope] = useState("selected");
  const [mode, setMode] = useState("fill");
  const [targets, setTargets] = useState<string[]>([]);
  const [result, setResult] = useState<PriceCopyReview>();
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const branchNames = new Map(books.map(book => [book.branchId, book.branchName]));
  const data = { organizationId, branchId: source.branchId, scope, mode, targetIds: targets, unitIds: scope === "selected" ? selected : [] };
  const matches = result?.selection === JSON.stringify(data) ? result : undefined;

  async function review() {
    if (lock.current || blocked) return;
    lock.current = true;
    setReviewing(true);
    setResult(undefined);
    setError("");
    try {
      const result = await command<Omit<PriceCopyReview, "selection">>("preview_branch_price_copy", data);
      setResult({ ...result, selection: JSON.stringify(data) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare the price copy.");
    } finally {
      lock.current = false;
      setReviewing(false);
    }
  }

  return <section className="inventory-inline-panel" aria-label="Copy prices">
    <h3>Copy prices from {source.branchName}</h3>
    <form onSubmit={e => { e.preventDefault(); void review(); }}>
      <fieldset disabled={blocked || reviewing}>
        <div className="form-grid">
          <label className="field"><span>Prices to copy</span><select value={scope} onChange={e => { setScope(e.target.value); setResult(undefined); }}><option value="selected">Copy selected ({selected.length})</option><option value="all">Copy all confirmed prices</option></select></label>
          <label className="field"><span>Copy rule</span><select value={mode} onChange={e => { setMode(e.target.value); setResult(undefined); }}><option value="fill">Fill missing prices only</option><option value="replace">Replace existing prices</option></select></label>
        </div>
        <div className="inventory-panel-actions">
          {books.filter(book => book.branchId !== source.branchId).map(book => <label className="checkbox" key={book.branchId}>
            <input type="checkbox" checked={targets.includes(book.branchId)} onChange={e => { setTargets(previous => e.target.checked ? [...previous, book.branchId] : previous.filter(id => id !== book.branchId)); setResult(undefined); }}/>{book.branchName}
          </label>)}
        </div>
        <Button variant="outline" disabled={!targets.length || (scope === "selected" && !selected.length)}>{reviewing ? "Preparing review…" : "Review price copy"}</Button>
      </fieldset>
    </form>
    {error && <p role="alert" className="notice error">{error}</p>}
    {matches && <form key={matches.token} onSubmit={async e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const applied = await publish("apply_branch_price_copy", { ...data, token: matches.token, expectedCount: matches.count, confirmed: true, reason: String(form.get("reason")).trim() });
      if (applied) setResult(undefined);
    }}>
      <fieldset disabled={blocked || reviewing}>
        <legend>Review for {targets.map(id => branchNames.get(id)).join(", ")}</legend>
        <p>{matches.units} selling units · {matches.count} destination prices to save · {matches.rows.length - matches.count} to skip</p>
        {matches.rows.length > 0 && <div className="table-wrap inventory-review-scroll" tabIndex={0} role="region" aria-label="Reviewed price changes"><table>
          <thead><tr><th>Product / selling unit</th><th>Destination</th><th>Current price</th><th>Source price</th><th>Action</th></tr></thead>
          <tbody>{matches.rows.map(row => <tr key={`${row.branchId}:${row.unitId}`}><td>{row.name}<small>{row.sku} · {row.unitName}</small></td><td>{branchNames.get(row.branchId)}</td><td>{row.currentPrice === null ? "—" : money(row.currentPrice)}</td><td>{money(row.price)}<small>{row.sellingPolicy === "sealed_whole" ? "Whole sealed packs" : "Fractional quantities"}</small></td><td>{row.decision}</td></tr>)}</tbody>
        </table></div>}
        {matches.count > 0 ? <>
          <label className="field"><span>Copy reason</span><input name="reason" required minLength={3} maxLength={1000}/></label>
          <label className="checkbox"><input type="checkbox" required/>I reviewed these branch prices and confirm the copy.</label>
          <Button>Confirm price copy</Button>
        </> : <p>No prices to copy for these choices.</p>}
      </fieldset>
    </form>}
  </section>;
}

function BranchPriceHistory({ books }: { books: BranchPriceBook[] }) {
  const [branch, setBranch] = useState("");
  const book = books.find(b => b.branchId === branch) ?? books[0];
  return <section className="inventory-inline-panel" aria-label="Branch price history">
    <h3>Branch price history</h3>
    <label className="field"><span>History branch</span><select value={book.branchId} onChange={e => setBranch(e.target.value)}>{books.map(b => <option key={b.branchId} value={b.branchId}>{b.branchName}</option>)}</select></label>
    <p className="scope-note">Showing price versions for the selling units loaded in Pricing.</p>
    <div className="inventory-review-scroll" tabIndex={0} role="region" aria-label="Branch price versions">{book.rows.filter(row => row.history.length > 0).map(row => <details key={row.unitId}><summary>{row.name} · {row.unitName}</summary><ol>{row.history.map(h => <li key={h.id}>Version {h.version} · {money(h.price)} · {new Date(h.at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} · {h.reason}</li>)}</ol></details>)}
      {!book.rows.some(row => row.history.length > 0) && <p>No confirmed branch price versions loaded.</p>}
    </div>
  </section>;
}
