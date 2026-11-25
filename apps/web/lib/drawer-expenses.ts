import {reportQualificationColumn,type OfflineReportState} from './report-qualification';
import {historyBounds,historyCsv} from './history';
import {readSalesAnalytics,type SalesAnalytics} from './sales-analytics';
export const drawerExpenseCategories=['transport','fuel','meals','supplies','utilities','repairs','salary','miscellaneous'] as const;
export type DrawerExpenseCategory=typeof drawerExpenseCategories[number];
export const drawerExpenseActions=new Set(['record_drawer_expense','correct_drawer_expense','return_drawer_expense_cash','reconcile_drawer_expense']);
export interface DrawerExpenseInput {organizationId:string;branchId:string;deviceId:string;shiftId:string;requestId:string;amount:number;category:DrawerExpenseCategory;purpose:string;payee:string;reference:string;confirmedPaid:true}
export interface DrawerExpenseAcknowledgement {id:string;expenseId:string;organizationId:string;branchId:string;shiftId:string;deviceId:string;actorId:string;action:string;kind:string;amount:number;cashDelta:number;number:string;occurredAt:string;recordedAt:string;businessDate:string;duplicate:boolean;negativeBalance?:boolean;warning?:string}
const sameJson=(a:unknown,b:unknown):boolean=>{if(a===b)return true;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>sameJson(v,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&sameJson(x[k],y[k]));}return false;};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateDrawerExpenseInput(value:Record<string,unknown>):DrawerExpenseInput {
 const text=(key:string,min:number,max:number)=>typeof value[key]==='string'&&String(value[key]).trim().length>=min&&String(value[key]).trim().length<=max;
 if(!['organizationId','branchId','deviceId','shiftId','requestId'].every(k=>typeof value[k]==='string'&&uuid.test(value[k] as string))||!Number.isSafeInteger(value.amount)||Number(value.amount)<1||Number(value.amount)>2147483647||!drawerExpenseCategories.includes(value.category as DrawerExpenseCategory)||!text('purpose',3,500)||!text('payee',1,200)||!text('reference',0,200)||value.confirmedPaid!==true)throw Error('Enter valid drawer expense details');
 return value as unknown as DrawerExpenseInput;
}
export function verifyDrawerExpenseAcknowledgement(action:string,data:Record<string,unknown>,result:Record<string,unknown>,actorId:string):void {
 if(!drawerExpenseActions.has(action))return;
 const fail=():never=>{throw Error('The drawer expense confirmation could not be verified. Preserve the original paid-cash evidence in Sync center.');};
 const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const iso=(value:unknown):value is string=>typeof value==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
 // Verify immutable proof chains iteratively. No original action is executed,
 // and a cyclic/non-JSON response cannot bypass the leaf movement checks.
 const seen=new Set<object>();
 for(;;){
  if(!drawerExpenseActions.has(action)||!object(result)||seen.has(result))fail();seen.add(result);
  if(result.id!==data.requestId||result.organizationId!==data.organizationId||result.branchId!==data.branchId||result.actorId!==actorId||result.action!==action||typeof result.duplicate!=='boolean'||!Number.isSafeInteger(result.amount)||Number(result.amount)<0||Number(result.amount)>2147483647||!Number.isSafeInteger(result.cashDelta)||typeof result.number!=='string'||!result.number.trim()||!iso(result.occurredAt)||!iso(result.recordedAt)||typeof result.businessDate!=='string'||timeOrder(result.occurredAt)>timeOrder(result.recordedAt))fail();
  if(manilaDate(result.occurredAt as string)!==result.businessDate)fail();
  if(result.kind==='resolution'&&result.resolution!==undefined&&!(action==='reconcile_drawer_expense'&&result.resolutionId===data.requestId)){
   if(!['posted','no_payment'].includes(String(result.resolution))||result.originalAction!==action||result.originalActorId!==actorId||!sameJson(result.originalData,data)||!uuid.test(String(result.resolvedBy))||!uuid.test(String(result.resolutionId))||result.shiftId!==(data.shiftId??data.originalShiftId??null)||result.deviceId!==(data.deviceId??data.originalDeviceId??null)||!object(result.resolutionData)||!object(result.resolutionAcknowledgement))fail();
   const ownerData=result.resolutionData as Record<string,unknown>,ownerAck=result.resolutionAcknowledgement as Record<string,unknown>;
   if(ownerData.requestId!==result.resolutionId||ownerData.originalAction!==action||ownerData.originalActorId!==actorId||!sameJson(ownerData.originalData,data))fail();
   for(const key of ['expenseId','amount','cashDelta','number','occurredAt','recordedAt','businessDate','resolution','resolutionId','resolvedBy','originalAction','originalData','originalActorId','originalRequestId','outcome','eventId','originalClosedAt','committedOriginal'])if(!sameJson(result[key],ownerAck[key]))fail();
   action='reconcile_drawer_expense';data=ownerData;actorId=String(result.resolvedBy);result=ownerAck;continue;
  }
  if(action==='record_drawer_expense'){
   validateDrawerExpenseInput(data);
   if(result.expenseId!==data.requestId||result.shiftId!==data.shiftId||result.deviceId!==data.deviceId||result.kind!=='expense'||result.amount!==data.amount||result.cashDelta!==-Number(data.amount)||result.resolution!==undefined)fail();
   return;
  }
  if(action==='correct_drawer_expense'){
   if(result.resolution!==undefined||result.expenseId!==data.expenseId||result.shiftId!==data.shiftId||result.deviceId!==data.deviceId||result.kind!==data.mode||!['metadata','amount','report'].includes(String(result.kind))||typeof result.reportAdjustment!=='string'||!/^[-]?\d+$/.test(result.reportAdjustment))fail();
   if(data.mode==='metadata'&&(result.amount!==0||result.cashDelta!==0)||data.mode==='report'&&(result.amount!==data.amount||result.cashDelta!==0)||data.mode==='amount'&&(result.amount!==data.amount||BigInt(String(result.cashDelta))!==-BigInt(String(result.reportAdjustment))))fail();
   return;
  }
  if(action==='return_drawer_expense_cash'){
   if(result.resolution!==undefined||result.expenseId!==data.expenseId||result.shiftId!==data.shiftId||result.deviceId!==data.deviceId||result.kind!=='return'||result.amount!==data.amount||result.cashDelta!==data.amount)fail();
   return;
  }
  if(result.shiftId!==data.originalShiftId||result.deviceId!==data.originalDeviceId||result.resolvedBy!==actorId||result.resolutionId!==data.requestId||!['posted','no_payment'].includes(String(result.resolution))||!sameJson(result.originalData,data.originalData??null)||result.originalAction!==(data.originalAction??null)||result.originalActorId!==(data.originalActorId??null)||result.originalRequestId!==((data.originalData as Record<string,unknown>|undefined)?.requestId??null))fail();
  if(result.outcome==='committed_original'){
   const proof=result.committedOriginal as Record<string,unknown>;
   if(!object(proof)||!object(proof.result)||!object(proof.data)||proof.action!==data.originalAction||proof.actorId!==data.originalActorId||!sameJson(proof.data,data.originalData)||result.kind!=='resolution'||result.cashDelta!==0||result.originalClosedAt!==null||result.eventId!==proof.eventId||!(proof.eventId===null||uuid.test(String(proof.eventId))))fail();
   const saved=proof.result as Record<string,unknown>;
   const eventId=saved.action==='reconcile_drawer_expense'||saved.kind==='resolution'?saved.eventId:saved.id;
   if(proof.eventId!==eventId||result.amount!==saved.amount||result.expenseId!==saved.expenseId||result.resolution!==(saved.resolution??'posted'))fail();
   action=String(proof.action);data=proof.data as Record<string,unknown>;actorId=String(proof.actorId);result=saved;continue;
  }
  if(result.outcome==='no_payment'){
   if(data.actualPaid!==false||result.resolution!=='no_payment'||result.kind!=='resolution'||result.expenseId!==null||result.amount!==0||result.cashDelta!==0||result.eventId!==null||result.originalClosedAt!==null||result.committedOriginal!==null||!object(data.originalData))fail();
   return;
  }
  if(!['new_expense','new_return'].includes(String(result.outcome))||data.actualPaid!==true||result.resolution!=='posted'||result.amount!==data.amount||!Number.isSafeInteger(data.amount)||Number(data.amount)<1||result.eventId!==data.requestId||result.committedOriginal!==null||!iso(data.occurredAt)||timeOrder(result.occurredAt as string)!==timeOrder(data.occurredAt))fail();
  const isReturn=result.outcome==='new_return';
  if(result.kind!==(isReturn?'return':'expense')||result.expenseId!==(isReturn?(data.originalData as Record<string,unknown>|undefined)?.expenseId:data.requestId)||!uuid.test(String(result.expenseId))||isReturn&&data.originalAction!=='return_drawer_expense_cash'||!isReturn&&data.originalAction!==undefined&&data.originalAction!=='record_drawer_expense')fail();
  if(result.originalClosedAt===null){if(result.cashDelta!==(isReturn?Number(data.amount):-Number(data.amount)))fail();}
  else if(!iso(result.originalClosedAt)||result.cashDelta!==0||timeOrder(result.occurredAt as string)>timeOrder(result.originalClosedAt)||timeOrder(result.originalClosedAt)>timeOrder(result.recordedAt as string))fail();
  return;
 }
}
export interface DrawerClosingRestatement {shiftId:string;closedAt:string;originalExpectedCash:number|null;countedCash:number|null;originalDifference:number|null;restatedExpectedCash:number;restatedDifference:number|null}
export interface DrawerExpenseSummary {shiftId:string;openingCash:number;paymentCash:number;expenseCashOut:number;expenseCashReturned:number;expectedCash:number|null;negativeBalance:boolean|null;closingRestatement:DrawerClosingRestatement|null}

