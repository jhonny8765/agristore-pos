import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import type {Snapshot,Product} from '@agristore/domain';
import {ImportedProductReview} from '../../apps/web/components/imported-product-review';
import {InventoryWorkspace} from '../../apps/web/components/inventory-workspace';
import {HiddenProducts} from '../../apps/web/components/hidden-products';
import {command} from '../../apps/web/lib/api';
import {StoreBrand} from '../../apps/web/components/store-brand';
import {WorkspaceTabs} from '../../apps/web/components/workspace-ui';
const id=(n:number)=>'93000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ctx={organizationId:id(1),branchId:id(101)};
function Fixture(){
 const [snapshot,setSnapshot]=useState<Snapshot>(),[pane,setPane]=useState('products'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [edit,setEdit]=useState<{productId?:string;catalog:boolean;serial:number}>({catalog:false,serial:0});
 const load=async()=>setSnapshot(await command<Snapshot>('snapshot',ctx));
 useEffect(()=>{let active=true;void command<Snapshot>('snapshot',ctx).then(s=>{if(active)setSnapshot(s);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const open=(product?:Product,catalog=false)=>{setEdit(v=>({productId:product?.id,catalog,serial:v.serial+1}));setPane('review');};
 const save=async(action:string,data:Record<string,unknown>)=>{setBusy(true);try{await command(action,{...ctx,...data,requestId:crypto.randomUUID()});await load();}finally{setBusy(false);}};
 const tabs=<WorkspaceTabs label="Inventory sections" tabs={[{id:'products',label:'Products'},{id:'review',label:'Needs review'},{id:'hidden',label:'Hidden products'}]} value={pane} onChange={value=>value==='review'?open():setPane(value)}/>;
 return <div className="app-shell reference-ui"><aside className="sidebar"><StoreBrand/><nav aria-label="Main navigation"><button className="nav-item active">Inventory</button></nav></aside><div className="workspace"><header className="topbar">Magpet · TEST records in a disposable database</header><main id="main" className="main-content"><div className="page-heading"><div><h1>Inventory</h1><p>TEST only. No live business connection.</p></div></div>{error&&<p role="alert">{error}</p>}
 {snapshot&&(pane==='products'?<InventoryWorkspace products={snapshot.products} stock={new Map(snapshot.stocks.map(s=>[`${s.productId}:${s.batchId??'none'}`,s.quantity]))} canManage tabs={tabs} section="products" onEdit={p=>open(p,true)} onEditCatalog={()=>open(undefined,true)} onAdd={()=>{}}/>:pane==='hidden'?<><InventoryWorkspace products={snapshot.products} stock={new Map()} canManage tabs={tabs} section="hidden" onAdd={()=>{}} onEditCatalog={()=>open(undefined,true)}><HiddenProducts {...ctx} online={true} disabled={busy} onSave={save} onBack={()=>setPane('products')}/></InventoryWorkspace></>:<>{tabs}<ImportedProductReview key={edit.serial} initialProductId={edit.productId} showCatalog={edit.catalog} products={snapshot.products} {...ctx} disabled={busy} onSave={save}/></>)}</main></div></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
