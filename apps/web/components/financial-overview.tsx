"use client";

import { useEffect, useMemo, useState } from "react";
import type { Branch } from "@agristore/domain";
import { supabase } from "../lib/api";
import {
  financialPeriod, financialToday, groupFinancialRows, readFinancialReport, summarizeFinancialRows, validFinancialRange,
  type FinancialGrain, type FinancialRange, type FinancialReport,
} from "../lib/financial-overview";
import { financialBucketLabel, financialMetrics, financialMoney, FinancialTrend } from "./financial-trend";
import styles from "./financial-overview.module.css";

const presets={today:"Today",yesterday:"Yesterday",seven:"Last 7 days",month:"This month",custom:"Custom"} as const;
const groupNames={hour:"Hour",day:"Day",week:"Week",month:"Month"} as const;
const rows=[
  ["Gross sales","gross"],["Refunds, net of corrections","refunds"],["Net sales","net"],
  ["Cost of goods sold","cost"],["Gross profit","grossProfit"],["Operating expenses","expenses"],["Operating profit","profit"],
] as const;
const cards=[
  ["Gross sales","gross","Before refunds · Cash and credit"],
  ["Operating expenses","expenses","Recorded expenses for this period"],
  ["Gross profit","grossProfit","Net sales less cost of goods sold"],
  ["Operating profit","profit","Gross profit less operating expenses"],
] as const;
const snapshotTime=new Intl.DateTimeFormat("en-PH",{timeStyle:"short",timeZone:"Asia/Manila"});
const prettyDate=new Intl.DateTimeFormat("en-PH",{dateStyle:"long",timeZone:"UTC"});
const longDate=(date:string)=>prettyDate.format(new Date(date+"T00:00:00Z"));

