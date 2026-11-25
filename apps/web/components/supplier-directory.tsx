"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { command } from "../lib/api";
import { useTransientMessage } from "../lib/transient-message";
import { Button } from "./ui/button";

type Supplier = { id: string; name: string; contact: string };
type DirectoryPanel =
  | { kind: "add" }
  | { kind: "detail" | "edit" | "archive"; supplier: Supplier };
type SupplierHistoryEntry = { action: string; name: string; contact: string; at: string };
type SupplierProfile = Supplier & { archivedAt: string | null; history: SupplierHistoryEntry[] };
type SupplierAction = "create_supplier" | "update_supplier" | "archive_supplier";

const historyLabels: Record<string, string> = {
  update_supplier: "Details updated",
  archive_supplier: "Archived",
};

function SupplierHistory({ organizationId, branchId, supplier, online, onInvoices }: {
  organizationId: string;
  branchId: string;
  supplier: Supplier;
  online: boolean;
  onInvoices?: () => void;
}) {
  const [profile, setProfile] = useState<SupplierProfile>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!online) return;
    let active = true;
    void command<SupplierProfile>("supplier_profile", {
      organizationId, branchId, supplierId: supplier.id,
    }).then(
      response => { if (active) setProfile(response); },
      failure => { if (active) setError(failure instanceof Error ? failure.message : "Could not load history."); },
    );
    return () => { active = false; };
  }, [organizationId, branchId, supplier.id, online, attempt]);

  return <section className="supplier-directory-history" aria-label="Supplier history">
    <h3>History</h3>
    {onInvoices && <Button type="button" size="sm" variant="outline" onClick={onInvoices}>Purchase and payment history</Button>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {online && error && <Button type="button" size="sm" variant="outline" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry</Button>}
    {!profile && !error && <p role="status">{online ? "Loading history…" : "Connect to view supplier history."}</p>}
    {profile && (profile.history.length ? <ul className="plain-list">
      {profile.history.map((entry, index) => <li key={entry.at + ":" + index}>
        <strong>{historyLabels[entry.action] ?? "Supplier updated"}</strong>
        <small><time dateTime={entry.at}>{new Date(entry.at).toLocaleString("en-PH", {
          dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
        })}</time></small>
        <span>{entry.name}{entry.contact ? ` · ${entry.contact}` : ""}</span>
      </li>)}
    </ul> : <p>No recorded changes.</p>)}
  </section>;
}

