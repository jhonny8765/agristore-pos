"use client";
import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Button} from './ui/button';
export function AppUpdateNotice({registration,onOpen}:{registration?:ServiceWorkerRegistration;onOpen:()=>void}){
 const [ready,setReady]=useState(false);
 useEffect(()=>{if(!registration)return;let alive=true;const workers=new Set<ServiceWorker>();const check=()=>{if(alive)setReady(!!registration.waiting);};const watch=()=>{check();const worker=registration.installing;if(worker&&!workers.has(worker)){workers.add(worker);worker.addEventListener('statechange',check);}};registration.addEventListener('updatefound',watch);watch();return()=>{alive=false;registration.removeEventListener('updatefound',watch);workers.forEach(w=>w.removeEventListener('statechange',check));};},[registration]);
 return ready?<div className="app-update-notice" role="status"><RefreshCw size={18}/><span>A POS update is ready. Finish or hold the current sale and sync saved records before updating.</span><Button size="sm" variant="outline" onClick={onOpen}>Open update settings</Button></div>:null;
}
