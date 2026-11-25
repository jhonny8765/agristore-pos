"use client";

import type { ReactNode } from "react";
import { Banknote, Coins, ReceiptText, ShoppingCart, Package } from "lucide-react";
import type { Product } from "@agristore/domain";
import { WorkspaceStat } from "./workspace-ui";
import { SalesTrend } from "./sales-trend";
import { ProductPhoto } from "./product-photo";
import styles from "./overview-dashboard.module.css";

export type OverviewProduct = { id: string; name: string; quantity: string; baseUnit: string; amount: string; product?: Product };

export function OverviewDashboard({ figures, trend, topProducts, attention, accounts, activity, scope, toolbar, dailyReport, reportedExpenses, dateRange, includesNotebookSales, notices }: {
  figures: [string, string, string];
  trend: { date: string; throughDate?: string; grossSales: string; reportedExpenses?: string }[];
  topProducts: OverviewProduct[];
  attention?: ReactNode;
  accounts?: ReactNode;
  activity: ReactNode;
  scope: string;
  toolbar?: ReactNode;
  dailyReport?: ReactNode;
  reportedExpenses?: string;
  dateRange?: string;
  includesNotebookSales?: boolean;
  notices?: ReactNode;
}) {
  return (
    <div className={`overview-dashboard ${styles.dashboard}`}>
      <header className={styles.header}>
        <div>
          <h2>Sales overview</h2>
          {dateRange && <p className={styles.dateRange}>{dateRange}</p>}
        </div>
        {toolbar && <div className={`analytics-toolbar ${styles.toolbar}`}>{toolbar}</div>}
      </header>
      {notices}
      <div className={`workspace-stats ${styles.metrics}`} aria-label="Sales totals" data-with-expenses={reportedExpenses !== undefined}>
        <WorkspaceStat icon={Coins} label="Gross sales" value={figures[0]} detail={includesNotebookSales ? "POS receipts and notebooks" : undefined} />
        <WorkspaceStat icon={ShoppingCart} label={reportedExpenses === undefined ? "Completed sales" : "Completed POS sales"} value={figures[1]} />
        <WorkspaceStat icon={Banknote} label={reportedExpenses === undefined ? "Net sales" : "Net POS sales"} value={figures[2]} detail="After refund cash and recoveries" />
        {reportedExpenses !== undefined && <WorkspaceStat icon={ReceiptText} label="Notebook expenses" value={reportedExpenses} />}
      </div>
      <div className={styles.trendGrid} data-with-attention={Boolean(attention)}>
        <section className={`panel ${styles.trendCard}`}>
          <h2>Sales trend</h2>
          <div role="region" aria-label="Gross sales trend" tabIndex={0}><SalesTrend rows={trend} /></div>
          <p className={styles.source}>{scope}</p>
        </section>
        {attention}
      </div>
      <div className={styles.detailGrid} data-with-notebooks={Boolean(dailyReport)}>
        {dailyReport}
        <section className={`panel overview-top-products ${styles.productCard}`}>
          <h2>{includesNotebookSales ? "Top-selling products from POS receipts" : "Top-selling products"}</h2>
          {topProducts.length ? <div className="table-wrap" role="region" aria-label="Top-selling products" tabIndex={0}>
            <table>
              <thead><tr><th scope="col">Product</th><th scope="col">Units sold</th><th scope="col">Sales</th></tr></thead>
              <tbody>{topProducts.slice(0, 3).map(product => (
                <tr key={product.id}>
                  <td><div className="product-cell">{product.product ? <ProductPhoto product={product.product} /> : <Package size={18} aria-hidden="true" />}<strong>{product.name}</strong></div></td>
                  <td>{product.quantity} {product.baseUnit}</td><td>{product.amount}</td>
                </tr>
              ))}</tbody>
            </table>
          </div> : <p className="muted">No product sales in this report.</p>}
        </section>
      </div>
      <section className={`panel overview-branch-activity ${styles.branchCard}`}><h2>Branch activity</h2>{activity}</section>
      {accounts && <details className={`extra-registers ${styles.accounts}`}><summary>Customer &amp; supplier balances</summary>{accounts}</details>}
    </div>
  );
}
