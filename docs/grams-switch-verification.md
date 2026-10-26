# Grams-first checkout follow-up

October 26, 2026. Application source `fffec92`; the generic public edition contains the identical component and browser tests in `daa74b2`.

## Problem and resulting behavior

Selecting grams on a new, empty weight line tried to parse an empty quantity before changing the selector. The selector stayed on kg. A browser regression test reproduced that exact failure before the change.

An empty or whitespace-only weight draft can now switch between kg and g. The draft stays empty, its line contributes no provisional charge, and checkout remains blocked until a positive valid quantity is entered. A previously valid quantity that was cleared cannot return as a charge. Nonempty invalid drafts keep their original unit and entered text instead of being silently reinterpreted. Valid conversions continue using exact decimal arithmetic. Peso requests still require confirmation of actual scale weight.

## Local evidence

- Type checks, application lint and optimized production build passed.
- All 175 unit checks passed with two workers. The initial unrestricted parallel run had 174 passes and a five-second timeout in the existing 200-sale simulated-outage case; the two-worker rerun retained the original timeout and assertions. No timeout or application validation was weakened.
- All 22 practice-browser scenarios passed. The two new cases cover blank/cleared unit switching, invalid drafts, quarter-kilo input, 100/250/500 g conversions without price changes, offline checkout and receipt recovery after reload, and grams-first peso entry at a 390 px viewport with mandatory weighed confirmation.
- Existing 200-sale simulated-outage, browser-process recovery, application-update protection, 100,000-retained-receipt capacity and desktop/mobile accessibility scenarios also passed in that suite. These are automated synthetic checks, not elapsed hardware endurance tests.
- The changed component's mechanical interface scan returned no findings.

No database schema, recorded sale, hosted stock balance, account role, dependency or billing setting changed for this fix. The actual cashier-PC, scale/printer, cloud-backup and staff-pilot gates remain open.

## Deployment and complete verification

Preview `agristore-i33bsvhql-team-payaman2.vercel.app`, deployment `dpl_56qkcZDMgrVjwQ97FVRd6HozK7Kf`, was built from private application source `fffec92` and reached Ready. After the complete free public [40265497302](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40265497302) passed, it was assigned to `agristore-pos-staging-team-payaman2.vercel.app` and inspected as Preview / Ready. Production was not promoted.

That run passed both jobs: 175 unit tests under the unchanged default runner settings, 22 practice-browser scenarios, 17 real Auth/database-connected browser scenarios, 222 pgTAP assertions, database lint, type checks, application lint, optimized builds and the disposable backup/restore drill. The private/public component and test files matched byte for byte.

In the deployed preview's separate practice database, direct browser interaction selected g on a blank Urea line, then confirmed 250 g / 0.25 kg at ₱8.75 and 500 g / 0.5 kg at ₱17.50 using its sample ₱35/kg price. A 250 g practice sale with ₱20 cash saved with ₱11.25 change, reduced only the local practice stock by 0.25 kg and remained in receipt history after reload. A separate grams-first peso draft stayed blocked at 500 g until weighed confirmation. No hosted business sale, shift or stock movement was created.

Private screenshots are retained under `.impeccable/review/grams-*-deployed.jpg` and `grams-receipt-after-reload.jpg`; business artwork and signed-in staging captures are not copied to the public repository.

The signed-in stable staging window used Settings → Check for app update. The guarded update reopened Checkout with the same five branches, no open cashier shift, 500 kg TEST feeds, 400 kg TEST fertilizer and 50 TEST seed packets. Sync center retained the original four Synced sales and a clear queue. This readback did not create any hosted business transaction or modify stock.
