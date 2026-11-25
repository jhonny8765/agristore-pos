"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Decimal from "decimal.js";
import { analyticsMoney } from "../lib/sales-analytics";
import styles from "./sales-trend.module.css";

type TrendRow = { date: string; throughDate?: string; grossSales: string; reportedExpenses?: string };
const expenseColor = "#9a4b15";
const shortDate = (date: string) => new Date(`${date}T00:00:00+08:00`).toLocaleDateString("en-PH", {
  timeZone: "Asia/Manila", month: "short", day: "numeric",
});
const compactPesos = new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1,
});

export function SalesTrend({ rows }: { rows: TrendRow[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [selectedDate, setSelectedDate] = useState<string>();
  const gradient = useId();
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const actual = entries[0]?.contentRect.width;
      if (actual) setWidth(Math.max(240, Math.round(actual)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (!rows.length) return <div className="sales-trend-plot" ref={container}><p className={styles.empty}>Sales trend will appear when the report loads.</p></div>;

  const showExpenses = rows.some(row => row.reportedExpenses !== undefined);
  const max = rows.reduce((largest, row) =>
    Decimal.max(largest, row.grossSales, row.reportedExpenses ?? "0"), new Decimal(100));
  const compact = width < 420;
  const left = compact ? 59 : Math.min(150, Math.max(82, analyticsMoney(max.toFixed(0)).length * 7 + 8));
  const right = width - (compact ? 20 : 28);
  const bottom = 200;
  const height = 168;
  const y = (amount: string) => bottom - new Decimal(amount).div(max).mul(height).toNumber();
  const points = rows.map((row, index) => ({
    ...row,
    x: rows.length === 1 ? (left + right) / 2 : left + index * (right - left) / (rows.length - 1),
  }));
  const focusIndex = points.findIndex(row => row.date === selectedDate);
  const lastActiveIndex = points.findLastIndex(row => row.grossSales !== "0" || (row.reportedExpenses ?? "0") !== "0");
  const index = focusIndex >= 0 ? focusIndex : lastActiveIndex >= 0 ? lastActiveIndex : points.length - 1;
  const focus = points[index];
  const series = (value: (row: TrendRow) => string) =>
    points.map((point, i) => `${i ? "L" : "M"}${point.x},${y(value(point))}`).join(" ");
  const gross = series(row => row.grossSales);
  const expenses = showExpenses ? series(row => row.reportedExpenses ?? "0") : "";
  const area = `${gross} L${points.at(-1)!.x},${bottom} L${points[0].x},${bottom} Z`;
  const labelStep = Math.max(1, Math.ceil(points.length / (compact ? 2 : 5)));

  function pickPoint(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * width / bounds.width;
    const closest = rows.length === 1 ? 0 : Math.round((x - left) / (right - left) * (points.length - 1));
    setSelectedDate(points[Math.min(points.length - 1, Math.max(0, closest))].date);
  }

  return <div className="sales-trend-plot" ref={container}>
    <div className={styles.legend}>
      <span><i aria-hidden="true"/>Gross sales</span>
      {showExpenses && <span className={styles.expenses}><i aria-hidden="true"/>Notebook expenses</span>}
    </div>
    <svg viewBox={`0 0 ${width} 234`} preserveAspectRatio="none" role="img" onClick={pickPoint}
      aria-label={showExpenses ? "Gross sales and reported notebook expenses by period" : "Gross sales trend. Exact figures are available in the sales trend details table."}>
      <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#8cc75b" stopOpacity=".42"/>
        <stop offset="100%" stopColor="#8cc75b" stopOpacity=".06"/>
      </linearGradient></defs>
      <rect x={left} y={28} width={right-left} height={bottom-28} fill="transparent"/>
      {[0, 1, 2, 3, 4].map(tick => {
        const scaleY = bottom - tick * height / 4;
        const amount = max.mul(tick).div(4);
        return <g key={tick}>
          <line x1={left} x2={right} y1={scaleY} y2={scaleY} stroke="var(--line)"/>
          <text x={left - 8} y={scaleY + 4} textAnchor="end" fill="var(--muted)" fontSize={compact ? 13 : 15}>
            {compact ? compactPesos.format(amount.div(100).toNumber()) : analyticsMoney(amount.toFixed(0))}
          </text>
        </g>;
      })}
      <path d={area} fill={`url(#${gradient})`}/>
      <line x1={focus.x} x2={focus.x} y1={28} y2={bottom} stroke="#638371" strokeDasharray="4 4"/>
      <path d={gross} stroke="var(--green)" strokeWidth="3" fill="none"/>
      {expenses && <path d={expenses} stroke={expenseColor} strokeWidth="2.5" strokeDasharray="5 4" fill="none"/>}
      {points.map((point, i) => <g key={point.date}>
        <circle cx={point.x} cy={y(point.grossSales)} r={i === index ? 5 : 3.5} fill="white" stroke="var(--green)" strokeWidth="2">
          <title>{point.date} · Gross sales {analyticsMoney(point.grossSales)}</title>
        </circle>
        {point.reportedExpenses && point.reportedExpenses !== "0" &&
          <circle cx={point.x} cy={y(point.reportedExpenses)} r="3.5" fill={expenseColor}>
            <title>{point.date} · Notebook expenses {analyticsMoney(point.reportedExpenses)}</title>
          </circle>}
        {(i === 0 || i === points.length - 1 || (i % labelStep === 0 && points.length - i > labelStep / 2)) &&
          <text x={point.x} y={bottom + 23} fill="var(--muted)" fontSize={compact ? 13 : 15} textAnchor="middle">{shortDate(point.date)}</text>}
      </g>)}
    </svg>
    <div className={styles.inspector}>
      <p aria-live="polite" className={styles.reading}>
        <strong>{shortDate(focus.date)}{focus.throughDate && focus.throughDate !== focus.date ? `–${shortDate(focus.throughDate)}` : ""}</strong>
        <span><span className="sr-only">Gross sales </span>{analyticsMoney(focus.grossSales)}</span>
        {showExpenses && <span className={styles.expenseValue}><span className="sr-only">Notebook expenses </span>{analyticsMoney(focus.reportedExpenses ?? "0")}</span>}
      </p>
      {points.length > 1 && <div className={styles.controls}>
        <button type="button" aria-label="Previous chart period" disabled={!index} onClick={() => setSelectedDate(points[index-1].date)}><ChevronLeft size={18} aria-hidden="true"/></button>
        <button type="button" aria-label="Next chart period" disabled={index === points.length-1} onClick={() => setSelectedDate(points[index+1].date)}><ChevronRight size={18} aria-hidden="true"/></button>
      </div>}
    </div>
  </div>;
}