export function SupplierDirectory({ suppliers, organizationId, branchId, online, disabled, canManage, canArchive, onSave, onHistory }: {
  suppliers: Supplier[];
  organizationId: string;
  branchId: string;
  online: boolean;
  disabled: boolean;
  canManage: boolean;
  canArchive: boolean;
  onSave: (action: string, data: Record<string, unknown>) => Promise<Error | undefined>;
  onHistory?: (supplier: { id: string; name: string }) => void;
}) {
  const [panel, setPanel] = useState<DirectoryPanel>();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useTransientMessage();
  const [showHistory, setShowHistory] = useState(false);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusTarget = useRef<HTMLButtonElement | null>(null);
  const lock = useRef(false);
  const titleId = useId();
  const historyId = useId();
  const blocked = disabled || working || !online;
  const supplier = panel && panel.kind !== "add" ? panel.supplier : undefined;
  const rows = suppliers.filter(row => !archivedIds.includes(row.id));
  const panelKind = panel?.kind;

  useEffect(() => {
    if (panelKind) {
      heading.current?.focus();
    } else if (focusTarget.current) {
      (focusTarget.current.isConnected ? focusTarget.current : heading.current)?.focus();
      focusTarget.current = null;
    }
  }, [panelKind]);

  function open(next?: DirectoryPanel, trigger?: HTMLButtonElement) {
    if (lock.current) return;
    if (trigger) focusTarget.current = trigger;
    setError("");
    setShowHistory(false);
    setPanel(next);
  }

  async function save(action: SupplierAction, data: Record<string, unknown>, onSuccess: () => void, success: string) {
    if (lock.current || blocked) return;
    lock.current = true;
    setWorking(true);
    setError("");
    setMessage("");
    try {
      const failure = await onSave(action, data);
      if (failure) {
        setError(failure.message);
        return;
      }
      onSuccess();
      setMessage(success);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save supplier.");
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }

  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const contact = String(form.get("contact") ?? "").trim();
    if (!name) { setError("Enter a supplier name."); return; }
    if (!supplier) {
      void save("create_supplier", { name, contact }, () => setPanel(undefined), "Supplier added.");
      return;
    }
    void save("update_supplier", {
      supplierId: supplier.id, expectedName: supplier.name, expectedContact: supplier.contact, name, contact,
    }, () => setPanel({ kind: "detail", supplier: { ...supplier, name, contact } }), "Supplier details saved.");
  }

  function archiveSupplier() {
    if (!supplier || !canArchive) return;
    void save("archive_supplier", {
      supplierId: supplier.id, expectedName: supplier.name, expectedContact: supplier.contact,
    }, () => {
      setArchivedIds(current => [...current, supplier.id]);
      setPanel(undefined);
    }, "Supplier archived.");
  }

  return <section className="panel supplier-directory" aria-labelledby={titleId}>
    <div hidden={!!panel}>
      <div className="section-heading">
        <h2 id={!panel ? titleId : undefined} ref={!panel ? heading : undefined} tabIndex={-1}>Suppliers</h2>
        {canManage && <Button type="button" size="sm" variant="outline" disabled={blocked} onClick={event => open({ kind: "add" }, event.currentTarget)}>
          <Plus size={16} aria-hidden="true"/>Add supplier
        </Button>}
      </div>
      {rows.length ? <ul className="supplier-directory-list">
        {rows.map(row => <li key={row.id}>
          <button type="button" className="record-link" onClick={event => open({ kind: "detail", supplier: row }, event.currentTarget)}>{row.name}</button>
          {canArchive && <Button type="button" variant="ghost" size="icon" disabled={blocked} aria-label={`Archive ${row.name}`} onClick={event => open({ kind: "archive", supplier: row }, event.currentTarget)}>
            <X size={18} aria-hidden="true"/>
          </Button>}
        </li>)}
      </ul> : <p>No suppliers added yet.</p>}
    </div>
    {panel && <>
      <Button type="button" variant="ghost" size="sm" disabled={working} onClick={() => open()}>
        <ArrowLeft size={16} aria-hidden="true"/>Back to suppliers
      </Button>
      <h2 id={titleId} ref={heading} tabIndex={-1}>
        {panel.kind === "add" ? "Add supplier" : panel.kind === "archive" ? `Archive ${panel.supplier.name}?` : panel.supplier.name}
      </h2>
    </>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {(panel?.kind === "add" || panel?.kind === "edit") && <form className="supplier-directory-form" onSubmit={saveDetails}>
      <fieldset disabled={blocked || !canManage}>
        <label className="field"><span>Supplier name</span><input name="name" required maxLength={180} defaultValue={supplier?.name}/></label>
        <label className="field"><span>Contact details</span><textarea name="contact" rows={2} maxLength={1000} defaultValue={supplier?.contact}/></label>
      </fieldset>
      <div className="supplier-directory-actions">
        <Button type="submit" size="sm" disabled={blocked || !canManage}>{working ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" size="sm" disabled={working} onClick={() => open(supplier ? { kind: "detail", supplier } : undefined)}>Cancel</Button>
      </div>
    </form>}
    {panel?.kind === "archive" && <div className="supplier-directory-actions">
      <Button type="button" size="sm" variant="destructive" disabled={blocked || !canArchive} onClick={archiveSupplier}>
        {working ? "Archiving…" : "Confirm archive"}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => open()}>Cancel</Button>
    </div>}
    {panel?.kind === "detail" && <>
      <dl className="supplier-directory-contact"><div><dt>Contact details</dt><dd>{panel.supplier.contact || "No contact details"}</dd></div></dl>
      <div className="supplier-directory-actions">
        {canManage && <Button type="button" variant="outline" size="sm" disabled={blocked} onClick={() => open({ kind: "edit", supplier: panel.supplier })}>Edit</Button>}
        <Button type="button" variant="outline" size="sm" aria-expanded={showHistory} aria-controls={historyId} onClick={() => setShowHistory(value => !value)}>History</Button>
      </div>
      <div id={historyId} hidden={!showHistory}>
        {showHistory && <SupplierHistory key={panel.supplier.id} supplier={panel.supplier} organizationId={organizationId} branchId={branchId} online={online}
          onInvoices={onHistory ? () => onHistory({ id: panel.supplier.id, name: panel.supplier.name }) : undefined}/>}
      </div>
    </>}
  </section>;
}
