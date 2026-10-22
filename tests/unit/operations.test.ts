import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../apps/web/lib/api", () => ({ command: vi.fn() }));
import { command } from "../../apps/web/lib/api";
import {
  onlineOperation,
  pendingOperations,
  retryOperation,
} from "../../apps/web/lib/operations";
import { setupDB, uuid } from "./fixtures";
import type { PosDatabase } from "@agristore/offline";
const databases: PosDatabase[] = [];
const body = {
  organizationId: uuid(1),
  branchId: uuid(2),
  reference: "DELIVERY-1",
  items: [{ quantity: "1" }],
};
async function db() {
  const d = await setupDB();
  databases.push(d);
  return d;
}
afterEach(async () => {
  vi.resetAllMocks();
  for (const d of databases.splice(0)) {
    d.close();
    await d.delete();
  }
});
describe("online inventory operation recovery", () => {
  it("retries an ambiguous response using its original receipt ID", async () => {
    const d = await db();
    vi.mocked(command).mockRejectedValueOnce(new Error("Response lost"));
    await expect(
      onlineOperation(d, uuid(4), "receive_stock", body, "receiptId"),
    ).rejects.toThrow();
    const original = (await pendingOperations(d))[0];
    vi.mocked(command).mockResolvedValueOnce({ ok: true });
    await onlineOperation(d, uuid(4), "receive_stock", body, "receiptId");
    expect(vi.mocked(command).mock.calls[1][1].receiptId).toBe(
      original.data.receiptId,
    );
    expect(await pendingOperations(d)).toHaveLength(0);
  });
  it("clears definitively rejected transactions so corrected input can be submitted", async () => {
    const d = await db();
    vi.mocked(command).mockRejectedValueOnce(
      Object.assign(new Error("Invalid batch"), { code: "P0001" }),
    );
    await expect(
      onlineOperation(d, uuid(4), "receive_stock", body, "receiptId"),
    ).rejects.toThrow();
    expect(await pendingOperations(d)).toHaveLength(0);
  });
  it("preserves the unknown result rather than starting a changed duplicate", async () => {
    const d = await db();
    vi.mocked(command).mockRejectedValueOnce(new Error("Network interrupted"));
    await expect(
      onlineOperation(d, uuid(4), "receive_stock", body, "receiptId"),
    ).rejects.toThrow();
    await expect(
      onlineOperation(
        d,
        uuid(4),
        "receive_stock",
        { ...body, reference: "Changed" },
        "receiptId",
      ),
    ).rejects.toThrow("earlier operation");
    expect(vi.mocked(command)).toHaveBeenCalledTimes(1);
  });
  it("requires the original employee for recovery", async () => {
    const d = await db();
    vi.mocked(command).mockRejectedValueOnce(new Error("Network interrupted"));
    await expect(
      onlineOperation(d, uuid(4), "receive_stock", body, "receiptId"),
    ).rejects.toThrow();
    await expect(
      retryOperation(d, uuid(5), (await pendingOperations(d))[0]),
    ).rejects.toThrow("employee");
    expect(vi.mocked(command)).toHaveBeenCalledTimes(1);
  });
});
