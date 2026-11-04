import {stableJSON} from '@agristore/domain';
export function verifyPurchasingAcknowledgement(action:string,data:Record<string,unknown>,result:Record<string,unknown>){
 if(!['supplier_create_order','supplier_receive_purchase'].includes(action))return;
 const fail=()=>{throw Error('The purchasing confirmation could not be verified. Keep the original request in Sync center.');};
 if(result.id!==data.requestId||typeof result.duplicate!=='boolean')fail();
 if(action==='supplier_create_order'){
  const order=data.order as Record<string,unknown>,quote=data.commercial as Record<string,unknown>,returned=result.commercial as Record<string,unknown>|undefined;
  if(result.purchaseOrderId!==order?.purchaseOrderId||!returned||returned.paymentMode!==quote?.paymentMode||returned.term!==quote?.term||stableJSON(returned.unitCosts)!==stableJSON(quote?.unitCosts))fail();
  return;
 }
 const delivery=data.delivery as Record<string,unknown>,invoice=data.invoice as Record<string,unknown>,state=result.invoice as Record<string,unknown>|undefined;
 const billId=invoice?.mode==='new'?invoice.requestId:invoice?.billId;
 if(result.receiptId!==delivery?.receiptId||result.billId!==billId||!state||state.id!==billId||state.supplierId!==delivery?.supplierId||!Number.isSafeInteger(state.balance)||Number(state.balance)<0)fail();
 if(invoice.mode==='new'&&(state!.amount!==invoice.amount||state!.paid!==invoice.paidAmount||state!.balance!==Number(invoice.amount)-Number(invoice.paidAmount)||result.paidAmount!==invoice.paidAmount||result.paymentId!==(Number(invoice.paidAmount)>0?invoice.paymentId:null)))fail();
}
