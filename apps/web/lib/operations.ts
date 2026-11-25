import {drawerExpenseActions,validateDrawerExpenseInput,validateDrawerExpenseOwnerInput,verifyDrawerExpenseAcknowledgement} from './drawer-expenses';
import {verifyShipmentAcknowledgement} from './branch-transfers';
import {verifyPurchasingAcknowledgement} from "./purchasing-confirmation";
import {verifyBranchPriceAcknowledgement} from './branch-pricing';
import {verifyBranchRequestAcknowledgement} from './branch-requests';
import { stableJSON, saleSchema,allocatedCashSchema, type Lease } from "@agristore/domain";
import { PosDatabase, setting, setSetting, unresolvedStates } from "@agristore/offline";
import { command } from "./api";
import { verifyCreditAcknowledgement } from "./credit-confirmation";
import { isDatabaseRejection } from "./command-error";
import {offlineControlActions,settleOfflineControl} from './offline-control';
import {returnAllocatedStock} from './allocated-cash';
export interface PendingOperation {
  key: string;
  action: string;
  data: Record<string, unknown>;
  fingerprint: string;
  actorId: string;
  error?: string;
  recovered?:boolean;
}
const financialActions=new Set([...drawerExpenseActions,'record_online_sale','record_credit_sale','collect_credit_payment','reverse_credit_collection','credit_refund','set_credit_due_date','save_credit_client','supplier_record_invoice','supplier_record_payment','supplier_credit_note','supplier_reverse_entry','supplier_void_invoice','supplier_create_order','supplier_receive_purchase','review_product_price','review_import_setup','refund_sale','partial_refund_sale','correct_refund','publish_branch_unit_price','copy_branch_unit_prices']);
const priceActions=new Set(['publish_branch_unit_price','copy_branch_unit_prices']);
const crossBranchPriceActions=new Set([...priceActions,'apply_branch_price_copy']);
export function ownFinancialOriginals(operations:PendingOperation[],actorId:string){
 return operations.filter(op=>op.actorId===actorId&&financialActions.has(op.action)&&typeof op.data.organizationId==='string'&&typeof op.data.branchId==='string');
}
export function visiblePendingOperations(operations:PendingOperation[],scope:{organizationId:string;branchId:string;actorId:string|undefined;role:string|undefined}){
 return operations.filter(op=>op.data.organizationId===scope.organizationId&&(
  ((!op.data.branchId||op.data.branchId===scope.branchId)&&(scope.role==='owner'||op.actorId===scope.actorId))||
  (scope.role==='owner'&&op.actorId===scope.actorId&&crossBranchPriceActions.has(op.action))));
}
export function retryFinancialOriginal(db:PosDatabase,actorId:string,pending:PendingOperation){
 if(!ownFinancialOriginals([pending],actorId).length)throw new Error('Only your own saved financial or price original can be checked here.');
 return retryOperation(db,actorId,pending,true);
}
export async function recoverSavedCashOriginal(db:PosDatabase,actorId:string,id:string){
 const saved=await db.sales.get(id);
 if(!saved||saved.payload.cashierId!==actorId||saved.id!==saved.payload.transactionId||!unresolvedStates.includes(saved.status))throw new Error('Only your own unresolved cash original can be checked here.');
 if(saved.allocation)throw Error('Upload this paid offline receipt from Sync center. If cashier access is refused, ask the owner to resolve its unchanged original.');
 const result=await command('recover_financial_original',{organizationId:saved.payload.organizationId,branchId:saved.payload.branchId,originalAction:'record_sale',originalData:saved.payload});
 if(result.transactionId!==saved.id||result.status!=='duplicate'||typeof result.receipt!=='string'||!Array.isArray(result.flags)||result.flags.some(flag=>typeof flag!=='string'))throw new Error('The cash confirmation could not be verified. Preserve the original.');
 await db.transaction('rw',db.sales,async()=>{const current=await db.sales.get(id);if(current&&current.fingerprint===saved.fingerprint&&current.payload.cashierId===actorId&&unresolvedStates.includes(current.status))await db.sales.update(id,{receipt:result.receipt as string,flags:result.flags as string[],error:undefined});});
 return result;
}
export async function requireNoPendingClosure(db: PosDatabase, organizationId: string, branchId: string) {
  if (await setting(db, `operation:close_shift:${organizationId}:${branchId}`))
    throw new Error("Shift closing is awaiting confirmation. Open Sync center and retry the original closing request before selling, opening or renewing a shift, or making another change.");
}
async function requireFinancialWorkConfirmed(db: PosDatabase, data: Record<string, unknown>, key: string) {
  if (await db.sales.where("status").anyOf(unresolvedStates).filter(s =>
    s.payload.organizationId === data.organizationId && s.payload.branchId === data.branchId).count())
    throw new Error("Synchronize every saved sale for this branch before closing the shift. Original records remain on this PC.");
  if (await db.settings.where("key").startsWith("operation:").filter(row => {
    const op = row.value as PendingOperation;
    return row.key !== key && op.data.organizationId === data.organizationId &&
      (!op.data.branchId || op.data.branchId === data.branchId);
  }).count()) throw new Error("Confirm every stock or refund request for this branch in Sync center before closing the shift. Retry original requests; do not enter them again.");
}
async function requireClosureReady(db:PosDatabase,data:Record<string,unknown>,key:string){
 if(await db.offlineGrants.filter(g=>!g.returned&&g.grant.organizationId===data.organizationId&&g.grant.branchId===data.branchId&&g.grant.shiftId===data.shiftId).count())throw Error('Reconcile and return this PC offline stock before closing its drawer. Keep unknown PC originals for the owner.');
 await requireFinancialWorkConfirmed(db,data,key);
}
export async function onlineOperation(
  db: PosDatabase,
  actorId: string,
  action: string,
  data: Record<string, unknown>,
  idField?: string,
) {
  const key = `operation:${action}:${data.organizationId}:${data.branchId}`;
  if(action==='record_credit_sale'&&!await setting(db,key)){
    const lease=await setting<Lease>(db,'lease');
    if(lease&&lease.organizationId===data.organizationId&&lease.branchId===data.branchId&&lease.cashierId===actorId)await returnAllocatedStock(db,lease);
  }
  const identityFree = {...data};
  if(idField)delete identityFree[idField];
  const fingerprint = stableJSON(identityFree);
  // IndexedDB serializes this read/write transaction across browser windows.
  // Network activity must stay outside it so the durable request commits first.
  const pending = await db.transaction("rw", [db.settings, db.sales,db.offlineGrants], async () => {
    const previous = await setting<PendingOperation>(db, key);
    if (previous) {
      if (previous.fingerprint !== fingerprint || previous.actorId !== actorId || (idField&&data[idField]!==undefined&&previous.data[idField]!==data[idField]))
        throw new Error(
          "An earlier operation needs confirmation. Retry its original request in the Sync center first.",
        );
      return previous;
    }
    if (action === "post_owner_stock_count")
      await requireFinancialWorkConfirmed(db, data, key);
    if(action==='record_drawer_expense'){
      validateDrawerExpenseInput({...data,requestId:data.requestId??(idField==='requestId'?crypto.randomUUID():undefined)});
      await requireFinancialWorkConfirmed(db,data,key);
      const lease=await setting<Lease>(db,'lease');
      if(!lease||lease.organizationId!==data.organizationId||lease.branchId!==data.branchId||lease.cashierId!==actorId||lease.deviceId!==data.deviceId||lease.shiftId!==data.shiftId||lease.expiresAt<=Date.now()||!['owner','cashier'].includes(lease.role))throw Error('Open or renew your own current drawer before recording an expense.');
    }
    if(action==='record_online_sale'||action==='record_credit_sale'){
      const other=action==='record_online_sale'?'record_credit_sale':'record_online_sale';
      if(await setting(db,`operation:${other}:${data.organizationId}:${data.branchId}`))throw new Error('Confirm the original cash or credit sale in Sync center before starting another checkout.');
    }
    if (action === "close_shift") {
      const lease = await setting<Lease>(db, "lease");
      if (!lease || lease.organizationId !== data.organizationId || lease.branchId !== data.branchId ||
        lease.cashierId !== actorId || lease.shiftId !== data.shiftId)
        throw new Error("The saved shift changed. Refresh this store before closing; keep the original records.");
      if (!Number.isSafeInteger(data.countedCash) || Number(data.countedCash) < 0)
        throw new Error("Enter the counted drawer cash in valid centavos.");
      await requireClosureReady(db, data, key);
    } else if (typeof data.organizationId === "string" && typeof data.branchId === "string") {
      // A recovered close may coexist with a paid original. Its exact owner
      // resolution must be possible before close can safely settle; server
      // authorization and immutable original proof remain mandatory.
      if(action==='reconcile_drawer_expense'&&data.originalData!==undefined){
        validateDrawerExpenseOwnerInput(action,{...data,requestId:data.requestId??crypto.randomUUID()});
      }else if(action==='reconcile_allocated_cash_sale'){
        const original=allocatedCashSchema.parse(data.original);
        if(original.organizationId!==data.organizationId||original.branchId!==data.branchId||['reference','reason'].some(k=>typeof data[k]!=='string'||String(data[k]).trim().length<3||String(data[k]).length>1000))throw Error('Keep the original paid receipt and enter its reference and reason for owner resolution.');
      }else await requireNoPendingClosure(db, data.organizationId, data.branchId);
    }
    const created: PendingOperation = {
      key, action, data: idField ? { ...data, [idField]: data[idField]??crypto.randomUUID() } : { ...data },
      fingerprint, actorId,
    };
    await setSetting(db, key, created);
    return created;
  });
  return retryOperation(db, actorId, pending);
}
async function settleOperation(
  db: PosDatabase,
  pending: PendingOperation,
  error?: string,
  confirmed = false,
  confirmedReceipt?: string,
  confirmedResult?:Record<string,unknown>,
) {
  await db.transaction("rw", [db.settings,db.sales,db.offlineGrants], async () => {
    const current = await setting<PendingOperation>(db, pending.key);
    // A different window may have confirmed this request and started another.
    // A late response must never replace, erase or resurrect either request.
    if (!current || current.actorId !== pending.actorId ||
      current.action !== pending.action || stableJSON(current.data) !== stableJSON(pending.data)) return;
    if (error === undefined) {
      if(confirmed&&confirmedResult&&offlineControlActions.has(pending.action))await settleOfflineControl(db,pending,confirmedResult);
      if(confirmed&&pending.action==='record_online_sale'){
        const payload=saleSchema.parse(pending.data);
        const existing=await db.sales.get(payload.transactionId);
        if(existing&&existing.fingerprint!==stableJSON(payload))throw new Error('The saved sale reference contains different details. Preserve the original records.');
        if(!confirmedReceipt)throw new Error('The server receipt is missing. Keep the original request for verification.');
        await db.sales.put({id:payload.transactionId,payload,fingerprint:stableJSON(payload),status:'synced',attempts:existing?.attempts??1,nextAttempt:0,updatedAt:Date.now(),receipt:confirmedReceipt});
        await setSetting(db,`credit-stock-refresh:${payload.organizationId}:${payload.branchId}`,{previousRequestId:await setting(db,'snapshotRequestId')??null});
      }
      if(confirmed&&pending.action==='record_credit_sale'){
        await setSetting(db,`credit-stock-refresh:${pending.data.organizationId}:${pending.data.branchId}`,{previousRequestId:await setting(db,'snapshotRequestId')??null});
      }
      if (confirmed && pending.action === "close_shift") {
        const lease = await setting<Lease>(db, "lease");
        // A late close response must never clear a newer cashier's shift.
        if (lease && lease.organizationId === pending.data.organizationId && lease.branchId === pending.data.branchId &&
          lease.shiftId === pending.data.shiftId && lease.cashierId === pending.actorId)
          await db.settings.delete("lease");
      }
      await db.settings.delete(pending.key);
    }
    else await setSetting(db, pending.key, { ...current, error });
  });
}
export async function retryOperation(
  db: PosDatabase,
  actorId: string,
  pending: PendingOperation,
  recoveryOnly = false,
) {
  if (pending.actorId !== actorId)
    throw new Error(
      "Sign in as the employee who began this operation to retry it.",
    );
  try {
    if (pending.action === "close_shift")
      await db.transaction("r", [db.sales, db.settings,db.offlineGrants], () => requireClosureReady(db, pending.data, pending.key));
    const result = pending.recovered&&['refresh_pc_stock_grant','return_pc_stock_grant'].includes(pending.action)?await command('recover_pc_stock_request',{organizationId:pending.data.organizationId,branchId:pending.data.branchId,originalAction:pending.action,originalData:pending.data}):recoveryOnly?await command('recover_financial_original',{organizationId:pending.data.organizationId,branchId:pending.data.branchId,originalAction:pending.action,originalData:pending.data}):await command(pending.action, pending.data);
    if(recoveryOnly&&!priceActions.has(pending.action)&&pending.action!=='record_online_sale'){
      const id=pending.data.requestId??pending.data.refundId??pending.data.correctionId;
      if(result.id!==id||result.duplicate!==true)throw new Error('The original confirmation could not be verified. Preserve the saved request.');
    }
    if(pending.action==='record_online_sale'&&((recoveryOnly?result.status!=='duplicate':!['created','duplicate'].includes(String(result.status)))||result.transactionId!==pending.data.transactionId||typeof result.receipt!=='string'))throw new Error('The sale response could not be verified. Keep the original request in Sync center.');
    if(pending.action==='record_credit_sale')verifyCreditAcknowledgement(pending.data,result);
    verifyPurchasingAcknowledgement(pending.action,pending.data,result);
    verifyBranchPriceAcknowledgement(pending.action,pending.data,result);
    if (pending.action === "post_owner_stock_count" &&
        (result.id !== pending.data.requestId || !Array.isArray(pending.data.items) ||
         result.count !== pending.data.items.length || typeof result.duplicate !== "boolean"))
      throw new Error("The count response could not be verified. Keep the original request in Sync center.");
    verifyBranchRequestAcknowledgement(pending.action,pending.data,result);
    verifyShipmentAcknowledgement(pending.action,pending.data,result);
    verifyDrawerExpenseAcknowledgement(pending.action,pending.data,result,actorId);
    await settleOperation(db, pending, undefined, true,typeof result.receipt==='string'?result.receipt:undefined,result);
    return result;
  } catch (e) {
    // Paid drawer expenses retain physical-payment evidence even after rollback; only a verified posting or owner resolution can settle them. Other rejected mutations retain their existing rollback rule.
    if (!recoveryOnly && !pending.recovered && !drawerExpenseActions.has(pending.action) && isDatabaseRejection(e))
      await settleOperation(db, pending);
    else
      await settleOperation(db, pending,
        e instanceof Error ? e.message : "Response interrupted");
    throw e;
  }
}
export async function pendingOperations(db: PosDatabase) {
  return (
    await db.settings.where("key").startsWith("operation:").toArray()
  ).map((s) => s.value as PendingOperation);
}
