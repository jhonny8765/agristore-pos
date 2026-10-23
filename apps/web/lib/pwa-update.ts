export async function findReadyUpdate(
  registration: ServiceWorkerRegistration,
  timeoutMs = 30_000,
): Promise<ServiceWorker | null> {
  await registration.update();
  if (registration.waiting) return registration.waiting;
  const worker = registration.installing;
  if (!worker) return null;
  return new Promise((resolve, reject) => {
    const finish = (error?: Error, ready: ServiceWorker | null = null) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", changed);
      if (error) reject(error);
      else resolve(ready);
    };
    const changed = () => {
      if (worker.state === "installed")
        finish(undefined, registration.waiting ?? worker);
      else if (worker.state === "activated") finish();
      else if (worker.state === "redundant")
        finish(
          new Error(
            "The update could not be installed. Your current app is still available; try again online.",
          ),
        );
    };
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "The update is still downloading. Keep using the current app and check again later.",
          ),
        ),
      timeoutMs,
    );
    worker.addEventListener("statechange", changed);
    changed();
  });
}
