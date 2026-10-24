import "fake-indexeddb/auto";
import {afterEach,expect,it,vi} from "vitest";
import {applySnapshot,clearAccountCache,setSetting,setting,type PosDatabase} from "@agristore/offline";
import {requestSnapshot,supabase} from "../../apps/web/lib/api";
import {product,setupDB,uuid} from "./fixtures";
const databases: PosDatabase[]=[];
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();for(const db of databases.splice(0)){db.close();await db.delete();}});
async function local(){const db=await setupDB();databases.push(db);vi.stubGlobal('navigator',{onLine:true});return db;}

it('batches acknowledgment IDs and combines the newest stock with an earlier full catalog',async()=>{
  const db=await local();await setSetting(db,'catalogVersion','1');
  const ids=Array.from({length:1001},(_,n)=>uuid(100+n));
  const next={...product,name:'Updated feeds'};
  const rpc=vi.spyOn(supabase,'rpc').mockResolvedValueOnce({data:{asOf:'2026-10-25T01:00:00Z',products:[next],stocks:[{key:`${product.id}:none`,productId:product.id,batchId:null,quantity:'499'}],confirmedIds:ids.slice(0,1000),catalogVersion:'2',catalogUnchanged:false},error:null,count:null,status:200,statusText:'OK'} as never)
    .mockResolvedValueOnce({data:{asOf:'2026-10-25T01:00:01Z',products:[],stocks:[{key:`${product.id}:none`,productId:product.id,batchId:null,quantity:'498'}],confirmedIds:ids.slice(1000),catalogVersion:'2',catalogUnchanged:true},error:null,count:null,status:200,statusText:'OK'} as never);
  const result=await requestSnapshot(db,{organizationId:uuid(1),branchId:uuid(2),transactionIds:ids});
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[0][1]).toMatchObject({data:{catalogVersion:'1',transactionIds:ids.slice(0,1000)}});
  expect(rpc.mock.calls[1][1]).toMatchObject({data:{catalogVersion:'2',transactionIds:ids.slice(1000)}});
  expect(result.confirmedIds).toEqual(ids);expect(result.products).toEqual([next]);expect(result.catalogUnchanged).toBe(false);
  await applySnapshot(db,result);
  expect((await db.stocks.get(`${product.id}:none`))?.quantity).toBe('498');
  expect((await db.products.get(product.id))?.name).toBe('Updated feeds');
});

it('retains cached products on an unchanged catalog and removes its version on account cache reset',async()=>{
  const db=await local();await setSetting(db,'catalogVersion','1');
  vi.spyOn(supabase,'rpc').mockResolvedValue({data:{asOf:'2026-10-25T01:00:00Z',products:[],stocks:[],confirmedIds:[],catalogVersion:'1',catalogUnchanged:true},error:null,count:null,status:200,statusText:'OK'} as never);
  await applySnapshot(db,await requestSnapshot(db,{}));
  expect(await db.products.get(product.id)).toEqual(product);
  await clearAccountCache(db);expect(await setting(db,'catalogVersion')).toBeUndefined();
});

it('refuses a partial multi-request snapshot without replacing the saved catalog or stock',async()=>{
  const db=await local();
  const rpc=vi.spyOn(supabase,'rpc').mockResolvedValueOnce({data:{asOf:'2026-10-25T01:00:00Z',products:[],stocks:[],confirmedIds:[],catalogVersion:'2',catalogUnchanged:false},error:null,count:null,status:200,statusText:'OK'} as never)
    .mockResolvedValueOnce({data:null,error:{message:'TEST response interrupted'},count:null,status:503,statusText:'Unavailable'} as never);
  await expect(requestSnapshot(db,{transactionIds:Array.from({length:1001},(_,n)=>uuid(100+n))})).rejects.toThrow('response interrupted');
  expect(rpc).toHaveBeenCalledTimes(2);expect(await db.products.get(product.id)).toEqual(product);
  expect((await db.stocks.get(`${product.id}:none`))?.quantity).toBe('500');
  expect(await setting(db,'catalogVersion')).toBeUndefined();
});
