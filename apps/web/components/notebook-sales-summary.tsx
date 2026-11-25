"use client";

import { supabase } from "../lib/api";
import { analyticsDateLabel as dateLabel, analyticsMoney, type NotebookSalesRow } from "../lib/sales-analytics";

async function loadNotebookSales(organizationId: string, branchId: string, fromDate: string, throughDate: string): Promise<NotebookSalesRow[]> {
  const { data, error } = await supabase.from("historical_drawer_notebooks")
    .select("business_date,gross_sales,reported_expenses,closing_cash")
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId)
    .gte("business_date", fromDate)
    .lte("business_date", throughDate)
    .order("business_date");
  if (error) throw Error("Notebook records could not be loaded.");
  const rows = data ?? [];
  if (rows.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.business_date) ||
    [row.gross_sales, row.reported_expenses, row.closing_cash].some(amount =>
      !Number.isSafeInteger(amount) || amount < 0))) throw Error("Notebook totals could not be verified.");
  return rows;
}

function NotebookSalesSummary({ fromDate, throughDate, rows, message }: {
  fromDate: string;
  throughDate: string;
  rows: NotebookSalesRow[];
  message: string;
}) {

  return <section className="panel" aria-label="Daily sales and expenses from notebooks">
    <h2>Daily sales and expenses</h2>
    <p className="scope-note">Handwritten reports for {dateLabel(fromDate)} to {dateLabel(throughDate)}.</p>
    {message && <p role="status" className="notice">{message}</p>}
    {!rows.length ? !message && <p className="muted">No notebook records in this period. Choose a date range that includes the notebook dates.</p>
      : <div className="table-wrap" role="region" aria-label="Notebook totals by business date" tabIndex={0}>
        <table>
          <thead><tr>
            <th scope="col">Business date</th>
            <th scope="col" className="numeric">Gross sales</th>
            <th scope="col" className="numeric">Reported expenses</th>
            <th scope="col" className="numeric">Closing cash</th>
          </tr></thead>
          <tbody>{rows.map(row => <tr key={row.business_date}>
            <th scope="row"><time dateTime={row.business_date}>{dateLabel(row.business_date)}</time></th>
            <td className="numeric">{analyticsMoney(String(row.gross_sales))}</td>
            <td className="numeric">{analyticsMoney(String(row.reported_expenses))}</td>
            <td className="numeric">{analyticsMoney(String(row.closing_cash))}</td>
          </tr>)}</tbody>
        </table>
      </div>}
  </section>;
}

export const notebookSalesReport = { Summary: NotebookSalesSummary, load: loadNotebookSales };