export interface DrawerExpenseResolutionAcknowledgement extends Omit<DrawerExpenseAcknowledgement,'expenseId'|'shiftId'|'deviceId'> {expenseId:string|null;shiftId:string|null;deviceId:string|null;kind:'resolution';resolution:'posted'|'no_payment';resolutionId:string;resolvedBy:string;originalAction:string;originalData:Record<string,unknown>;originalActorId:string;originalRequestId:string;outcome:DrawerExpenseOwnerAcknowledgement['outcome'];eventId:string|null;originalClosedAt:string|null;committedOriginal:DrawerExpenseCommittedProof|null;resolutionData:Record<string,unknown>;resolutionAcknowledgement:DrawerExpenseOwnerAcknowledgement}
export interface DrawerExpenseCommittedProof {action:string;data:Record<string,unknown>;actorId:string;eventId:string|null;result:Record<string,unknown>}
export interface DrawerExpenseOwnerAcknowledgement extends Omit<DrawerExpenseAcknowledgement,'expenseId'> {expenseId:string|null;resolution:'posted'|'no_payment';resolutionId:string;resolvedBy:string;originalAction:string|null;originalData:Record<string,unknown>|null;originalActorId:string|null;originalRequestId:string|null;outcome:'new_expense'|'new_return'|'no_payment'|'committed_original';eventId:string|null;originalClosedAt:string|null;committedOriginal:DrawerExpenseCommittedProof|null}
export interface DrawerExpenseCorrectionInput {organizationId:string;branchId:string;requestId:string;expenseId:string;shiftId:string;deviceId:string;mode:'metadata'|'amount'|'report';reason:string;amount?:number;category?:DrawerExpenseCategory;purpose?:string;payee?:string;reference?:string}
export interface DrawerExpenseReturnInput {organizationId:string;branchId:string;requestId:string;expenseId:string;shiftId:string;deviceId:string;amount:number;reason:string}
export interface DrawerExpenseReconciliationInput {organizationId:string;branchId:string;requestId:string;originalShiftId:string;originalDeviceId:string;actualPaid:boolean;occurredAt:string;payerEvidence:string;reference:string;reason:string;amount?:number;category?:DrawerExpenseCategory;purpose?:string;payee?:string;originalAction?:string;originalData?:Record<string,unknown>;originalActorId?:string}
export interface DrawerExpenseRootContext {expenseId:string;shiftId:string;deviceId:string;closingRestatement:DrawerClosingRestatement|null}
export interface DrawerExpenseRecord {rootContext:DrawerExpenseRootContext;id:string;expenseId:string;organizationId:string;branchId:string;shiftId:string;deviceId:string;actorId:string;rootCashierId:string;action:string;kind:'expense'|'amount'|'metadata'|'report'|'return';amount:number;cashDelta:number;reportAdjustment:string;number:string;rootNumber:string;occurredAt:string;recordedAt:string;businessDate:string;metadata:{category:DrawerExpenseCategory;purpose:string;payee:string;reference:string};reason:string|null;late:boolean;closingRestatement:DrawerClosingRestatement|null}
export interface DrawerExpenseRecordsFilters {organizationId:string;branchId:string;fromDate:string;throughDate:string;view:'original'|'restated';shiftId?:string;limit?:number;cursor?:DrawerExpenseRecordsCursor|null;export?:boolean}
export interface DrawerExpenseRecordsCursor {snapshotFence:string;occurredAt:string;id:string;asOf:string;context:{organizationId:string;branchId:string;fromDate:string;throughDate:string;view:string;shiftId:string|null;actorId:string;scope:'branch'|'cashier'}}
export interface DrawerExpenseRecords {offlineReport?:OfflineReportState;version:1;snapshotFence:string;organizationId:string;branchId:string;fromDate:string;throughDate:string;view:'original'|'restated';shiftId:string|null;exportComplete:boolean;scope:'branch'|'cashier';actorId:string;asOf:string;records:DrawerExpenseRecord[];nextCursor:DrawerExpenseRecordsCursor|null;totals:{grossExpenses:string;cashReturns:string;nonCashCorrections:string;netExpenses:string};salesAnalytics:SalesAnalytics|null;salesAfterExpenses:string|null}
const timestamp=(v:unknown):v is string=>typeof v==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
const exactInteger=(v:unknown,signed=true):v is string=>typeof v==='string'&&(signed?/^-?\d+$/:/^\d+$/).test(v);
const timeOrder=(v:string)=>BigInt(Date.parse(v))*1000n+BigInt(((v.match(/\.(\d+)/)?.[1]??'')+'000000').slice(3,6));
function manilaDate(v:string){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));}
function verifyClosing(value:DrawerClosingRestatement|null){
 if(value===null)return;
 if(!value||!uuid.test(value.shiftId)||!timestamp(value.closedAt)||!Number.isSafeInteger(value.restatedExpectedCash))throw Error('Invalid original close');
 for(const key of ['originalExpectedCash','countedCash','originalDifference','restatedDifference'] as const)if(value[key]!==null&&!Number.isSafeInteger(value[key]))throw Error('Invalid original close');
 const difference=(a:number|null,b:number|null)=>a===null||b===null?null:a-b;
 if(value.originalDifference!==difference(value.countedCash,value.originalExpectedCash)||value.restatedDifference!==difference(value.countedCash,value.restatedExpectedCash))throw Error('Invalid original close');
}
export function readDrawerExpenseRecords(value:unknown,filters:DrawerExpenseRecordsFilters,actorId:string):DrawerExpenseRecords {
 const invalid=():never=>{throw Error('Expense records could not be verified. Refresh online; keep the last verified report.');};
 try{
  const d=value as DrawerExpenseRecords;
  if(!d||d.version!==1||d.organizationId!==filters.organizationId||d.branchId!==filters.branchId||d.fromDate!==filters.fromDate||d.throughDate!==filters.throughDate||d.view!==filters.view||d.actorId!==actorId||d.shiftId!==(filters.shiftId??null)||d.exportComplete!==Boolean(filters.export)||!['branch','cashier'].includes(d.scope)||!timestamp(d.asOf)||typeof d.snapshotFence!=='string'||! /^[0-9a-f]{32}$/.test(d.snapshotFence)||filters.cursor&&(d.asOf!==filters.cursor.asOf||d.snapshotFence!==filters.cursor.snapshotFence))invalid();
  const bounds=historyBounds({from:d.fromDate,to:d.throughDate});
  if(Date.parse(bounds.to!)-Date.parse(bounds.from!)>366*86400000||d.throughDate>manilaDate(d.asOf))invalid();
  const t=d.totals;
  if(!t||![t.grossExpenses,t.cashReturns,t.nonCashCorrections,t.netExpenses].every(v=>exactInteger(v))||BigInt(t.cashReturns)<0n||BigInt(t.netExpenses)!==BigInt(t.grossExpenses)-BigInt(t.cashReturns)+BigInt(t.nonCashCorrections)||d.view==='original'&&t.nonCashCorrections!=='0')invalid();
  if(!Array.isArray(d.records)||d.records.length>(filters.export?10000:filters.limit??100))invalid();
  let previous=filters.cursor?{at:timeOrder(filters.cursor.occurredAt),id:filters.cursor.id}:null;
  const seen=new Set<string>();
  for(const r of d.records){
   if(!r||!['id','expenseId','shiftId','deviceId','actorId','rootCashierId'].every(k=>uuid.test(String(r[k as keyof DrawerExpenseRecord])))||r.organizationId!==d.organizationId||r.branchId!==d.branchId||d.scope==='cashier'&&r.rootCashierId!==actorId||filters.shiftId&&r.shiftId!==filters.shiftId||seen.has(r.id)||!drawerExpenseActions.has(r.action)||!['expense','amount','metadata','report','return'].includes(r.kind)||!Number.isSafeInteger(r.amount)||r.amount<0||r.amount>2147483647||!Number.isSafeInteger(r.cashDelta)||!exactInteger(r.reportAdjustment)||!/^EXP-\d+$/.test(r.number)||!/^EXP-\d+$/.test(r.rootNumber)||!timestamp(r.occurredAt)||!timestamp(r.recordedAt)||Date.parse(r.occurredAt)>Date.parse(r.recordedAt)||Date.parse(r.recordedAt)>Date.parse(d.asOf)||manilaDate(r.occurredAt)!==r.businessDate||r.businessDate<d.fromDate||r.businessDate>d.throughDate||typeof r.late!=='boolean'||d.view==='original'&&(r.late||r.kind==='report')||!(r.reason===null||typeof r.reason==='string')||!r.metadata||!drawerExpenseCategories.includes(r.metadata.category)||!['purpose','payee','reference'].every(k=>typeof r.metadata[k as keyof typeof r.metadata]==='string'))invalid();
   const point={at:timeOrder(r.occurredAt),id:r.id};
   if(previous&&(point.at<previous.at||point.at===previous.at&&point.id<=previous.id))invalid();
   previous=point;seen.add(r.id);verifyClosing(r.closingRestatement);
   const root=r.rootContext;
   if(!root||root.expenseId!==r.expenseId||!uuid.test(root.shiftId)||!uuid.test(root.deviceId)||r.kind!=='return'&&(root.shiftId!==r.shiftId||root.deviceId!==r.deviceId))invalid();
   verifyClosing(root.closingRestatement);
   for(const [closing,shift] of [[r.closingRestatement,r.shiftId],[root.closingRestatement,root.shiftId]] as const)if(closing&&(closing.shiftId!==shift||timeOrder(closing.closedAt)>timeOrder(d.asOf)))invalid();
  }
  if(d.nextCursor!==null){
   const c=d.nextCursor,last=d.records.at(-1);const context={organizationId:d.organizationId,branchId:d.branchId,fromDate:d.fromDate,throughDate:d.throughDate,view:d.view,shiftId:d.shiftId,actorId,scope:d.scope};
   if(!last||!c||c.id!==last.id||c.occurredAt!==last.occurredAt||c.asOf!==d.asOf||c.snapshotFence!==d.snapshotFence||!sameJson(c.context,context)||filters.export)invalid();
  }
  if(d.salesAnalytics!==null){
   if(d.scope!=='branch'||d.shiftId!==null)invalid();
   const sales=readSalesAnalytics(d.salesAnalytics,d.branchId,{period:'custom',interval:'day',fromDate:d.fromDate,throughDate:d.throughDate});
   if(sales.asOf!==d.asOf||!exactInteger(d.salesAfterExpenses)||BigInt(d.salesAfterExpenses!)!==BigInt(sales.totals.grossSales)-BigInt(sales.totals.refunds)+BigInt(sales.totals.recoveries)-BigInt(t.netExpenses))invalid();
  }else if(d.salesAfterExpenses!==null||d.scope==='branch'&&d.shiftId===null)invalid();
  if(filters.export){
   const sum={gross:0n,returns:0n,noncash:0n};for(const r of d.records){if(r.kind==='expense')sum.gross+=BigInt(r.amount);if(r.kind==='amount')sum.gross+=BigInt(r.reportAdjustment);if(r.kind==='return')sum.returns+=BigInt(r.amount);if(r.kind==='report')sum.noncash+=BigInt(r.reportAdjustment);}
   if(sum.gross!==BigInt(t.grossExpenses)||sum.returns!==BigInt(t.cashReturns)||sum.noncash!==BigInt(t.nonCashCorrections))invalid();
  }
  return d;
 }catch{return invalid();}
}
export function drawerExpenseRecordsCsv(data:DrawerExpenseRecords):string {
 if(!data.exportComplete||data.nextCursor!==null)throw Error('Request the complete expense export before saving CSV.');
 const pesos=(n:string|number)=>{const v=BigInt(n);return `${v<0n?'-':''}${(v<0n?-v:v)/100n}.${String((v<0n?-v:v)%100n).padStart(2,'0')}`;};
 return historyCsv([reportQualificationColumn(data),{label:'View',value:()=>data.view},{label:'Snapshot',value:()=>data.asOf},{label:'Expense number',value:r=>r.number},{label:'Original expense',value:r=>r.rootNumber},{label:'Business date',value:r=>r.businessDate},{label:'Occurred at',value:r=>r.occurredAt},{label:'Recorded at',value:r=>r.recordedAt},{label:'Kind',value:r=>r.kind},{label:'Category',value:r=>(r.metadata as DrawerExpenseRecord['metadata']).category},{label:'Purpose',value:r=>(r.metadata as DrawerExpenseRecord['metadata']).purpose},{label:'Payee',value:r=>(r.metadata as DrawerExpenseRecord['metadata']).payee},{label:'Reference',value:r=>(r.metadata as DrawerExpenseRecord['metadata']).reference},{label:'Amount PHP',numeric:true,value:r=>pesos(r.amount as number)},{label:'Drawer cash movement PHP',numeric:true,value:r=>pesos(r.cashDelta as number)},{label:'Report adjustment PHP',numeric:true,value:r=>pesos(r.reportAdjustment as string)},...(['originalExpectedCash','countedCash','originalDifference','restatedExpectedCash','restatedDifference'] as const).map((key,i)=>({label:['Original expected cash PHP','Original counted cash PHP','Original difference PHP','Restated expected cash PHP','Restated difference PHP'][i],numeric:true,value:(r:Record<string,unknown>)=>{const c=r.closingRestatement as DrawerClosingRestatement|null;return !c?'':c[key]===null?'Unknown':pesos(c[key]!);}})),{label:'Actor',value:r=>r.actorId},{label:'Device',value:r=>r.deviceId},{label:'Shift',value:r=>r.shiftId},{label:'Reason',value:r=>r.reason}],data.records as unknown as Record<string,unknown>[]);
}

