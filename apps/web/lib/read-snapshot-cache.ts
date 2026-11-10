/** Short-lived, component-owned read snapshots. Never persisted or used to authorize a write. */
export class ReadSnapshotCache<T> {
 private entries=new Map<string,{data:T;at:number;revision:string}>();
 constructor(private maxAge=15_000,private limit=12){}
 peek(key:string,revision:string):T|undefined{const entry=this.entries.get(key);return entry?.revision===revision?entry.data:undefined;}
 get(key:string,revision:string,now=Date.now()):T|undefined{
  const entry=this.entries.get(key);
  if(!entry||entry.revision!==revision||now-entry.at<0||now-entry.at>=this.maxAge)return undefined;
  return entry.data;
 }
 set(key:string,data:T,revision:string,now=Date.now()){
  this.entries.delete(key);this.entries.set(key,{data,revision,at:now});
  while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value!);
 }
 clear(){this.entries.clear();}
}
