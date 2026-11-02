"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {Building2,Computer,ShieldCheck,Users,Wallet} from 'lucide-react';
import {WorkspaceTabs,workspaceSections} from './workspace-ui';
import {Button} from './ui/button';

export function SettingsWorkspace({children,branchName,branchCode,cashierName,shiftOpen,cacheReady,onClose}:{children:ReactNode;branchName:string;branchCode:string;cashierName?:string;shiftOpen:boolean;cacheReady:boolean;onClose:()=>void}) {
 const [tab,setTab]=useState('general'),[detail,setDetail]=useState(''),[storage,setStorage]=useState('Checking…');
 useEffect(()=>{let active=true;if(navigator.storage?.persisted)void navigator.storage.persisted().then(v=>{if(active)setStorage(v?'Granted':'Not granted');}).catch(()=>{if(active)setStorage('Unknown');});else setStorage('Unavailable');return()=>{active=false;};},[]);
 const sections=workspaceSections(children);
 const group=(title:string)=>/Staff access/i.test(title)?'staff':/cashier PCs/i.test(title)?'devices':/Application|recovery/i.test(title)?'application':/Cashier shift/i.test(title)?'shift':/^Branch/.test(title)?'branch':'guide';
 const tabs=[{id:'general',label:'General'},...(sections.some(s=>group(s.title)==='staff')?[{id:'staff',label:'Staff access'}]:[]),...(sections.some(s=>group(s.title)==='devices')?[{id:'devices',label:'Cashier PCs'}]:[]),{id:'application',label:'Application & recovery'},{id:'guide',label:'Store guide'}];
 return <div className="settings-workspace"><WorkspaceTabs label="Store settings" tabs={tabs} value={tab} onChange={id=>{setTab(id);setDetail('');}}/>
 <div hidden={tab!=='general'}><div className="settings-overview-grid"><section className="panel"><h2><Building2 size={25}/>Branch</h2><dl className="detail-list"><div><dt>Branch name</dt><dd>{branchName}</dd></div><div><dt>Branch code</dt><dd>{branchCode}</dd></div><div><dt>Timezone</dt><dd>Asia/Manila</dd></div><div><dt>Sales mode</dt><dd>Cash sales only</dd></div></dl><Button variant="ghost" onClick={()=>setDetail(detail==='branch'?'':'branch')}>View branch details</Button></section>
 <section className="panel"><h2><Wallet size={25}/>Cashier shift</h2><span className={`status-tag ${shiftOpen?'good':''}`}>{shiftOpen?'Shift open':'No open shift'}</span><dl className="detail-list"><div><dt>Cashier</dt><dd>{cashierName??'No cashier shift open'}</dd></div></dl><div className="button-row"><Button variant="ghost" onClick={()=>setDetail(detail==='shift'?'':'shift')}>View shift</Button>{shiftOpen&&<Button variant="outline" onClick={onClose}>Count cash & close shift</Button>}</div></section>
 <section className="panel"><h2><Computer size={25}/>Application & recovery</h2><dl className="detail-list"><div><dt>Storage protection</dt><dd>{storage}</dd></div><div><dt>Offline files</dt><dd>{cacheReady?'Ready':'Preparing / unavailable'}</dd></div></dl><Button onClick={()=>setTab('application')}>Open application & recovery</Button><p className="muted">Keep this browser profile and site data. Export independent recovery copies.</p></section></div>
 <div className="settings-summary-links">{tabs.some(t=>t.id==='staff')&&<Button variant="outline" onClick={()=>setTab('staff')}><Users size={22}/>Manage staff access</Button>}{tabs.some(t=>t.id==='devices')&&<Button variant="outline" onClick={()=>setTab('devices')}><ShieldCheck size={22}/>Registered cashier PCs</Button>}</div></div>
 {sections.map(s=><div key={s.key} hidden={tab==='general'?group(s.title)!==detail:group(s.title)!==tab}>{s.content}</div>)}
 </div>;
}
