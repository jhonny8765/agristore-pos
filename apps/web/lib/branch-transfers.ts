import Decimal from 'decimal.js';
const ExactDecimal=Decimal.clone({precision:80});
export interface ShipmentLine {lineId:string;productId:string;productName:string;unitId:string;unitName:string;batchId:string|null;batchLot:string|null;batchExpiresOn:string|null;quantity:string;factor:string;baseUnit:string;baseQuantity:string;requestLineId:string|null;accepted?:string;held?:string;lost?:string;returned?:string;outstanding?:string;returnedReceived?:string;acceptedBase?:string;heldBase?:string;lostBase?:string;returnedBase?:string;outstandingBase?:string;quantityMode?:'recorded'|'base';countUnit?:string;heldInTransit?:boolean;holds?:{holdId:string;baseQuantity:string;branchId:string;branchName:string;sourceAction:string}[]}
export interface Shipment {shipmentId:string;reference:string;status:'in_transit'|'received'|'closed_short';duplicate:boolean;lines:ShipmentLine[];sourceName:string;destinationName:string;sourceBranchId:string;destinationBranchId:string;createdAt:string;driver:string|null;vehicle:string|null;expectedArrival:string|null;reason:string}
export interface ShipmentPage {items:Shipment[];next:{scope:'branch_shipments';organizationId:string;branchId:string;id:string}|null}
export function verifyShipmentAcknowledgement(action:string,data:Record<string,unknown>,result:Record<string,unknown>){
 if(action==='disposition_branch_shipment_hold'){
  if(result.id!==data.requestId||result.shipmentId!==data.shipmentId||result.holdId!==data.holdId||result.disposition!==data.disposition||result.action!==action||typeof result.duplicate!=='boolean'||typeof result.quantity!=='string'||!/^\d+(?:\.\d+)?$/.test(result.quantity)||!new Decimal(result.quantity).eq(String(data.quantity)))throw Error('The held shipment response could not be verified. Keep the original in Outstanding deliveries.');
  return;
 }
 if(['receive_branch_shipment','write_off_branch_shipment','compensate_branch_shipment','return_branch_shipment'].includes(action)){
  const fail=()=>{throw Error('The receiving response could not be verified. Keep the original request in Outstanding deliveries or Sync center.');};
  const returning=action==='return_branch_shipment',loss=action==='write_off_branch_shipment';
  const decimal=(value:unknown):value is string=>typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value);
  const equalQuantity=(actual:unknown,expected:unknown)=>decimal(actual)&&decimal(expected)&&new Decimal(actual).eq(expected);
  const rows=(value:unknown):Record<string,unknown>[]=>Array.isArray(value)&&value.every(row=>row!==null&&typeof row==='object'&&!Array.isArray(row))?value:[];
  const id=data.receiptId??data.requestId;
  if(result.id!==id||result.action!==action||typeof result.duplicate!=='boolean'||!['in_transit','received','closed_short'].includes(String(result.status)))fail();
  if(returning?(result.shipmentId!==id||result.originalShipmentId!==data.shipmentId||result.status!=='in_transit'):result.shipmentId!==data.shipmentId)fail();
  const requested=rows(data.lines),returned=rows(result.lines),posted=rows(result.postedLines);
  const key=returning?'lineId':'transferLineId';
  if(!requested.length||posted.length!==requested.length||new Set(requested.map(l=>l[key])).size!==requested.length||new Set(posted.map(l=>l[key])).size!==posted.length||(returning&&returned.length!==requested.length)||new Set(returned.map(l=>l.lineId)).size!==returned.length)fail();
  if(!returning&&returned.some(l=>['accepted','held','lost','returned','outstanding'].some(k=>!decimal(l[k]))))fail();
  for(const input of requested){
   const applied=posted.find(l=>l[key]===input[key]),total=returned.find(l=>l.lineId===input[key]);
   if(!applied||!total)fail();
   const mode=input.quantityMode;
   if(mode!==undefined){
    if((mode!=='recorded'&&mode!=='base')||applied?.quantityMode!==mode||!decimal(total?.factor)||new Decimal(String(total?.factor)).lte(0))fail();
    const factor=mode==='base'?new Decimal(1):new Decimal(String(total?.factor));
    const base=(key:string,baseKey:string)=>decimal(input[key])&&decimal(applied?.[baseKey])&&new ExactDecimal(String(input[key])).mul(factor.toString()).eq(String(applied?.[baseKey]));
    if(returning||loss){if(!base('quantity','quantityBase'))fail();}
    else if(!base('accepted','acceptedBase')||!base('held','heldBase'))fail();
    if(returning){if(!equalQuantity(total?.baseQuantity,applied?.quantityBase)||total?.quantityMode!==mode||total?.countUnit!==(mode==='base'?total?.baseUnit:total?.unitName))fail();}
    else if(['acceptedBase','heldBase','lostBase','returnedBase','outstandingBase'].some(k=>!decimal(total?.[k])))fail();
   }
   // These are immutable quantities applied by THIS mutation, independent of
   // the separately projected cumulative shipment totals.
   if(returning||loss){
    if(!equalQuantity(applied?.quantity,input.quantity)||new Decimal(String(applied?.quantity)).lte(0))fail();
    if(returning){
     if(applied?.transferLineId!==input.transferLineId||(applied?.holdId??null)!==(input.holdId??null)||total?.originalTransferLineId!==input.transferLineId||!equalQuantity(total?.quantity,input.quantity)||total?.heldInTransit!==!!input.holdId)fail();
    }else if(new Decimal(String(mode===undefined?total?.lost:total?.lostBase)).lt(String(mode===undefined?applied?.quantity:applied?.quantityBase)))fail();
   }else{
    if(!equalQuantity(applied?.accepted,input.accepted)||!equalQuantity(applied?.held,input.held))fail();
    const actual=new Decimal(String(mode===undefined?applied?.accepted:applied?.acceptedBase)),held=new Decimal(String(mode===undefined?applied?.held:applied?.heldBase));
    if(actual.plus(held).lte(0))fail();
    if(action==='compensate_branch_shipment'?new Decimal(String(mode===undefined?total?.returned:total?.returnedBase)).lt(actual.plus(held)):new Decimal(String(mode===undefined?total?.accepted:total?.acceptedBase)).lt(actual)||new Decimal(String(mode===undefined?total?.held:total?.heldBase)).lt(held))fail();
   }
  }
  return;
 }
 if(action!=='dispatch_branch_shipment')return;
 const requested=Array.isArray(data.lines)?data.lines as {lineId?:unknown}[]:[];
 const returned=Array.isArray(result.lines)?result.lines as {lineId?:unknown}[]:[];
 if(result.shipmentId!==data.requestId||result.status!=='in_transit'||typeof result.duplicate!=='boolean'||!requested.length||returned.length!==requested.length||new Set(returned.map(l=>l.lineId)).size!==requested.length||requested.some(l=>!returned.some(r=>r.lineId===l.lineId)))throw Error('The shipment response could not be verified. Keep the original request in Sync center.');
}

export const hasApprovedRemainder=(approved:string|null,dispatched:string,cancelled:string)=>approved!==null&&new Decimal(approved).minus(dispatched).minus(cancelled).gt(0);

export function verifyDispatchPriceReadiness(value:unknown,destination:string,unitIds:string[]):{unitId:string;ready:boolean}[]{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Price readiness could not be verified.');
 const record=value as Record<string,unknown>,expected=new Set(unitIds);
 if(record.destinationBranchId!==destination||!Array.isArray(record.units)||record.units.length!==expected.size)throw Error('Price readiness could not be verified.');
 const rows=record.units as {unitId:unknown;ready:unknown}[];
 if(rows.some(row=>!row||typeof row!=='object'||typeof row.unitId!=='string'||!expected.has(row.unitId)||typeof row.ready!=='boolean')||new Set(rows.map(row=>row.unitId)).size!==expected.size)throw Error('Price readiness could not be verified.');
 return rows as {unitId:string;ready:boolean}[];
}
