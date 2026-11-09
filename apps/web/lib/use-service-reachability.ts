"use client";
import {useEffect,useState} from "react";

export type ServiceReachability = "checking" | "available" | "unavailable" | "offline";

/** Health is independent of the browser's online flag and of session/queue sync. */
export function useServiceReachability(online:boolean, enabled:boolean):ServiceReachability {
  const [status,setStatus]=useState<ServiceReachability>("checking");
  useEffect(()=>{
    if(!enabled){setStatus("checking");return;}
    if(!online){setStatus("offline");return;}
    let active=true;
    const check=async()=>{
      if(document.visibilityState==="hidden")return;
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6000);
      try {
        const response=await fetch("/api/health",{cache:"no-store",signal:controller.signal});
        const body:unknown=await response.json();
        const healthy=response.ok && typeof body==="object" && body!==null && "status" in body && body.status==="ok";
        if(active)setStatus(healthy?"available":"unavailable");
      } catch {if(active)setStatus("unavailable");}
      finally {clearTimeout(timeout);}
    };
    void check();
    const poll=setInterval(()=>void check(),60_000);
    const onVisible=()=>{if(document.visibilityState==="visible")void check();};
    document.addEventListener("visibilitychange",onVisible);
    return ()=>{active=false;clearInterval(poll);document.removeEventListener("visibilitychange",onVisible);};
  },[online,enabled]);
  return status;
}
