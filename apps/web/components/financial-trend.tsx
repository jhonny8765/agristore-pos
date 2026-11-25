"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { analyticsMoney } from "../lib/sales-analytics";
import type { FinancialBucket } from "../lib/financial-overview";
import styles from "./financial-overview.module.css";

const date = new Intl.DateTimeFormat("en-PH",{month:"short",day:"numeric",timeZone:"UTC"});
const time = new Intl.DateTimeFormat("en-PH",{hour:"numeric",minute:"2-digit",timeZone:"UTC"});
const compact = new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",notation:"compact",maximumFractionDigits:1});
export const financialMoney = (value:string|null) => value === null ? "Unavailable" : analyticsMoney(value);
export function financialBucketLabel(bucket:Pick<FinancialBucket,"from"|"through">) {
  if(bucket.from.includes("T")) return time.format(new Date(bucket.from+"Z"));
  const start=date.format(new Date(bucket.from+"T00:00:00Z"));
  return bucket.through===bucket.from?start:start+" – "+date.format(new Date(bucket.through+"T00:00:00Z"));
}

export const financialMetrics={gross:"Gross sales",expenses:"Expenses",profit:"Operating profit"} as const;
type Metric=keyof typeof financialMetrics;
const colors:Record<Metric,string>={gross:"#21734b",expenses:"#a85a20",profit:"#256470"};

export function FinancialTrend({buckets,metric,selected,onSelect}:{buckets:FinancialBucket[];metric:Metric;selected:number;onSelect:(index:number)=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(640);
  useEffect(()=>{
    if(!root.current)return;
    const observer=new ResizeObserver(entries=>setWidth(Math.max(245,Math.round(entries[0].contentRect.width))));
    observer.observe(root.current);
    return ()=>observer.disconnect();
  },[]);
  const values=buckets.map(bucket=>bucket[metric]===null?null:Number(bucket[metric]));
  const known=values.filter((value):value is number=>value!==null);
  const lowest=Math.min(0,...known),highest=Math.max(0,...known);
  const desired=(highest-lowest)/4||100;
  const magnitude=10**Math.floor(Math.log10(desired));
  const step=([1,2,2.5,5,10].find(n=>n*magnitude>=desired)??10)*magnitude;
  const lower=Math.floor(lowest/step)*step,upper=Math.ceil(highest/step)*step;
  const left=64,right=width-18,top=15,bottom=158;
  const x=(index:number)=>buckets.length===1?(left+right)/2:left+index*(right-left)/(buckets.length-1);
  const y=(value:number)=>upper===lower?(value===0?bottom:top):bottom-(value-lower)*(bottom-top)/(upper-lower);
  const stride=Math.max(1,Math.ceil(buckets.length/(width>=530?7:4)));
  const path=values.map((value,i)=>value===null?"":(i>0&&values[i-1]!==null?"L":"M")+x(i)+","+y(value)).join(" ");
  const tickCount=Math.round((upper-lower)/step)+1;
  function pick(event:MouseEvent<SVGSVGElement>) {
    const bounds=event.currentTarget.getBoundingClientRect();
    const point=((event.clientX-bounds.left)*width/bounds.width-left)/(right-left);
    onSelect(Math.max(0,Math.min(buckets.length-1,Math.round(point*(buckets.length-1)))));
  }
  const bucket=buckets[selected];
  return <div ref={root}>
    {known.length===0 ? <p className={styles.chartEmpty}>This metric is unavailable for the selected dates.</p> :
      <svg className={styles.chart} viewBox={`0 0 ${width} 190`} preserveAspectRatio="none" role="img"
        aria-label={financialMetrics[metric]+" by period. Use Previous and Next or the timeline table for exact figures."} onClick={pick}>
        {Array.from({length:tickCount},(_,i)=>{
          const amount=lower+i*step;
          return <g key={i}>
            <line x1={left} x2={right} y1={y(amount)} y2={y(amount)} stroke="#dce6dd"/>
            <text x={left-7} y={y(amount)+4} textAnchor="end" fontSize="12" fill="#53685b">{compact.format(amount/100)}</text>
          </g>;
        })}
        <line x1={x(selected)} x2={x(selected)} y1={top} y2={bottom} stroke="#82968a" strokeDasharray="3 4"/>
        <path d={path} fill="none" stroke={colors[metric]} strokeWidth="2.5"/>
        {buckets.map((entry,i)=><g key={entry.from}>
          {values[i]!==null && <circle cx={x(i)} cy={y(values[i]!)} r={i===selected?5:2.7}
            fill={i===selected?"white":colors[metric]} stroke={colors[metric]} strokeWidth="2">
            <title>{financialBucketLabel(entry)+" · "+financialMoney(entry[metric])}</title>
          </circle>}
          {(i===0||i===buckets.length-1||i%stride===0&&buckets.length-1-i>=stride) &&
            <text x={x(i)} y={bottom+23} fill="#53685b" fontSize="12" textAnchor={buckets.length===1?"middle":i===0?"start":i===buckets.length-1?"end":"middle"}>
              {entry.from.includes("T")?financialBucketLabel(entry).replace(":00",""):date.format(new Date(entry.from+"T00:00:00Z"))}
            </text>}
        </g>)}
      </svg>}
    {bucket&&<div className={styles.inspector}>
      <p aria-live="polite">{financialBucketLabel(bucket)} · {financialMetrics[metric]} <strong>{financialMoney(bucket[metric])}</strong></p>
      <div><button type="button" disabled={selected===0} onClick={()=>onSelect(selected-1)}>Previous</button>
        <button type="button" disabled={selected===buckets.length-1} onClick={()=>onSelect(selected+1)}>Next</button></div>
    </div>}
  </div>;
}
