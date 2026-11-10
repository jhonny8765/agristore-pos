import {describe,it,expect} from 'vitest';
import {ReadSnapshotCache} from '../../apps/web/lib/read-snapshot-cache';
describe('short-lived financial read snapshots',()=>{
 it('reuses only the requested scope and revision within its freshness window',()=>{
  const cache=new ReadSnapshotCache<{balance:string}>(),book={balance:'9007199254740993'};
  cache.set('org:branch:actor:register',book,'1',1000);
  expect(cache.get('org:branch:actor:register','1',15999)).toBe(book);
  expect(cache.get('other:branch:actor:register','1',1001)).toBeUndefined();
  expect(cache.get('org:branch:actor:register','2',1001)).toBeUndefined();
  expect(cache.get('org:branch:actor:register','1',16000)).toBeUndefined();
  expect(cache.peek('org:branch:actor:register','1')).toBe(book);
  expect(cache.peek('org:branch:actor:register','2')).toBeUndefined();
  expect(cache.get('org:branch:actor:register','1',999)).toBeUndefined();
 });
 it('invalidates every filter snapshot after a mutation and bounds memory',()=>{
  const cache=new ReadSnapshotCache<number>(15_000,2);cache.set('all',1,'1',0);cache.set('paid',2,'1',0);cache.set('all',3,'1',0);cache.set('owing',4,'1',0);
  expect(cache.get('paid','1',1)).toBeUndefined();expect(cache.get('all','1',1)).toBe(3);cache.clear();expect(cache.get('all','1',1)).toBeUndefined();expect(cache.get('owing','1',1)).toBeUndefined();
 });
});
