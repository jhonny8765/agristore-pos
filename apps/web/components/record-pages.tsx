"use client";

import { Children, cloneElement, isValidElement, useId, useState, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Button } from "./ui/button";

/** Pages affect presentation only. Callers retain every record for totals and exports. */
export function RecordPages({ children, label = "Records", resetKey = "", className, render }: {
  children: ReactNode; label?: string; resetKey?: string; className?: string;
  render?: (rows: ReactNode[]) => ReactNode;
}) {
  const rows = Children.toArray(children);
  const identity = `${resetKey}:${isValidElement(rows[0]) ? rows[0].key : "empty"}`;
  const [selection, setSelection] = useState({ identity, page: 0 });
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const page = selection.identity === identity ? Math.min(selection.page, pages - 1) : 0;
  const contentId = useId();
  const change = (value: number) => setSelection({ identity, page: value });
  const controls = (position: string) => rows.length > 10 && <nav className="record-pagination" aria-label={`${label} pages ${position}`}>
    <span role="status">{page * 10 + 1}–{Math.min(rows.length, (page + 1) * 10)} of {rows.length} loaded · 10 per page</span>
    <div className="record-page-buttons">
      <Button type="button" size="sm" variant="outline" disabled={page === 0} aria-controls={contentId} onClick={() => change(page - 1)}>Previous</Button>
      <span>Page {page + 1} of {pages}</span>
      <Button type="button" size="sm" variant="outline" disabled={page === pages - 1} aria-controls={contentId} onClick={() => change(page + 1)}>Next</Button>
      {pages > 2 && <Button type="button" size="sm" variant="ghost" disabled={page === 0} aria-controls={contentId} onClick={() => change(0)}>First</Button>}
      {pages > 2 && <Button type="button" size="sm" variant="ghost" disabled={page === pages - 1} aria-controls={contentId} onClick={() => change(pages - 1)}>Last loaded</Button>}
    </div>
  </nav>;
  const visible = rows.slice(page * 10, (page + 1) * 10);
  return <div className="record-pages">{controls("above")}<div id={contentId} className={className}>{render ? render(visible) : visible}</div>{controls("below")}</div>;
}

/** Keep native table semantics; only its body rows are paged. */
export function RecordTable({ children, ...props }: ComponentProps<"table">) {
  const parts = Children.toArray(children);
  const body = parts.find(part => isValidElement(part) && part.type === "tbody") as ReactElement<{ children: ReactNode }> | undefined;
  if (!body) return <table {...props}>{children}</table>;
  return <RecordPages label="Table records" render={rows => <table {...props}>{parts.map(part => part === body ? cloneElement(body, { children: rows }) : part)}</table>}>{body.props.children}</RecordPages>;
}