export function FinancialOverview({organizationId,activeBranch,branches,online,revision}:{
  organizationId:string;activeBranch:string;branches:Branch[];online:boolean;revision:number;
}) {
  const [preset,setPreset]=useState<keyof typeof presets>("today");
  const [today,setToday]=useState(financialToday);
  const [custom,setCustom]=useState(()=>financialPeriod("today"));
  const [draft,setDraft]=useState(custom);
  const [datesOpen,setDatesOpen]=useState(false);
  const [dateError,setDateError]=useState("");
  const [branch,setBranch]=useState(activeBranch);
  const [grain,setGrain]=useState<FinancialGrain>("hour");
  const [metric,setMetric]=useState<keyof typeof financialMetrics>("gross");
  const [point,setPoint]=useState<{key:string;index:number}>();
  const [retry,setRetry]=useState(0);
  const [result,setResult]=useState<{key:string;report?:FinancialReport;error?:string}>();

  useEffect(()=>{
    const timer=setInterval(()=>setToday(financialToday()),30000);
    return ()=>clearInterval(timer);
  },[]);
  const range=useMemo(()=>preset==="custom"?custom:financialPeriod(preset,new Date(today+"T12:00:00+08:00")),[preset,custom,today]);
  const oneDay=range.from===range.through;
  const requested=oneDay&&grain==="hour"?"hour":"day";
  const scope=branch==="all"?null:branch;
  const key=JSON.stringify([organizationId,branch,range.from,range.through,requested,revision,retry]);
  useEffect(()=>{
    if(!online)return;
    let current=true;
    void (async()=>{
      try{
        const {data,error}=await supabase.rpc("owner_financial_overview",{
          p_org:organizationId,p_branch:scope,p_from:range.from,p_through:range.through,p_grain:requested,
        });
        if(error)throw Error(error.code==="42501"?"Your account does not have access to this report.":"The financial report could not be loaded.");
        const effective=requested==="hour"&&data?.grain==="day"?"day":requested;
        const report=readFinancialReport(data,range,scope,effective);
        if(requested!==effective&&!report.rows.some(row=>row.notebook))throw Error("The report grouping could not be verified.");
        if(current)setResult({key,report});
      }catch(error){
        if(current)setResult({key,error:error instanceof Error&&!error.message.startsWith("[")?error.message:"The financial report could not be verified."});
      }
    })();
    return ()=>{current=false;};
  },[key,online,organizationId,scope,range,requested]);
  const current=online&&result?.key===key?result:undefined;
  const report=current?.report;
  const totals=report?summarizeFinancialRows(report.rows):undefined;
  const grouping:FinancialGrain=oneDay?(report?.grain??requested):grain==="hour"?"day":grain;
  const buckets=report?groupFinancialRows(report.rows,range,grouping):[];
  const lastActivity=buckets.findLastIndex(bucket=>bucket.gross!=="0"||bucket.expenses!=="0"||bucket.refunds!=="0"||bucket.cost!=="0");
  const pointScope=key+":"+grouping;
  const index=point?.key===pointScope?point.index:Math.max(0,lastActivity);
  const selectPoint=(index:number)=>setPoint({key:pointScope,index});
  const label=branch==="all"?"All branches":branches.find(option=>option.id===branch)?.name??report?.branches[0]?.name??"Selected branch";

  function selectPreset(value:keyof typeof presets){
    setDatesOpen(value==="custom");
    setDateError("");
    if(value==="custom"){setDraft(range);return;}
    setPreset(value);
    setGrain(value==="today"||value==="yesterday"?"hour":"day");
    setPoint(undefined);
  }

  return <section className={styles.overview} aria-label="Owner financial overview">
    <header><h2 className={styles.heading}>Sales overview</h2>
      <p className={styles.context}>{label} · {longDate(range.from)}{!oneDay&&" – "+longDate(range.through)} · Philippine time</p>
    </header>
    <div className={styles.filters}>
      <label className={styles.field}>Branch
        <select value={branch} onChange={event=>{setBranch(event.target.value);setPoint(undefined);}}>
          <option value="all">All branches</option>
          {!branches.some(option=>option.id===activeBranch)&&<option value={activeBranch}>Current branch</option>}
          {branches.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      <div><span className={styles.fieldLabel}>Date range</span><div className={styles.choices} role="group" aria-label="Date range">
        {Object.entries(presets).map(([key,label])=><button type="button" key={key} aria-pressed={key==="custom"?datesOpen:key===preset}
          onClick={()=>selectPreset(key as keyof typeof presets)}>{label}</button>)}
      </div></div>
      {datesOpen&&<form className={styles.custom} onSubmit={event=>{
        event.preventDefault();
        if(!validFinancialRange(draft,today)){setDateError("Choose an ordered range of up to 366 days through today.");return;}
        setCustom(draft);setPreset("custom");setGrain(draft.from===draft.through?"hour":"day");setPoint(undefined);setDateError("");
      }}>
        <label className={styles.field}>From<input type="date" required max={today} value={draft.from} onChange={event=>setDraft({...draft,from:event.target.value})}/></label>
        <label className={styles.field}>Through<input type="date" required max={today} value={draft.through} onChange={event=>setDraft({...draft,through:event.target.value})}/></label>
        <button type="submit">Apply dates</button>
        {dateError&&<p role="alert">{dateError}</p>}
      </form>}
    </div>
    {!online&&<p className="notice">Reconnect to load confirmed sales and expenses. Pending offline sales appear after sync.</p>}
    {online&&!current&&<p role="status" className="notice">Loading financial overview…</p>}
    {current?.error&&<div role="alert" className="notice error"><p>{current.error}</p>
      <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry report</button></div>}
    {report&&totals&&<>
      <div className={styles.cards} aria-label="Financial totals">
        {cards.map(([label,metric,description])=><article key={metric} className={metric==="profit"?styles.primary:undefined}>
          <span>{label}</span><strong>{financialMoney(totals[metric])}</strong><p>{description}</p>
        </article>)}
      </div>
      {totals.overlap?<p className={styles.warning} role="status">Some dates have both POS and notebook records. Those dates use POS figures where available pending reconciliation. Profit is unavailable for this selection.</p>
        :totals.notebook?<p className={styles.warning} role="status">Profit is unavailable for this selection because some notebook entries lack item costs or refund details. Recorded sales and expenses are included.</p>
        :totals.profit===null?<p className={styles.warning} role="status">Profit is unavailable because some sales or returns lack confirmed product costs or stock disposition.</p>:null}
      {!report.rows.length&&<p className={styles.context}>No confirmed sales, refunds, or expenses in this selection.</p>}
      <div className={styles.reportGrid}>
        <section className={`panel ${styles.panel}`} aria-label="Financial trend">
          <div className={styles.header}><h3>Financial trend</h3>
            <label>Group by <select value={grouping} onChange={event=>setGrain(event.target.value as FinancialGrain)} disabled={oneDay&&totals.notebook}>
              {(oneDay?(totals.notebook?["day"]:["hour","day"]):["day","week","month"]).map(key=><option value={key} key={key}>{groupNames[key as FinancialGrain]}</option>)}
            </select></label>
          </div>
          <div className={styles.choices} role="group" aria-label="Trend metric">
            {Object.entries(financialMetrics).map(([key,label])=><button type="button" key={key}
              aria-pressed={metric===key} onClick={()=>setMetric(key as keyof typeof financialMetrics)}>{label}</button>)}
          </div>
          <FinancialTrend buckets={buckets} metric={metric} selected={index} onSelect={selectPoint}/>
        </section>
        <section className={`panel ${styles.panel}`} aria-label="Profit breakdown">
          <h3>Profit breakdown</h3>
          <dl className={styles.breakdown}>{rows.map(([label,key])=><div key={key} className={key==="profit"?styles.profit:undefined}>
            <dt>{label}</dt><dd>{financialMoney(totals[key])}</dd>
          </div>)}</dl>
          <p className={styles.context}>Confirmed through {snapshotTime.format(new Date(report.asOf))}</p>
        </section>
      </div>
      {branch==="all"&&<section className={`panel ${styles.panel}`} aria-label="Branch comparison">
        <h3>Branch comparison</h3>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Branch comparison totals">
          <table className={styles.table}><thead><tr><th scope="col">Branch</th><th scope="col">Gross sales</th><th scope="col">Expenses</th><th scope="col">Operating profit</th></tr></thead>
            <tbody>{report.branches.map(entry=>{
              const totals=summarizeFinancialRows(report.rows.filter(row=>row.branchId===entry.id));
              return <tr key={entry.id}><th scope="row"><button type="button" onClick={()=>{setBranch(entry.id);setPoint(undefined);}}>{entry.name}</button></th>
                <td>{financialMoney(totals.gross)}</td><td>{financialMoney(totals.expenses)}</td><td>{financialMoney(totals.profit)}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </section>}
      <section className={`panel ${styles.panel}`} aria-label="Timeline breakdown">
        <div className={styles.header}><h3>Timeline breakdown</h3><p>By {groupNames[grouping].toLowerCase()}</p></div>
        <div className={`table-wrap ${styles.timeline}`} tabIndex={0} role="region" aria-label="Financial timeline totals">
          <table className={styles.table}><thead><tr><th scope="col">Period</th><th scope="col">Gross sales</th><th scope="col">Expenses</th><th scope="col">Gross profit</th><th scope="col">Operating profit</th></tr></thead>
            <tbody>{buckets.map((entry,i)=><tr key={entry.from} className={i===index?styles.selected:undefined}>
              <th scope="row"><button type="button" aria-pressed={i===index} onClick={()=>selectPoint(i)}>{financialBucketLabel(entry)}</button></th>
              <td>{financialMoney(entry.gross)}</td><td>{financialMoney(entry.expenses)}</td><td>{financialMoney(entry.grossProfit)}</td><td>{financialMoney(entry.profit)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </>}
  </section>;
}
