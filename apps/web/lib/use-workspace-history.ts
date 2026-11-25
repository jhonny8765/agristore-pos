"use client";
import {useEffect,useRef,type Dispatch,type SetStateAction} from 'react';

/** Keep navigation in this signed-in branch without persisting financial drafts. */
export function useWorkspaceHistory<T extends string>(view:T,setView:Dispatch<SetStateAction<T>>,scope:string|undefined,available:T[],fallback:T){
 const initialized=useRef<string|undefined>(undefined),availableKey=available.join(',');
 useEffect(()=>{
  if(!scope){initialized.current=undefined;return;}
  const allowed=availableKey.split(',');
  const write=(next:string,replace:boolean)=>{
   const url=new URL(location.href);if(next==='pos')url.searchParams.delete('workspace');else url.searchParams.set('workspace',next);url.hash='';
   const state={...history.state,betterYieldWorkspace:{scope,view:next}};
   if(replace)history.replaceState(state,'',url);else history.pushState(state,'',url);
  };
  if(initialized.current!==scope){initialized.current=scope;const safe=allowed.includes(view)?view:fallback;write(String(safe),true);if(safe!==view)setView(safe);}
  const restore=()=>{
   const entry=history.state?.betterYieldWorkspace;
   const next=entry?.scope===scope&&allowed.includes(entry.view)?entry.view as T:fallback;
   if(entry?.scope!==scope||entry.view!==next)write(String(next),true);
   setView(next);
  };
  window.addEventListener('popstate',restore);
  return()=>window.removeEventListener('popstate',restore);
 },[scope,availableKey,fallback,setView,view]);
 useEffect(()=>{
  if(!scope||initialized.current!==scope||!availableKey.split(',').includes(view))return;
  const entry=history.state?.betterYieldWorkspace;
  if(entry?.scope===scope&&entry.view===view)return;
  const url=new URL(location.href);if(view==='pos')url.searchParams.delete('workspace');else url.searchParams.set('workspace',view);url.hash='';
  history.pushState({...history.state,betterYieldWorkspace:{scope,view:String(view)}},'',url);
 },[view,scope,availableKey]);
}
