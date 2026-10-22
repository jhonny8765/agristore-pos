import Dexie, { type Table } from "dexie";
import Decimal from "decimal.js";
import {
  canonicalQuantity,
  requireLease,
  saleSchema,
  stableJSON,
  type Lease,
  type Product,
  type Sale,
  type Snapshot,
  type Stock,
  type SyncAck,
} from "@agristore/domain";

export type SyncState =
  | "pending"
  | "sending"
  | "synced"
  | "authentication_required"
  | "retryable"
  | "review_required";
export interface LocalSale {
  id: string;
  payload: Sale;
  fingerprint: string;
  status: SyncState;
  attempts: number;
  nextAttempt: number;
  updatedAt: number;
  receipt?: string;
  flags?: string[];
  error?: string;
}
interface Setting {
  key: string;
  value: unknown;
}
interface Lock {
  key: string;
  owner: string;
  expiresAt: number;
}
export class PosDatabase extends Dexie {
  products!: Table<Product, string>;
  stocks!: Table<Stock, string>;
  sales!: Table<LocalSale, string>;
  settings!: Table<Setting, string>;
  locks!: Table<Lock, string>;
  constructor(name = "agristore-live-v1") {
    super(name);
    this.version(1).stores({
      products: "id,sku,category",
      stocks: "key,productId",
      sales: "id,status,nextAttempt",
      settings: "key",
      locks: "key",
    });
  }
}
export async function setting<T>(
  db: PosDatabase,
  key: string,
): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined;
}
export async function setSetting(db: PosDatabase, key: string, value: unknown) {
  await db.settings.put({ key, value });
}
export async function saveCheckout(
  db: PosDatabase,
  payload: Sale,
  now = Date.now(),
) {
  const sale = saleSchema.parse(payload);
  const fingerprint = stableJSON(sale);
  return db.transaction(
    "rw",
    [db.sales, db.settings, db.products],
    async () => {
      const previous = await db.sales.get(sale.transactionId);
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new Error("This checkout ID already contains a different sale");
        return previous;
      }
      const lease = await setting<Lease>(db, "lease");
      requireLease(lease, now);
      if (
        sale.organizationId !== lease.organizationId ||
        sale.branchId !== lease.branchId ||
        sale.shiftId !== lease.shiftId ||
        sale.cashierId !== lease.cashierId ||
        sale.deviceId !== lease.deviceId
      )
        throw new Error("The checkout does not match the authorized shift");
      const asOf = await setting<string>(db, "snapshotAsOf");
      if (!asOf) throw new Error("Download the catalog online before selling");
      for (const item of sale.items) {
        const p = await db.products.get(item.productId);
        const u = p?.units.find((u) => u.id === item.unitId);
        if (
          !p?.active ||
          !u ||
          u.factor !== item.factor ||
          u.price !== item.unitPrice ||
          u.cost !== item.unitCost ||
          u.priceVersion !== item.priceVersion
        )
          throw new Error(
            "The cart has changed prices or units. Remove and add the affected product again.",
          );
        const canonical = canonicalQuantity(item.quantity, item.factor);
        if (p.baseUnit === "piece" && !new Decimal(canonical).isInteger())
          throw new Error("Piece stock must be a whole number");
      }
      const record: LocalSale = {
        id: sale.transactionId,
        payload: sale,
        fingerprint,
        status: "pending",
        attempts: 0,
        nextAttempt: now,
        updatedAt: now,
      };
      await db.sales.add(record);
      // The sale is also the immutable outbox event and local stock deduction: a single durable write.
      return record;
    },
  );
}
export async function applySnapshot(db: PosDatabase, snapshot: Snapshot) {
  await db.transaction(
    "rw",
    [db.products, db.stocks, db.sales, db.settings],
    async () => {
      await db.products.clear();
      await db.products.bulkPut(snapshot.products);
      await db.stocks.clear();
      await db.stocks.bulkPut(snapshot.stocks);
      for (const id of snapshot.confirmedIds) {
        const sale = await db.sales.get(id);
        if (sale && sale.status !== "review_required")
          await db.sales.update(id, {
            status: "synced",
            error: undefined,
            updatedAt: Date.now(),
          });
      }
      await setSetting(db, "confirmedIds", snapshot.confirmedIds);
      await setSetting(db, "snapshotAsOf", snapshot.asOf);
    },
  );
}
export async function localStock(
  db: PosDatabase,
): Promise<Map<string, string>> {
  return db.transaction("r", [db.stocks, db.sales, db.settings], async () => {
    const result = new Map(
      (await db.stocks.toArray()).map((s) => [s.key, s.quantity]),
    );
    const confirmed = new Set(
      (await setting<string[]>(db, "confirmedIds")) ?? [],
    );
    const lease = await setting<Lease>(db, "lease");
    for (const sale of await db.sales
      .where("status")
      .notEqual("synced")
      .toArray()) {
      if (
        sale.status === "synced" ||
        confirmed.has(sale.id) ||
        sale.payload.branchId !== lease?.branchId
      )
        continue;
      for (const item of sale.payload.items) {
        const key = stockKey(item.productId, item.batchId);
        result.set(
          key,
          new Decimal(result.get(key) ?? 0)
            .minus(canonicalQuantity(item.quantity, item.factor))
            .toFixed(),
        );
      }
    }
    return result;
  });
}
export const stockKey = (productId: string, batchId: string | null) =>
  `${productId}:${batchId ?? "none"}`;
