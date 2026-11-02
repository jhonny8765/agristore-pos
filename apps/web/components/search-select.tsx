"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Product } from "@agristore/domain";

export type SearchOption = { value: string; label: string; search?: string };

function optionText(node: ReactNode): string {
  return Children.toArray(node).map(part => isValidElement<{ children?: ReactNode }>(part) ? optionText(part.props.children) : String(part)).join("");
}
/** Adapts existing unit/supplier choices without changing their submitted IDs. */
export function SearchableSelect({ children, onValueChange, "aria-label": label, "aria-labelledby": labelledBy, ...props }: {
  children: ReactNode; onValueChange?: (value: string) => void; "aria-label"?: string; "aria-labelledby"?: string;
  name?: string; required?: boolean; disabled?: boolean; value?: string; defaultValue?: string;
}) {
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string; children?: ReactNode; "data-search"?: string }>(child) || !child.props.value) return [];
    return [{ value: child.props.value, label: optionText(child.props.children), search: child.props["data-search"] }];
  });
  return <SearchSelect {...props} label={label} labelledBy={labelledBy} onChange={onValueChange} options={options} />;
}
export function stockOptions(products: Product[]): SearchOption[] {
  return products.flatMap(p => (p.batches.length ? p.batches.map(b => ({ value: `${p.id}:${b.id}`, label: `${p.name} · ${b.lot} (${p.baseUnit})`, search: `${p.sku} ${("originalCode" in p ? String(p.originalCode ?? "") : "")}` })) : [{ value: `${p.id}:none`, label: `${p.name} (${p.baseUnit})`, search: `${p.sku} ${("originalCode" in p ? String(p.originalCode ?? "") : "")}` }]));
}

export function SearchSelect({ options, value, defaultValue = "", onChange, name, required, disabled, label, labelledBy, placeholder = "Type a name or code…" }: {
  options: SearchOption[]; value?: string; defaultValue?: string; onChange?: (value: string) => void;
  name?: string; required?: boolean; disabled?: boolean; label?: string; labelledBy?: string; placeholder?: string;
}) {
  const [local, setLocal] = useState(defaultValue), [query, setQuery] = useState<string | null>(null), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const selected = options.find(o => o.value === (value ?? local));
  const input = useRef<HTMLInputElement>(null), root = useRef<HTMLDivElement>(null), id = useId();
  const terms = (query ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = options.filter(o => terms.every(term => `${o.label} ${o.search ?? ""} ${o.value}`.toLocaleLowerCase().includes(term)));
  const results = matches.slice(0, 10);
  function choose(next: string) { if (input.current?.matches(":disabled")) return; setLocal(next); onChange?.(next); setQuery(null); setOpen(false); setActive(-1); }
  useEffect(() => {
    const control = input.current;
    const reset = () => { setLocal(defaultValue); setQuery(null); setOpen(false); setActive(-1); };
    control?.form?.addEventListener("reset", reset);
    return () => control?.form?.removeEventListener("reset", reset);
  }, [defaultValue]);
  useEffect(() => { input.current?.setCustomValidity(!selected && (required || !!query?.trim()) ? "Choose a matching result from the list." : ""); }, [required, selected, query]);
  useEffect(() => { if (open && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [open, active, id]);
  return <div className="search-select" ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { setOpen(false); setActive(-1); } }}>
    <input ref={input} role="combobox" aria-label={label} aria-labelledby={labelledBy} aria-autocomplete="list" aria-expanded={open && !disabled} aria-controls={`${id}-options`} aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
      autoComplete="off" placeholder={placeholder} required={required} disabled={disabled} value={query ?? selected?.label ?? ""}
      onFocus={() => { setOpen(true); setActive(-1); }} onClick={() => setOpen(true)}
      onChange={e => { setQuery(e.target.value); setLocal(""); onChange?.(""); setOpen(true); setActive(-1); }}
      onKeyDown={e => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); setActive(n => results.length ? Math.max(0, Math.min(results.length - 1, n + (e.key === "ArrowDown" ? 1 : -1))) : -1); }
        if (e.key === "Escape") { e.preventDefault(); setOpen(false); setActive(-1); }
        if (e.key === "Enter" && open) { e.preventDefault(); if (results[active]) choose(results[active].value); }
      }} />
    {name && <input type="hidden" name={name} value={selected?.value ?? ""} disabled={disabled} />}
    {open && !disabled && <div className="search-select-popup">
      <div id={`${id}-options`} role="listbox" aria-label={label ?? "Matching choices"}>
        {results.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={selected?.value === option.value} className={index === active ? "active" : ""} onPointerDown={e => e.preventDefault()} onClick={() => { choose(option.value); input.current?.focus(); }}>{option.label}</div>)}
      </div>
      <small role="status">{!matches.length ? "No matches. Try another name or code." : matches.length > 10 ? `10 of ${matches.length} matches. Type more letters to narrow the list.` : `${matches.length} match${matches.length === 1 ? "" : "es"}. Choose a result.`}</small>
    </div>}
  </div>;
}
