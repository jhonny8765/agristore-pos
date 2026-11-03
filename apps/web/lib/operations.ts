import { stableJSON, saleSchema, type Lease } from "@agristore/domain";
import { PosDatabase, setting, setSetting, unresolvedStates } from "@agristore/offline";
import { command } from "./api";
import { isDatabaseRejection } from "./command-error";
export interface PendingOperation {
  key: string;
  action: string;
  data: Record<string, unknown>;
  fingerprint: string;
  actorId: string;
  error?: string;
}
export async function requireNoPendingClosure(db: PosDatabase, organizationId: string, branchId: string) {
  if (await setting(db, `operation:close_shift:${organizationId}:${branchId}`))
    throw new Error("Shift closing is awaiting confirmation. Open Sync center and retry the original closing request before selling, opening or renewing a shift, or making another change.");
}
async function requireClosureReady(db: PosDatabase, data: Record<string, unknown>, key: string) {
  if (await db.sales.where("status").anyOf(unresolvedStates).filter(s =>
    s.payload.organizationId === data.organizationId && s.payload.branchId === data.branchId).count())
    throw new Error("Synchronize every saved sale for this branch before closing the shift. Original records remain on this PC.");
  if (await db.settings.where("key").startsWith("operation:").filter(row => {
    const op = row.value as PendingOperation;
    return row.key !== key && op.data.organizationId === data.organizationId &&
      (!op.data.branchId || op.data.branchId === data.branchId);
  }).count()) throw new Error("Confirm every stock or refund request for this branch in Sync center before closing the shift. Retry original requests; do not enter them again.");
}
export async function onlineOperation(
  db: PosDatabase,
  actorId: string,
  action: string,
  data: Record<string, unknown>,
  idField?: string,
) {
  const key = `operation:${action}:${data.organizationId}:${data.branchId}`;
  const identityFree = {...data};
  if(idField)delete identityFree[idField];
  const fingerprint = stableJSON(identityFree);
  // IndexedDB serializes this read/write transaction across browser windows.
  // Network activity must stay outside it so the durable request commits first.
  const pending = await db.transaction("rw", [db.settings, db.sales], async () => {
    const previous = await setting<PendingOperation>(db, key);
    if (previous) {
      if (previous.fingerprint !== fingerprint || previous.actorId !== actorId || (idField&&data[idField]!==undefined&&previous.data[idField]!==data[idField]))
        throw new Error(
          "An earlier operation needs confirmation. Retry its original request in the Sync center first.",
        );
      return previous;
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
      await requireNoPendingClosure(db, data.organizationId, data.branchId);
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
) {
  await db.transaction("rw", [db.settings,db.sales], async () => {
    const current = await setting<PendingOperation>(db, pending.key);
    // A different window may have confirmed this request and started another.
    // A late response must never replace, erase or resurrect either request.
    if (!current || current.actorId !== pending.actorId ||
      current.action !== pending.action || stableJSON(current.data) !== stableJSON(pending.data)) return;
    if (error === undefined) {
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
) {
  if (pending.actorId !== actorId)
    throw new Error(
      "Sign in as the employee who began this operation to retry it.",
    );
  try {
    if (pending.action === "close_shift")
      await db.transaction("r", [db.sales, db.settings], () => requireClosureReady(db, pending.data, pending.key));
    const result = await command(pending.action, pending.data);
    if(pending.action==='record_online_sale'&&(!['created','duplicate'].includes(String(result.status))||result.transactionId!==pending.data.transactionId||typeof result.receipt!=='string'))throw new Error('The sale response could not be verified. Keep the original request in Sync center.');
    await settleOperation(db, pending, undefined, true,typeof result.receipt==='string'?result.receipt:undefined);
    return result;
  } catch (e) {
    // A database rejection is an authoritative rollback. An interrupted response is ambiguous and retained.
    if (isDatabaseRejection(e))
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
