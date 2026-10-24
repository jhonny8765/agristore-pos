"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@agristore/domain";
import type { PosDatabase } from "@agristore/offline";
import { command } from "../lib/api";
import { onlineOperation } from "../lib/operations";
import { historicalStock } from "../lib/stock-history";
import { ApprovalForm } from "./approval-form";
import { Button } from "./ui/button";

type Row = Record<string,unknown>;
interface Controls { openExceptions: number; exceptions: Row[]; holds: Row[]; issues: Row[] }
const val = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
export function StockControls({db, organizationId, branchId, actorId, products, owner, online, disabled, revision, execute}: {
  db: PosDatabase; organizationId: string; branchId: string; actorId: string; products: Product[];
  owner: boolean; online: boolean; disabled: boolean; revision: number;
  execute: (fn: () => Promise<void>) => Promise<Error | undefined>;
}) {
  const [data,setData] = useState<Controls>();
  const [error,setError] = useState("");
  const [feedback,setFeedback] = useState("");
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; },[]);
  const context = {organizationId,branchId};
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await command<Controls>("stock_controls",{organizationId,branchId});
      if (request === generation.current) { setData(next); setError(""); }
    } catch(e) { if(request === generation.current) setError(e instanceof Error ? e.message : "Could not refresh stock controls. Retry online."); }
  },[organizationId,branchId]);
  useEffect(() => {
    if (online) void load();
    return invalidate;
  },[online,load,revision,invalidate]);
  const label = (row: Row) => {
    const product = historicalStock(products,row);
    return `${product.name} · ${product.lot} (${product.baseUnit || "base units"})`;
  };
  async function save(action: string, body: Row, idField?: string) {
    if (idField) await onlineOperation(db,actorId,action,{...context,...body},idField);
    else await command(action,{...context,...body});
    setFeedback("Stock control recorded. The original history is retained.");
    await load();
  }
  return <>
    <section className="panel">
      <div className="section-heading"><h2>Stock investigations</h2><Button variant="outline" disabled={!online || disabled} onClick={() => void load()}>Refresh stock controls</Button></div>
      <p>Unresolved differences stay here until the owner records the evidence and outcome. Confirming an adjustment does not prove why stock was missing.</p>
      {feedback && <p role="status" className="notice success">{feedback}</p>}
      {error && <p role="alert" className="notice error">{error}</p>}
      {!online && <p className="notice">Reconnect to see current investigations and held goods.</p>}
      {!data ? <p role="status">Loading stock controls…</p> : <>
        <p role="status">{data.openExceptions} open investigations. Showing the oldest {data.exceptions.length}; older unresolved cases are never removed by new activity.</p>
        <div className="table-wrap history-table" role="region" aria-label="Open stock investigations" tabIndex={0}><table><thead><tr><th>Issue / evidence</th><th>Owner action</th></tr></thead><tbody>
          {data.exceptions.map(e => <tr key={String(e.id)}><td><strong>{String(e.kind).replaceAll("_"," ")}</strong><small>{String(e.created_at)} · {String(e.source_id)}</small><details><summary>Recorded details</summary><pre className="stock-evidence">{JSON.stringify(e.details,null,2)}</pre></details></td><td>{owner ? <ApprovalForm action="Resolve investigation" label="Evidence and outcome" description="Record what was checked, the cause if established, and the corrective action. This does not change stock." confirmLabel="Record resolution" disabled={disabled || !online} onConfirm={reason => execute(() => save("resolve_stock_exception",{exceptionId:e.id,reason}))} /> : "Owner review required"}</td></tr>)}
        </tbody></table></div>
      </>}
    </section>
    <section className="panel">
      <h2>Held goods · excluded from saleable stock</h2>
      <p>Keep these goods physically separate. Inspect them before release; expired goods cannot be released for sale.</p>
      {!data?.holds.length ? <p>No held goods loaded.</p> : <div className="table-wrap history-table" role="region" aria-label="Held stock" tabIndex={0}><table><thead><tr><th>Product / lot / reason</th><th className="numeric">Still held</th><th>Outcome</th></tr></thead><tbody>
        {data.holds.map(h => <tr key={String(h.id)}><td>{label(h)}<small>{String(h.reason)}</small></td><td className="numeric">{String(h.remaining)}</td><td>{owner ? <ApprovalForm action="Record held-goods outcome" label="Inspection / disposition reason" description="Release only goods verified saleable. Disposal or supplier return does not deduct saleable stock again." confirmLabel="Record outcome" disabled={disabled || !online} onConfirm={(reason,f) => execute(() => save("disposition_hold",{holdId:h.id,quantity:val(f,"quantity"),disposition:val(f,"disposition"),reason},"dispositionId"))}>
          <label className="field"><span>Quantity from held stock (base units)</span><input name="quantity" type="number" min="0.000001" step="0.000001" max={String(h.remaining)} required /></label>
          <label className="field"><span>Held-goods outcome</span><select name="disposition" defaultValue="dispose"><option value="dispose">Dispose / write off held goods</option><option value="supplier_return">Return held goods to supplier</option><option value="release">Release inspected goods for sale</option></select></label>
        </ApprovalForm> : "Owner review required"}</td></tr>)}
      </tbody></table></div>}
    </section>
    <section className="panel">
      <h2>Damage, spillage and other stock issues</h2>
      <p>Record actual quantities in base units. Nothing changes saleable stock until the owner approves. Do not use this to erase an unexplained count difference.</p>
      {!!data?.issues.length && <div className="table-wrap history-table" role="region" aria-label="Stock issues awaiting approval" tabIndex={0}><table><thead><tr><th>Issue</th><th className="numeric">Quantity</th><th>Approval</th></tr></thead><tbody>{data.issues.map(s => <tr key={String(s.id)}><td>{label(s)}<small>{String(s.category)} · {String(s.disposition)} · {String(s.reason)}</small></td><td className="numeric">{String(s.quantity)}</td><td>{owner && <ApprovalForm action="Approve stock issue" label="Approval notes" description="This deducts the recorded quantity from saleable stock and retains a separate movement. Held goods remain separately tracked." confirmLabel="Approve issue" disabled={disabled || !online} onConfirm={reason => execute(() => save("approve_stock_issue",{issueId:s.id,reason}))} />}</td></tr>)}</tbody></table></div>}
      <form className="form-grid" aria-label="Record stock issue" onSubmit={e => {
        e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
        const [productId,batch] = val(f,"stock").split(":");
        void execute(async () => { await onlineOperation(db,actorId,"record_stock_issue",{...context,productId,batchId:batch === "none" ? null : batch,quantity:val(f,"quantity"),category:val(f,"category"),disposition:val(f,"disposition"),reason:val(f,"reason")},"issueId"); form.reset(); setFeedback("Issue submitted for owner approval. Stock has not changed."); await load(); });
      }}>
        <label className="field"><span>Product / lot for stock issue</span><select name="stock" required>{products.flatMap(p => p.batches.length ? p.batches.map(b => <option key={b.id} value={`${p.id}:${b.id}`}>{p.name} · {b.lot} ({p.baseUnit})</option>) : [<option key={p.id} value={`${p.id}:none`}>{p.name} ({p.baseUnit})</option>])}</select></label>
        <label className="field"><span>Issue quantity (base units)</span><input name="quantity" type="number" min="0.000001" step="0.000001" required /></label>
        <label className="field"><span>Issue category</span><select name="category"><option value="damage">Damaged goods</option><option value="spillage">Spillage</option><option value="expiry">Expired goods</option><option value="supplier_return">Supplier return</option><option value="staff_use">Staff use</option><option value="owner_use">Owner use</option><option value="unexplained">Unexplained shortage</option></select></label>
        <label className="field"><span>Physical disposition</span><select name="disposition"><option value="hold">Remove from sale and hold separately</option><option value="write_off">Goods consumed, missing or disposed</option></select></label>
        <label className="field"><span>Issue evidence / reason</span><input name="reason" required minLength={3} maxLength={1000} /></label>
        <Button disabled={disabled || !online || !products.length}>Submit stock issue</Button>
      </form>
    </section>
  </>;
}
