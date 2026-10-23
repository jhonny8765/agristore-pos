# App updates and saved records

## Updating the cashier app

Finish the current cart, reconnect and confirm pending sales and online operations in Sync center. Under Settings → Application & recovery, select **Check for app update**. The action is unavailable while the current cart or known pending records remain.

The app distinguishes checking/downloading, installation, work that blocks reopening, installation failure, and reopening. A check with no new download does not prove that an older open window already displays the latest interface. Its result explains how to close and reopen AgriStore if an earlier update is still not visible.

While installing, the requesting window cannot start another checkout. The app reads the actual local transaction/operation queues before activation and again before reopening; it does not rely only on an earlier displayed count. This includes records saved by another window. A failed queue read prevents automatic reopening.

An update reopens only its requesting window. It does not force other windows to reload or adopt the new worker. An existing unfinished cart in another window must remain intact. The normal operating setup remains one dedicated Edge PWA/profile per cashier PC.

## If the window stays open

Read the message beside the update button. If installation has not finished, keep using the app and check again online as instructed. If it says the update is installed but the window stays open, close that window and reopen AgriStore using the same dedicated browser profile. Keep the profile and its site data. Do not clear browser storage, uninstall the app or enter an earlier purchase again to solve an update problem.

An installation timeout or failure removes its restart listener. A late browser event must not unexpectedly reopen the app after the cashier resumes work. If new pending work appears during installation, automatic reopening is deferred and the message asks for checkout/synchronization to finish first.

Closing all app windows may allow the browser to activate a previously downloaded update even when a sale is still queued. The manual update guard is distinct from that normal browser lifecycle. Updates change the application shell, not the IndexedDB sales store; reopening must preserve each completed sale's exact ID and payload. Recovery exports remain useful before PC maintenance, but do not clear the original profile after exporting.

## Implementation and verification scope

The earlier implementation depended on `controllerchange` to reload. A first-open window can remain uncontrolled when the worker does not claim existing clients; a newly activated worker can therefore leave that page without the event being awaited. The new helper waits for the requested worker's activation, bounds failures, cleans up listeners and performs a fresh guarded navigation. It retains `clientsClaim: false` and `skipWaiting: false`; activation is requested only after the manual action's safety check. A temporary navigation parameter avoids reusing the old document URL and is removed after the new page mounts.

Worker activation and control of a particular window are separate browser concepts. See the primary references for [worker state changes](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker/statechange_event) and [claiming existing clients](https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim).

The unit scenarios cover a newer installer superseding an older waiting download, activation without a controller-change event, blocked work, a second safety check, an already active worker, failed activation, stalled activation and a rejected activation message. Late events after failure must not trigger a restart.

Two additional browser scenarios use the actual optimized app and generated Workbox worker through a loopback-only fixture. The fixture changes a visible HTML marker and the root precache revision, without changing a hosted deployment or business data:

- An initially uncontrolled window requests an update and displays the new cached version. Another window keeps its unfinished cart, then completes its sale. A further update request must detect that new pending record despite the requesting window's stale displayed count.
- A controlled window with a completed pending sale downloads a waiting version, blocks the manual update action, then closes the browser process. Offline reopening must load the downloaded version and retain the exact sale ID and payload.

These checks complement the existing checkout, recovery, database and accessibility suite. They do not replace a physical Windows reboot, the actual timed outage/storage stress test, or update/restart verification in the chosen Edge PWA. Those remain pilot gates.

## Completed evidence — October 24, 2026 (Asia/Manila)

[GitHub Actions 40010789164](https://github.com/jhonny8765/agristore-pos/actions/runs/40010789164), source `22b22ed`, passed type checks, lint, 64 unit tests, ten practice-browser scenarios, 98 pgTAP assertions, the fresh-stack restore drill and five database-connected browser scenarios. Both additional upgrade scenarios passed with actual service workers and IndexedDB. The unchanged accessibility scenario also completed its 20 scoped axe scans. The fresh visual review returned **ship** with no material fixes for desktop, 390px and 418px update feedback.

The protected stable staging origin now points to `agristore-8zj2ce6d2-team-payaman2.vercel.app`. The first download into the older release reproduced its stuck “Restarting” message; a fresh same-origin tab loaded the new updater. After assigning a second ready build, the new updater automatically reopened that same tab from Settings at Checkout without a manual reload or new tab. The temporary navigation parameter was removed, and the existing owner account, five branches and catalog remained available.

Both earlier hosted test receipts remained synchronized, with the local queue clear. No hosted sale, shift, stock change or staff/branch mutation was created during this pass. The final update check showed the new no-download guidance; browser logs reported no warnings/errors. Site data was never cleared. This verifies this in-app browser path; the physical Edge PWA and Windows/outage gates remain separate.
