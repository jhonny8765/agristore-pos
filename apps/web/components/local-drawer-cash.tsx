"use client";
import {useEffect,useState} from 'react';
import {liveQuery} from 'dexie';
import type {Lease} from '@agristore/domain';
import type {PosDatabase} from '@agristore/offline';
import {localDrawerEstimate,type DrawerEstimate} from '../lib/local-drawer-cash';
import {expenseMoney} from '../lib/drawer-expense-ui';
export function LocalDrawerCash({db,lease}:{db:PosDatabase;lease:Lease}){
 const [estimate,setEstimate]=useState<DrawerEstimate>();
 useEffect(()=>{setEstimate(undefined);const subscription=liveQuery(()=>localDrawerEstimate(db,lease)).subscribe({next:setEstimate,error:()=>setEstimate({expectedCash:null,localCash:null,cloudCash:null,reason:'This drawer needs local record verification.'})});return()=>subscription.unsubscribe();},[db,lease]);
 return <section aria-label="Local drawer cash estimate" className="notice"><strong>Local drawer estimate: {estimate?.expectedCash==null?'Unknown':expenseMoney(estimate.expectedCash)}</strong>
 {estimate?.expectedCash!=null?<p>Checked cloud cash {expenseMoney(estimate.cloudCash!)} + locally paid receipts absent from that check {expenseMoney(estimate.localCash!)}. Pending receipts are counted once, even if their upload acknowledgement was lost.</p>:<p>{estimate?.reason??'Checking this drawer’s saved baseline…'}</p>}
 {estimate?.asOf&&<small>Cloud baseline checked {new Date(estimate.asOf).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}. This estimate covers this PC and drawer; count the actual cash when closing.</small>}
 </section>;
}