export function readDrawerExpenseSummary(value:unknown,shiftId:string):DrawerExpenseSummary {
 const fail=():never=>{throw Error('Drawer totals could not be verified. Refresh online.');};
 const d=value as DrawerExpenseSummary;
 if(!d||d.shiftId!==shiftId||![d.openingCash,d.paymentCash,d.expenseCashOut,d.expenseCashReturned].every(Number.isSafeInteger)||d.expenseCashOut<0||d.expenseCashReturned<0||!(d.expectedCash===null||Number.isSafeInteger(d.expectedCash))||d.negativeBalance!==(d.expectedCash===null?null:d.expectedCash<0))fail();
 try{verifyClosing(d.closingRestatement);}catch{return fail();}
 if(d.closingRestatement){if(d.closingRestatement.shiftId!==shiftId||d.expectedCash!==d.closingRestatement.originalExpectedCash)fail();}
 else if(d.expectedCash===null||BigInt(d.expectedCash)!==BigInt(d.openingCash)+BigInt(d.paymentCash)-BigInt(d.expenseCashOut)+BigInt(d.expenseCashReturned))fail();
 return d;
}
export function validateDrawerExpenseOwnerInput(action:string,value:Record<string,unknown>):DrawerExpenseCorrectionInput|DrawerExpenseReturnInput|DrawerExpenseReconciliationInput {
 const fail=():never=>{throw Error('Enter valid owner expense evidence and exact centavo amounts.');};
 const ids=(keys:string[])=>keys.every(k=>uuid.test(String(value[k])));
 const text=(key:string,min:number,max:number)=>typeof value[key]==='string'&&String(value[key]).trim().length>=min&&String(value[key]).trim().length<=max;
 const amount=(allowZero=false)=>Number.isSafeInteger(value.amount)&&Number(value.amount)>=(allowZero?0:1)&&Number(value.amount)<=2147483647;
 const metadata=()=>drawerExpenseCategories.includes(value.category as DrawerExpenseCategory)&&text('purpose',3,500)&&text('payee',1,200)&&text('reference',0,200);
 if(!ids(['organizationId','branchId','requestId'])||!text('reason',3,500))fail();
 if(action==='correct_drawer_expense'){
  if(!ids(['expenseId','shiftId','deviceId'])||!['metadata','amount','report'].includes(String(value.mode))||(value.mode==='metadata'?!metadata():!amount(true)))fail();
 }else if(action==='return_drawer_expense_cash'){
  if(!ids(['expenseId','shiftId','deviceId'])||!amount())fail();
 }else if(action==='reconcile_drawer_expense'){
  if(!ids(['originalShiftId','originalDeviceId'])||typeof value.actualPaid!=='boolean'||!text('payerEvidence',3,500)||!text('reference',1,200)||value.actualPaid&&(!amount()||!metadata()||!timestamp(value.occurredAt)))fail();
  const hasOriginal=['originalAction','originalData','originalActorId'].some(k=>value[k]!==undefined);
  if(hasOriginal){const original=value.originalData as Record<string,unknown>;if(!drawerExpenseActions.has(String(value.originalAction))||!ids(['originalActorId'])||!original||typeof original!=='object'||Array.isArray(original)||!uuid.test(String(original.requestId))||original.requestId===value.requestId||value.actualPaid&&['correct_drawer_expense','reconcile_drawer_expense'].includes(String(value.originalAction)))fail();}
  else if(!value.actualPaid)fail();
 }else fail();
 return value as unknown as DrawerExpenseCorrectionInput|DrawerExpenseReturnInput|DrawerExpenseReconciliationInput;
}
