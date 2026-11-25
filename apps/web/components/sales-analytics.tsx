"use client";
import { RecordTable } from "./record-pages";
import {useCallback,useEffect,useId,useMemo,useRef,useState,type ReactNode} from "react";
import type {Product} from "@agristore/domain";
import { OverviewDashboard } from "./overview-dashboard";
import {command} from "../lib/api";
import type { notebookSalesReport } from "./notebook-sales-summary";
import {analyticsCsv,analyticsDateLabel as dateLabel,analyticsMoney,combineNotebookSales,popularProducts,readSalesAnalytics,validateAnalyticsFilters,type NotebookSalesRow,type SalesAnalytics as Report,type SalesFilters,type SalesInterval,type SalesPeriod,type SalesTrend} from "../lib/sales-analytics";
import {Button} from "./ui/button";
import { CalendarDays, ChevronDown, Download } from "lucide-react";
import styles from "./sales-analytics.module.css";

const periods:{value:SalesPeriod;label:string}[]=[{value:"today",label:"Today"},{value:"week",label:"This week"},{value:"last_week",label:"Last week"},{value:"month",label:"This month"},{value:"last_month",label:"Last month"},{value:"year",label:"Last 12 months"},{value:"custom",label:"Choose dates"}];
function download(name:string,contents:string){const url=URL.createObjectURL(new Blob([contents],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

type NotebookReport = { rows: NotebookSalesRow[]; receiptDays?: SalesTrend[]; message: string };

export function SalesAnalytics({organizationId,branchId,branchName,online,disabled,revision,attention,accounts,activity,branchControl,reportRegister,catalog=[],notebookSummary}:{catalog?:Product[];attention?:ReactNode;accounts?:ReactNode;activity:ReactNode;branchControl:ReactNode;reportRegister:(reports:{popular:ReactNode;periodTotals:ReactNode})=>ReactNode;organizationId:string;branchId:string;branchName:string;online:boolean;disabled:boolean;revision:number;notebookSummary?:typeof notebookSalesReport}){
 const initial:SalesFilters={period:"month",interval:"day",fromDate:"",throughDate:""};
 const [draft,setDraft]=useState(initial),[filters,setFilters]=useState(initial),[snapshot,setSnapshot]=useState<{report:Report; notebooks?:NotebookReport}>(),[problem,setProblem]=useState<{branchId:string;message:string}>(),[loading,setLoading]=useState(false),[sort,setSort]=useState<"purchases"|"value">("purchases"),[search,setSearch]=useState("");
 const generation=useRef(0),id=useId();
 const current=snapshot?.report.branchId===branchId ? snapshot : undefined;
 const data=current?.report;
 const error=problem?.branchId===branchId ? problem.message : "";
 const setError=useCallback((message:string)=>setProblem(message?{branchId,message}:undefined),[branchId]);
 const invalidate=useCallback(()=>{generation.current++;},[]);
 const load=useCallback(async()=>{
   const request=++generation.current;
   const readReport=async (scope:SalesFilters)=>readSalesAnalytics(
     await command<unknown>("sales_analytics",{organizationId,branchId,...scope}),branchId,scope,
   );
   setLoading(true);
   setError("");
   try {
     const report=await readReport(filters);
     if(request!==generation.current)return;
     let notebooks:NotebookReport|undefined;
     if(notebookSummary) {
       notebooks={rows:[],message:""};
       try {
         notebooks.rows=await notebookSummary.load(organizationId,branchId,report.fromDate,report.throughDate);
         if(request!==generation.current)return;
         if(notebooks.rows.length) {
           notebooks.receiptDays=report.interval==="day" ? report.trend : (await readReport({
             period:"custom",interval:"day",fromDate:report.fromDate,throughDate:report.throughDate,
           })).trend;
         }
       } catch {
         notebooks.message=notebooks.rows.length
           ? "Notebook sales could not be checked against POS receipts. The graph shows POS sales and notebook expenses for this period."
           : "Notebook records could not be loaded. The graph shows POS receipts only.";
       }
     }
     if(request===generation.current)setSnapshot({report,notebooks});
   } catch(e) {
     if(request===generation.current)setError(e instanceof Error?e.message:"Could not load sales analytics. Retry online.");
   } finally {
     if(request===generation.current)setLoading(false);
   }
 },[organizationId,branchId,filters,notebookSummary,setError]);
 useEffect(()=>{if(online)void load();else setLoading(false);return invalidate;},[load,online,revision,invalidate]);
 const products=useMemo(()=>popularProducts(data?.products??[],sort,search),[data,sort,search]);

 const blocked=disabled||!online||loading;
 const notebook=notebookSummary?current?.notebooks:undefined;
 const combined=useMemo(()=>data&&notebook?.rows.length?combineNotebookSales(data.trend,notebook.rows,notebook.receiptDays):undefined,[data,notebook]);
 const trend=combined?.trend??data?.trend??[];
 const file=(kind:"products"|"trend")=>{if(data)download(`sales-${kind}-${data.fromDate}-${data.throughDate}.csv`,analyticsCsv(data,branchName,kind,combined?.trend));};
 const totals=data?.totals;
 const NotebookSummary=notebookSummary?.Summary;
 const overlappingDates=combined?.overlappingDates??[];
 const notebookMessage=notebook?.message||(overlappingDates.length
   ? `Both sources contain sales for ${overlappingDates.map(dateLabel).join(", ")}. The gross sales total uses the POS receipts for those dates.` : "");
 const dailyReport = NotebookSummary && data && notebook && <NotebookSummary
   fromDate={data.fromDate} throughDate={data.throughDate} rows={notebook.rows} message={notebookMessage}/>;
 const includesNotebookSales=Boolean(combined&&!notebook?.message);
 const dateRange=data?dateLabel(data.fromDate)+(data.fromDate===data.throughDate?"":" – "+dateLabel(data.throughDate)):undefined;
 const notices=(loading||error||!online)?<div className={styles.notices}>{loading&&<p role="status">Loading sales analytics…</p>}{error&&<div role="alert" className="notice error"><p>{error}{data&&' The report and exports still use the last loaded report.'}</p><Button variant="outline" disabled={blocked} onClick={()=>void load()}>Retry report</Button></div>}{!online&&<p className="notice">Reconnect for current sales. Pending offline sales are excluded from this report.</p>}</div>:undefined;
 return <section className={`sales-analytics-workspace ${styles.analytics}`} aria-label="Sales analytics report">
 <OverviewDashboard dateRange={dateRange} includesNotebookSales={includesNotebookSales} notices={notices} accounts={accounts} dailyReport={dailyReport} reportedExpenses={combined?analyticsMoney(combined.reportedExpenses):undefined} figures={[totals?analyticsMoney(combined?.grossSales??totals.grossSales):'—',totals?String(totals.salesCount):'—',totals?analyticsMoney(totals.netCash):'—']} trend={trend} topProducts={popularProducts(data?.products??[],"value").slice(0,3).map(p=>({id:p.id,name:p.name,quantity:p.quantity,baseUnit:p.base_unit,product:catalog.find(item=>item.id===p.id),amount:analyticsMoney(p.grossSales)}))} attention={attention} toolbar={<>{branchControl}<details className="analytics-period"><summary><CalendarDays size={16} aria-hidden="true"/>{periods.find(p=>p.value===filters.period)?.label??'Sales period'}<ChevronDown size={14} aria-hidden="true"/></summary>  <form className={styles.filters} aria-label="Sales analytics filters" onSubmit={e=>{e.preventDefault();try{validateAnalyticsFilters(draft);setFilters({...draft});setError("");}catch(e){setError(e instanceof Error?e.message:"Check the report dates.");}}}>
   <label className="field"><span id={`${id}-period`}>Sales period</span><select aria-labelledby={`${id}-period`} value={draft.period} onChange={e=>setDraft({...draft,period:e.target.value as SalesPeriod,interval:e.target.value==="year"?"month":draft.interval})}>{periods.map(p=><option value={p.value} key={p.value}>{p.label}</option>)}</select></label>
   <label className="field"><span id={`${id}-interval`}>Group sales by</span><select aria-labelledby={`${id}-interval`} value={draft.interval} onChange={e=>setDraft({...draft,interval:e.target.value as SalesInterval})}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
   {draft.period==="custom"&&<><label className="field"><span>Sales from date</span><input type="date" required value={draft.fromDate} onChange={e=>setDraft({...draft,fromDate:e.target.value})}/></label><label className="field"><span>Sales through date</span><input type="date" required value={draft.throughDate} onChange={e=>setDraft({...draft,throughDate:e.target.value})}/></label></>}
   <Button disabled={blocked}>Apply sales period</Button>
  </form>
</details><details className="overview-export"><summary><Download size={16} aria-hidden="true"/>Export</summary><div>
   <Button variant="ghost" type="button" disabled={!data||loading} onClick={()=>file("trend")}>Sales trend (CSV)</Button>
   <Button variant="ghost" type="button" disabled={!data?.products.length||loading} onClick={()=>file("products")}>Product totals (CSV)</Button>
  </div></details></>} activity={activity} scope={data?includesNotebookSales?"Confirmed POS receipts and notebook sales":"Confirmed POS receipts":"Current server report unavailable. Reconnect and refresh."}/>
 {reportRegister({
   popular: data ? (
     <section aria-label="Popular products report">
       <div className={styles.filters}>
         <label className="field"><span>Rank products by</span><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="purchases">Most purchases</option><option value="value">Highest gross sales</option></select></label>
         <label className="field"><span>Find a popular product</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Product name or SKU"/></label>
       </div>
       {products.length ? (
         <div className="table-wrap" role="region" aria-label="Popular product totals" tabIndex={0}>
           <RecordTable paginationPosition="bottom">
             <thead><tr>{["Product","Purchases","Quantity sold","Gross sales","Purchases in comparison period"].map(heading=><th scope="col" key={heading}>{heading}</th>)}</tr></thead>
             <tbody>{products.map(product=>(
               <tr key={product.id}>
                 <td><strong>{product.name}</strong><small>{product.sku}</small></td>
                 <td>{product.purchases}</td><td>{product.quantity} {product.base_unit}</td>
                 <td>{analyticsMoney(product.grossSales)}</td><td>{product.previousPurchases}</td>
               </tr>
             ))}</tbody>
           </RecordTable>
         </div>
       ) : <p>{search?"No product matches this search.":"No product sales in this period."}</p>}
     </section>
   ) : <p className="muted">Product totals will appear when the sales report loads.</p>,
   periodTotals: data ? (
     <div className="table-wrap" role="region" aria-label="Sales and refund totals by period" tabIndex={0}>
       <RecordTable paginationPosition="bottom">
         <thead><tr>{["Period",combined?"POS sales":"Purchases","Gross sales",...(combined?["Notebook expenses"]:[]),"Refund cash paid","Cash recovered",combined?"POS sales less refund cash":"Sales less refund cash"].map(heading=><th scope="col" key={heading}>{heading}</th>)}</tr></thead>
         <tbody>{trend.map(period=>(
           <tr key={period.date}>
             <td>{dateLabel(period.date)}{period.date!==period.throughDate&&` – ${dateLabel(period.throughDate)}`}</td>
             <td>{period.salesCount}</td><td>{analyticsMoney(period.grossSales)}</td>
             {combined&&<td>{"reportedExpenses" in period && typeof period.reportedExpenses==="string"?analyticsMoney(period.reportedExpenses):"—"}</td>}
             <td>{analyticsMoney(period.refunds)}</td><td>{analyticsMoney(period.recoveries)}</td>
             <td>{analyticsMoney(period.netCash)}</td>
           </tr>
         ))}</tbody>
       </RecordTable>
     </div>
   ) : <p className="muted">Period totals will appear when the sales report loads.</p>,
 })}
 </section>;
}