export interface Transport {
  authorize(): Promise<boolean>;
  push(sale: Sale): Promise<SyncAck>;
  snapshot(ids: string[]): Promise<Snapshot>;
}
export async function syncOnce(
  db: PosDatabase,
  transport: Transport,
  now = Date.now(),
) {
  const owner = crypto.randomUUID();
  const locked = await db.transaction("rw", db.locks, async () => {
    const lock = await db.locks.get("sync");
    if (lock && lock.expiresAt > now) return false;
    await db.locks.put({ key: "sync", owner, expiresAt: now + 45_000 });
    return true;
  });
  if (!locked) return { sent: 0, skipped: true };
  let sent = 0;
  try {
    const lease = await setting<Lease>(db, "lease");
    if (!lease) return { sent };
    const eligible = (
      await db.sales.where("status").notEqual("synced").toArray()
    ).filter(
      (s) =>
        s.payload.branchId === lease.branchId &&
        s.payload.organizationId === lease.organizationId &&
        s.payload.cashierId === lease.cashierId &&
        s.status !== "synced" &&
        s.status !== "review_required",
    );
    if (!(await transport.authorize())) {
      for (const s of eligible)
        await db.sales.update(s.id, {
          status: "authentication_required",
          error: "Sign in again to upload this sale",
          updatedAt: now,
        });
      return { sent };
    }
    for (const s of eligible
      .filter(
        (s) =>
          s.nextAttempt <= now &&
          (s.status !== "sending" || s.updatedAt + 45_000 < now),
      )
      .slice(0, 25)) {
      await db.locks.update("sync", { expiresAt: Date.now() + 45_000 });
      await db.sales.update(s.id, { status: "sending", updatedAt: now });
      try {
        const ack = await transport.push(s.payload);
        sent++;
        if (ack.transactionId !== s.id)
          throw new Error(
            "Server returned the wrong transaction acknowledgment",
          );
        if (ack.status === "review")
          await db.sales.update(s.id, {
            status: "review_required",
            error: ack.reason ?? "Owner review required",
            updatedAt: now,
          });
        else
          await db.sales.update(s.id, {
            receipt: ack.receipt,
            flags: ack.flags ?? [],
            error: undefined,
          });
        // Never mark synced until the authoritative snapshot incorporates this sale.
      } catch (error) {
        const attempts = s.attempts + 1;
        await db.sales.update(s.id, {
          status: attempts >= 10 ? "review_required" : "retryable",
          attempts,
          nextAttempt: now + Math.min(300_000, 1000 * 2 ** attempts),
          updatedAt: now,
          error: error instanceof Error ? error.message : "Upload interrupted",
        });
      }
    }
    const ids = (await db.sales.where("status").notEqual("synced").toArray())
      .filter(
        (s) =>
          s.payload.branchId === lease.branchId &&
          s.payload.organizationId === lease.organizationId,
      )
      .map((s) => s.id);
    await applySnapshot(db, await transport.snapshot(ids));
    await setSetting(db, "lastSync", new Date(now).toISOString());
    return { sent };
  } finally {
    await db.transaction("rw", db.locks, async () => {
      if ((await db.locks.get("sync"))?.owner === owner)
        await db.locks.delete("sync");
    });
  }
}
export async function retrySale(db: PosDatabase, id: string) {
  await db.sales.update(id, {
    status: "pending",
    attempts: 0,
    nextAttempt: 0,
    error: undefined,
  });
}
export async function exportRecovery(db: PosDatabase) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sales: await db.sales.toArray(),
    pendingOperations: (
      await db.settings.where("key").startsWith("operation:").toArray()
    ).map((s) => s.value),
    lease: await setting<Lease>(db, "lease"),
  };
}
export async function importRecovery(db: PosDatabase, input: unknown) {
  const lease = await setting<Lease>(db, "lease");
  requireLease(lease);
  const data = input as {
    version?: unknown;
    sales?: unknown;
    pendingOperations?: unknown;
  };
  if (
    data?.version !== 1 ||
    !Array.isArray(data.sales) ||
    data.sales.length > 10000
  )
    throw new Error("Invalid recovery file");
  const records = data.sales.map((row) => {
    const payload = saleSchema.parse((row as { payload: unknown }).payload);
    if (
      payload.organizationId !== lease.organizationId ||
      payload.branchId !== lease.branchId
    )
      throw new Error("Recovery records belong to another business or branch");
    if (payload.cashierId !== lease.cashierId && lease.role !== "owner")
      throw new Error(
        "Sign in as the original cashier or ask the owner to restore this file",
      );
    return {
      payload,
      id: payload.transactionId,
      fingerprint: stableJSON(payload),
    };
  });
  const operations = Array.isArray(data.pendingOperations)
    ? data.pendingOperations
    : [];
  if (operations.length > 100) throw new Error("Too many recovery operations");
  const safeOperations = operations.map((raw) => {
    const op = raw as {
      action: string;
      data: Record<string, unknown>;
      actorId: string;
      error?: string;
    };
    const idField = (
      {
        receive_stock: "receiptId",
        dispatch_transfer: "transferId",
        submit_count: "countId",
        refund_sale: "refundId",
      } as Record<string, string>
    )[op.action];
    if (
      !idField ||
      !op.data ||
      typeof op.actorId !== "string" ||
      typeof op.data[idField] !== "string"
    )
      throw new Error("Invalid recovery operation");
    if (
      op.data.organizationId !== lease.organizationId ||
      op.data.branchId !== lease.branchId
    )
      throw new Error(
        "Recovery operation belongs to another business or branch",
      );
    if (op.actorId !== lease.cashierId && lease.role !== "owner")
      throw new Error("The owner must review another employee’s operation");
    const body = { ...op.data };
    delete body[idField];
    return {
      key: `operation:${op.action}:${lease.organizationId}:${lease.branchId}`,
      value: {
        ...op,
        key: `operation:${op.action}:${lease.organizationId}:${lease.branchId}`,
        fingerprint: stableJSON(body),
        error: op.error ?? "Restored original request; verify before retrying",
      },
    };
  });
  await db.transaction("rw", [db.sales, db.settings], async () => {
    for (const op of safeOperations) {
      const existing = await db.settings.get(op.key);
      if (
        existing &&
        stableJSON((existing.value as { data: unknown }).data) !==
          stableJSON(op.value.data)
      )
        throw new Error(
          "Another operation is already awaiting confirmation. Keep both recovery files.",
        );
      await db.settings.put(op);
    }
    for (const record of records) {
      const existing = await db.sales.get(record.id);
      if (existing) {
        if (existing.fingerprint !== record.fingerprint)
          throw new Error(
            "Recovery conflicts with an existing transaction. Keep both files for owner review.",
          );
        continue;
      }
      await db.sales.add({
        ...record,
        status:
          record.payload.cashierId === lease.cashierId
            ? "pending"
            : "review_required",
        attempts: 0,
        nextAttempt: 0,
        updatedAt: Date.now(),
        error:
          record.payload.cashierId === lease.cashierId
            ? undefined
            : "Restored for owner review; original cashier authentication required",
      });
    }
  });
  return records.length;
}
