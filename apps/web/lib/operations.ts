import { stableJSON } from "@agristore/domain";
import { PosDatabase, setting, setSetting } from "@agristore/offline";
import { command } from "./api";
export interface PendingOperation {
  key: string;
  action: string;
  data: Record<string, unknown>;
  fingerprint: string;
  actorId: string;
  error?: string;
}
export async function onlineOperation(
  db: PosDatabase,
  actorId: string,
  action: string,
  data: Record<string, unknown>,
  idField: string,
) {
  const key = `operation:${action}:${data.organizationId}:${data.branchId}`;
  const fingerprint = stableJSON(data);
  let pending = await setting<PendingOperation>(db, key);
  if (
    pending &&
    (pending.fingerprint !== fingerprint || pending.actorId !== actorId)
  )
    throw new Error(
      "An earlier operation needs confirmation. Retry its original request in the Sync center first.",
    );
  if (!pending) {
    pending = {
      key,
      action,
      data: { ...data, [idField]: crypto.randomUUID() },
      fingerprint,
      actorId,
    };
    await setSetting(db, key, pending);
  }
  return retryOperation(db, actorId, pending);
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
    const result = await command(pending.action, pending.data);
    await db.settings.delete(pending.key);
    return result;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    // A database rejection is an authoritative rollback. An interrupted response is ambiguous and retained.
    if (code && /^(P0001|22|23)/.test(code))
      await db.settings.delete(pending.key);
    else
      await setSetting(db, pending.key, {
        ...pending,
        error: e instanceof Error ? e.message : "Response interrupted",
      });
    throw e;
  }
}
export async function pendingOperations(db: PosDatabase) {
  return (
    await db.settings.where("key").startsWith("operation:").toArray()
  ).map((s) => s.value as PendingOperation);
}
