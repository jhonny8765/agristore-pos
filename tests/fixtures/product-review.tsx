import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import type {Snapshot} from '@agristore/domain';
import {ImportedProductReview} from '../../apps/web/components/imported-product-review';
import {InventoryWorkspace} from '../../apps/web/components/inventory-workspace';
import {command} from '../../apps/web/lib/api';
import {StoreBrand} from '../../apps/web/components/store-brand';
import {WorkspaceTabs} from '../../apps/web/components/workspace-ui';
const id=(n:number)=>'93000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ctx={organizationId:id(1),branchId:id(101)};
function Fixture(){const [snapshot,setSnapshot]=useState<Snapshot>(),[pane,setPane]=useState('products'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=async()=>setSnapshot(await command<Snapshot>('snapshot',ctx));
 useEffect(()=>{let active=true;void command<Snapshot>('snapshot',ctx).then(s=>{if(active)setSnapshot(s);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const tabs=<WorkspaceTabs label="Inventory sections" tabs={[{id:'products',label:'Products'},{id:'review',label:'Needs review'}]} value={pane} onChange={setPane}/>;
 return <div className="app-shell reference-ui"><aside className="sidebar"><StoreBrand/><nav aria-label="Main navigation"><button className="nav-item active">Inventory</button></nav></aside><div className="workspace"><header className="topbar">Magpet · TEST records in a disposable database</header><main id="main" className="main-content"><div className="page-heading"><div><h1>Inventory</h1><p>TEST only. No live business connection.</p></div></div>{error&&<p role="alert">{error}</p>}{snapshot&&(pane==='products'?<InventoryWorkspace products={snapshot.products} stock={new Map(snapshot.stocks.map(s=>[`${s.productId}:${s.batchId??'none'}`,s.quantity]))} canManage tabs={tabs} onReview={()=>setPane('review')} onControls={()=>{}} onExpiry={()=>{}} onAdd={()=>{}}/>:<>{tabs}<ImportedProductReview products={snapshot.products} {...ctx} disabled={busy} onSave={async(action,data)=>{setBusy(true);try{await command(action,{...ctx,...data,requestId:crypto.randomUUID()});await load();}finally{setBusy(false);}}}/></>)}</main></div></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
