import {expect,it} from 'vitest';
import {canApproveCount,countPage,type BlindCount} from '../../apps/web/lib/blind-counts';
const row:BlindCount={id:'a',productId:'p',batchId:null,state:'ready',reason:'TEST',createdAt:'2026-10-26T01:02:03.123456+00:00',startedBy:'first',firstCounter:'first',recounter:'second',firstCounterName:'First',recounterName:'Second',stale:false,expected:'500',counted:'499.75',recounted:'499.75',firstNotes:'TEST',recountNotes:'TEST',cancelledReason:null};
it('offers approval only to an owner who entered neither count',()=>{
 expect(canApproveCount(row,'owner',true)).toBe(true);
 for(const actor of ['first','second'])expect(canApproveCount(row,actor,true)).toBe(false);
 expect(canApproveCount(row,'owner',false)).toBe(false);
});
it('never offers stale, unfinished, disputed or cancelled evidence for adjustment',()=>{
 for(const state of ['first_count','recount','disputed','cancelled','approved'] as const)expect(canApproveCount({...row,state},'owner',true)).toBe(false);
 expect(canApproveCount({...row,stale:true},'owner',true)).toBe(false);
 expect(canApproveCount({...row,recounter:'first'},'owner',true)).toBe(false);
 expect(canApproveCount({...row,recounter:null},'owner',true)).toBe(false);
});
it('keeps exact server cursor microseconds while paging beyond fifty records',()=>{
 const page=countPage(Array.from({length:51},(_,i)=>({...row,id:String(i)})));
 expect(page.rows).toHaveLength(50);expect(page.next).toEqual({beforeAt:row.createdAt,beforeId:'49'});
 expect(countPage(page.rows).next).toBeUndefined();
});
