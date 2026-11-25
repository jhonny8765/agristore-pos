import Decimal from 'decimal.js';
const Exact=Decimal.clone({precision:80});
export interface ReplenishmentInputs{dailyDemand:string;leadDays:string;reviewDays:string;buffer:string;onHand:string;confirmedIncoming:string}
function quantity(value:string){
 if(!/^\d{1,12}(?:\.\d{1,6})?$/.test(value))throw Error('Enter a nonnegative quantity with up to six decimal places.');
 return new Exact(value);
}
export function suggestReplenishment(input:ReplenishmentInputs):string{
 const {dailyDemand,leadDays,reviewDays,buffer,onHand,confirmedIncoming}=input;
 return Exact.max(0,quantity(dailyDemand).mul(quantity(leadDays).plus(quantity(reviewDays))).plus(quantity(buffer)).minus(quantity(onHand)).minus(quantity(confirmedIncoming))).toFixed();
}
export function roundToPack(amount:string,pack:string):string{
 const size=quantity(pack);if(size.isZero())throw Error('Pack size must be positive.');
 if(!/^\d{1,26}(?:\.\d{1,12})?$/.test(amount))throw Error('Invalid proposed quantity.');
 return new Exact(amount).div(size).ceil().mul(size).toFixed();
}
export function createSnapshotClock(startedAt:number,startedMonotonic:number){
 let lastWall=startedAt,lastMonotonic=startedMonotonic,stale=!Number.isFinite(startedAt)||!Number.isFinite(startedMonotonic);
 return {observe(now:number,monotonic:number):boolean{
  stale=stale||!Number.isFinite(now)||!Number.isFinite(monotonic)||now<lastWall||monotonic<lastMonotonic||now-startedAt>=300000||monotonic-startedMonotonic>=300000;
  lastWall=now;lastMonotonic=monotonic;return stale;
 }};
}
export function createSnapshotReadGuard(){
 let active:ReturnType<typeof createSnapshotClock>|null=null;
 let pending:{token:number;clock:ReturnType<typeof createSnapshotClock>}|null=null;
 return {
  begin(token:number,wall:number,monotonic:number){pending={token,clock:createSnapshotClock(wall,monotonic)};},
  observe(wall:number,monotonic:number):boolean{
   const activeStale=active?active.observe(wall,monotonic):true;
   if(pending)pending.clock.observe(wall,monotonic);
   return activeStale;
  },
  succeed(token:number,wall:number,monotonic:number):boolean|null{
   if(!pending||pending.token!==token)return null;
   const isStale=pending.clock.observe(wall,monotonic);active=pending.clock;pending=null;return isStale;
  },
  fail(token:number){if(pending?.token===token)pending=null;},
 };
}
