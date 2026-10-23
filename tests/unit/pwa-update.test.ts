import { afterEach, expect, it, vi } from "vitest";
import { findReadyUpdate } from "../../apps/web/lib/pwa-update";

class Worker extends EventTarget {
  state: ServiceWorkerState = "installing";
  transition(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}
function registration(worker: Worker | null) {
  return {
    update: vi.fn(async () => {}),
    installing: worker,
    waiting: null,
  } as unknown as ServiceWorkerRegistration;
}
afterEach(() => vi.useRealTimers());
it("waits for downloading worker installation instead of reporting up to date", async () => {
  const worker = new Worker();
  const r = registration(worker);
  let settled = false;
  const result = findReadyUpdate(r).then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  worker.transition("installed");
  expect(await result).toBe(worker);
});
it("returns the already waiting worker", async () => {
  const worker = new Worker();
  const r = {
    ...registration(null),
    waiting: worker,
  } as unknown as ServiceWorkerRegistration;
  expect(await findReadyUpdate(r)).toBe(worker);
});
it("reports no new update only when neither waiting nor installing exists", async () => {
  expect(await findReadyUpdate(registration(null))).toBeNull();
});
it("keeps an installation failure visible", async () => {
  const worker = new Worker();
  const result = findReadyUpdate(registration(worker));
  const assertion = expect(result).rejects.toThrow(
    "current app is still available",
  );
  await Promise.resolve();
  worker.transition("redundant");
  await assertion;
});
it("bounds a stalled download without activating or removing the current app", async () => {
  vi.useFakeTimers();
  const result = findReadyUpdate(registration(new Worker()), 50);
  const assertion = expect(result).rejects.toThrow("still downloading");
  await vi.advanceTimersByTimeAsync(51);
  await assertion;
});
