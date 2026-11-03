import {createRoot} from 'react-dom/client';
import {InventoryWorkspace} from '../../apps/web/components/inventory-workspace';
import {StoreBrand} from '../../apps/web/components/store-brand';
import type {Product} from '@agristore/domain';
const products:Product[]=Array.from({length:23},(_,n)=>({id:`item-${n}`,name:`TEST Product ${String(n).padStart(2,'0')}`,sku:`TEST-${n}`,category:'TEST',baseUnit:'piece',minimumStock:'5',active:true,tracksExpiry:false,batches:[],units:[{id:`unit-${n}`,name:'Piece',factor:'1',price:(23-n)*100,cost:0,priceVersion:1}]}));
const stock=new Map(products.map((p,n)=>[p.id+':none',String(n)]));
createRoot(document.getElementById('root')!).render(<div className="app-shell reference-ui"><aside className="sidebar"><StoreBrand/></aside><div className="workspace"><header className="topbar">Magpet · TEST sorting fixture</header><main id="main"><h1>Inventory</h1><InventoryWorkspace products={products} stock={stock} canManage={false} onControls={()=>{}} onExpiry={()=>{}} onAdd={()=>{}}/></main></div></div>);
