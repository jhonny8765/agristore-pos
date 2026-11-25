"use client";
import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Button} from './ui/button';
export function useAppUpdateReady(registration?:ServiceWorkerRegistration) {
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  if(!registration){setReady(false);return;}
  const workers=new Set<ServiceWorker>();
  const check=()=>setReady(!!registration.waiting);
  const watch=()=>{
   check();
   for(const worker of [registration.installing,registration.waiting]){
    if(!worker||workers.has(worker))continue;
    workers.add(worker);
    worker.addEventListener('statechange',check);
   }
  };
  registration.addEventListener('updatefound',watch);
  navigator.serviceWorker.addEventListener('controllerchange',watch);
  watch();
  return()=>{
   registration.removeEventListener('updatefound',watch);
   navigator.serviceWorker.removeEventListener('controllerchange',watch);
   workers.forEach(worker=>worker.removeEventListener('statechange',check));
  };
 },[registration]);
 return ready;
}

export function AppUpdateNotice({onOpen}:{onOpen:()=>void}){
 return <div className="app-update-notice" role="status"><RefreshCw size={18}/><span>A POS update is ready to install.</span><Button size="sm" variant="outline" onClick={onOpen}>Open update settings</Button></div>;
}
