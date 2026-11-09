"use client";
import { Children, Fragment, isValidElement, useEffect, useId, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function useBusinessClock(){const [now,setNow]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);return now;}

export function WorkspaceTabs({label,tabs,value,onChange}:{label:string;tabs:{id:string;label:string;icon?:LucideIcon}[];value:string;onChange:(id:string)=>void}) {
 const id=useId();
 return <div className="workspace-tabs" role="tablist" aria-label={label} onKeyDown={e=>{const current=tabs.findIndex(t=>t.id===value);const next=e.key==='ArrowRight'?(current+1)%tabs.length:e.key==='ArrowLeft'?(current+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;if(next>=0){e.preventDefault();onChange(tabs[next].id);document.getElementById(`${id}-${next}`)?.focus();}}}>{tabs.map((tab,n)=><button id={`${id}-${n}`} type="button" role="tab" key={tab.id} aria-selected={value===tab.id} tabIndex={value===tab.id?0:-1} onClick={()=>onChange(tab.id)}>{tab.icon&&<tab.icon size={23} aria-hidden="true"/>}{tab.label}</button>)}</div>;
}
export function WorkspaceStat({icon:Icon,label,value,detail}:{icon:LucideIcon;label:string;value:ReactNode;detail?:ReactNode}) {
 return <div className={`workspace-stat ${typeof value==='string'&&value.length>11?'wide-value':''}`}><span className="workspace-stat-icon"><Icon size={25} aria-hidden="true"/></span><div><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div></div>;
}
export function nodeText(node:ReactNode):string {return Children.toArray(node).map(n=>isValidElement<{children?:ReactNode}>(n)?nodeText(n.props.children):typeof n==='string'||typeof n==='number'?String(n):'').join('');}
export function sectionTitle(node:ReactNode):string {
 if(!isValidElement<{children?:ReactNode}>(node))return '';
 if(node.type==='h2')return nodeText(node.props.children);
 for(const c of Children.toArray(node.props.children)){const title=sectionTitle(c);if(title)return title;}return '';
}
/** Preserve each original form and its authorization closures while changing presentation. */
export function workspaceSections(node:ReactNode):{key:string;title:string;content:ReactNode}[] {
 const sections:{key:string;title:string;content:ReactNode}[]=[];
 function visit(children:ReactNode,path:string){Children.forEach(children,(child,n)=>{if(!isValidElement<{children?:ReactNode}>(child))return;const key=`${path}-${n}`;
  if(child.type==='section'){sections.push({key,title:sectionTitle(child),content:child});return;}
  if(child.type===Fragment||child.type==='div'){visit(child.props.children,key);return;}
  sections.push({key,title:sectionTitle(child),content:child});
 });}visit(node,'panel');return sections;
}
