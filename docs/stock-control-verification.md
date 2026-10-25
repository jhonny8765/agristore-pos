# Stock controls and durability verification

Original stock-control release: October 25, 2026. Latest client follow-up assigned to staging: October 26, 2026 (Asia/Manila). This is staging work. It does not certify production or explain the reported real stock loss.

## Checkout, stock-download and cross-window follow-up

Application source `30fe3bb` adds save-time lot checks and guards outstanding synchronization/download responses against a changed cashier context. Verification source `b763ad2` contains the same application code and corrects two new browser tests' product-button selectors to include the unit-bearing accessible names.

Before the fix, four new unit cases reproduced failures: an open basket could save an expired lot after Manila midnight, a missing or removed/foreign lot could be saved, and a previous synchronization runner could continue after another window cleared the account cache. The existing completed-sale retry case already passed and remains unchanged: an original saved purchase retains its UUID and can upload after the lot subsequently expires.

The durable checkout transaction now checks the current product/lot again before committing a new sale. Synchronization verifies its original cashier lease and lock ownership after network responses, before continuing or recording results. A late error cannot reset a successor's Synced sale or remove the successor's lock. Stock downloads carry a local request marker; an older response cannot overwrite a newer request, even if the newer download failed. Cache clearing invalidates outstanding requests. Stock, acknowledgments and last-sync time commit together. The interface reads its local stock/queue in one consistent read transaction and ignores obsolete startup responses.

Supabase's cross-window SIGNED_OUT event immediately returns other windows to sign-in and clears temporary baskets/private views. Its cache-clearing task does not call Supabase inside the Auth callback, and the subscription is cleaned up. Completed sales and queued operation requests are retained. No database schema, grants, RLS, price rules or dependency changes were required.

Ten added unit cases cover save-time expiry/current lots, the original committed retry, account clearing during upload, late snapshots, successor lock/results and reordered/failed downloads. A new real Chromium case leaves a basket open over Manila midnight while offline: completion is rejected, no sale-success or saved record appears, and cash/basket remain. A new database-connected two-window case holds a real successful stock response, signs out in the other window, releases the old response and verifies both sign-in views, an empty private catalog and sign-in after reload. These are isolated synthetic fixtures, not cashier-PC acceptance.

The deployed preview also passed a manual local-only practice purchase: typed `1/4` kg at its sample ₱33.60/kg price, charged ₱8.40 from ₱20, displayed ₱11.60 change and reduced sample feeds from 2,100 to 2,099.75 kg. Reload retained the same `af3c87d4` transaction prefix and ₱8.40 in Sync center. No browser warnings/errors were captured. These practice prices differ from the hosted TEST product's ₱35/kg and the practice record never uploads. Screenshots are retained locally as `.impeccable/review/boundary-preview-sale.jpg` and `boundary-preview-recovered.jpg`.

The first full run [40208403656](https://github.com/jhonny8765/agristore-pos/actions/runs/40208403656) passed all prior scenarios but failed the two new browser cases before exercising their target paths: exact Add-product selectors omitted the unit suffix. The corrected overnight scenario passed locally against an optimized build.

The corrected full run [40209168031](https://github.com/jhonny8765/agristore-pos/actions/runs/40209168031), source `b763ad2`, **passed both jobs**: 158 unit tests, 20 practice-browser scenarios, 14 database-connected browser scenarios, 150 pgTAP assertions, database warning gate, type checks, zero-warning application lint, optimized builds and the 21-table recovery drill. The new overnight-expiry case passed in 1.5 seconds and the held-response/cross-window sign-out case in 1.4 seconds. CI screenshot upload still encountered the existing GitHub artifact-storage quota; this non-blocking attachment step is not evidence that screenshots were uploaded. Browser results and restore assertions are present in job logs, and the manual preview captures are retained locally.

After success, preview `agristore-dch2r97u8-team-payaman2.vercel.app`, deployment `dpl_BDtnvJ3nciRTdePB6cUqZsV4q1r1`, was assigned to [stable staging](https://agristore-pos-staging-team-payaman2.vercel.app/). Vercel inspect of the stable address returned that same deployment with Preview / Ready. Its application source is `30fe3bb`; the subsequent verification commit changes test selectors only. No production promotion, new migration or hosted business mutation occurred. The preview's clean build retained the 37-file offline shell. An existing open app still needs its guarded Settings update; an alias change alone does not prove an installed PWA has activated the new worker. Actual hardware gates and the separately listed unfinished workflows remain open.

## Controls delivered to staging

- Recovery exports contain unresolved sales in versioned, checksummed, numbered parts. Stable transaction IDs survive repeated/out-of-order restores. Legacy files above 10,000 records are supported with bounded writes and server-verified acknowledgments.
- Local recent-history reads use indexes and retain every unresolved record. The interface loads older history explicitly. Normal synchronization sends unresolved IDs in bounded requests and reuses an unchanged catalog version.
- Unresolved sales/count/delivery/return/transfer differences have a persistent investigation register. A later audit entry cannot push a case out of its outstanding total. Historical sales flags and physical count differences are carried forward with their original dates.
- Transfers record actual saleable, held and missing quantities. Outstanding goods stay in transit; owner-approved loss never deducts the dispatch twice.
- Full cash refunds record actual physical returns separately, including a split between inspected saleable goods and held goods. Unreturned or uninspected goods do not automatically reappear as saleable stock.
- Damage, spillage, expiry, supplier return, internal use and unexplained issues require owner approval before stock changes. Held release/disposal retains an immutable event. Expired goods cannot be released for sale.
- Owner approval of their own count requires a matching independent recount and witness name. This is attested evidence, not separately authenticated witness approval. A complete blind-count workflow remains outstanding.
- Settings displays browser persistence and estimated storage usage. The low-severity indirect serialization dependency was updated in the lockfile; the lockfile audit reports zero known vulnerabilities at this check.

## Evidence collected

| Check | Result / scope |
|---|---|
| Unit suite | 146 passed, including 10,000 retained receipts, stable 1,001-record multipart recovery, legacy 10,001-record restore, full-input validation before writes and bounded/cached snapshot handling |
| Browser capacity | Passed with 100,000 retained synthetic receipts; reload, another checkout, unresolved-only recovery export, another reload and retained count of 100,001 |
| Application CI | Full [40139420675](https://github.com/jhonny8765/agristore-pos/actions/runs/40139420675) passed on source `86ea026`: 146 unit tests, 18 practice-browser scenarios, 13 database-connected browser scenarios, type checks, zero-warning application lint and optimized builds |
| Database gate | 150 pgTAP assertions, database warning gate and disposable backup/restore drill passed. Earlier runs caught an ambiguous SQL alias and warnings; those were corrected rather than waived. The pipeline now fails on database warnings |
| New workflow checks | Passed assertions for partial transfers, duplicate/changed retries, held release/disposal, role isolation, split physical returns, expired-release rejection and old unresolved cases. The owner-screen transfer/issue scenario also passed responsive field/record containment and selected WCAG axe scans at 1440px and 390px |
| Five-branch capacity | [40138585709 passed](https://github.com/jhonny8765/agristore-pos/actions/runs/40138585709): 547,500 synthetic historical sales, 1,095,000 item rows and 1,095,000 sale movements, five concurrent new sales with duplicate retries and 1,000 subsequent uploads. Seed 171.2 seconds; snapshot plus dashboard 0.79 seconds; uploads 61.5 seconds in that CI environment |
| Hosted migration / deployment | Migration `20261024175820_stock_control_durability.sql` applied to staging project `vbmnnouwmxcuibywdkjw`; migration history aligned with the repository version. Source `86ea026` deployed as `dpl_Fgnwu5Lti1s4e67PPRNbr61CUMmY` and assigned to the stable staging address |

The annual fixture represents **300 sales per branch on every one of 365 days** across five branches. The owner reported more than 300 on busy days; this is a planning scenario, not a measured average. Historical bulk seeding tests data size, keys, indexes and projections. Only subsequent checkouts use the transaction API. It does not replay every historical sale through the browser or simulate elapsed Windows use.

## Hosted rehearsal and scoped interface review

The owner session used the deployed app, its safe update control and a fresh reload. All four earlier local receipts remained synced; the operation queue was clear. No existing transaction or site data was cleared.

A labelled synthetic stock issue `8b04f5e1-e651-4bfa-b2df-58f5fd7ba6ac` requested a 0.25 kg hold of TEST Grower Feeds at Magpet. Independent database reads confirmed:

- Pending request: saleable stock remained **500.000000 kg**.
- Owner approval: saleable stock **499.750000 kg**, held stock **0.250000 kg**.
- Owner release with labelled inspection reason: saleable stock **500.000000 kg**, held stock **0.000000 kg**, exactly one removal movement and one disposition event.

The new investigation was resolved with its recorded results. Backfill also surfaced a historical, explicitly labelled software-rehearsal count; its original reason identified a simulated correction to the 500 kg baseline. Its resolution records that documented test cause and preserves the count/adjustment. Neither resolution alleges real missing stock or theft.

Final independent checks: four sales and four linked reversals retained, no open shifts, no pending stock issues, zero held quantity, zero open investigations and two retained resolutions. Every branch/product stock balance matched its pre-test baseline; ledger-versus-projection mismatches were **zero**. No real sale, cash receipt or supplier delivery was created in this rehearsal.

The initial finish review required wrapping the new stock context and keeping active approvals with the same record at narrow widths. The correction was captured at desktop 1440×1000, mobile 390×844 and the actual browser 1280×720. The fresh reviewer scored that one fix **resolved / ship at its scope**. This is not a whole-system reliability certification. At 390px, the held-stock region measured 259px client width and 259px scroll width, with no document overflow. The design documentation was updated after the correction. The single mechanical detector pass returned no findings; it was not rerun to substitute for visual review.

Native captures are retained locally under `.impeccable/review/stock-*-fixed.jpg`; the reconciled result is `stock-controls-result.jpg`.

The first annual fixture used one long ledger-loading transaction and was cancelled after approximately 13 minutes without a result. The passing fixture commits ledger setup in bounded batches with validation and projection triggers still enabled; record counts and checkout/retry assertions were retained. This distinction concerns fixture loading and does not establish real-world cashier latency or elapsed durability.

Post-migration security advice still reports the existing disabled leaked-password protection setting. Performance advice reports 43 unindexed foreign-key information findings and nine unused-index information findings on the small staging data set; these are not a zero-advisory claim. The prior membership-policy per-row-auth warning is no longer reported. No indexes were dropped based on low-traffic staging usage.

## Recovery and failure-injection follow-up

[40141010635 passed](https://github.com/jhonny8765/agristore-pos/actions/runs/40141010635), source `0fa05df`: **148 unit tests, 19 practice-browser scenarios, 13 database-connected browser scenarios, 150 database assertions**, warning-free database lint, type checks, application lint, optimized builds and the expanded restore drill. The earlier [40140523679](https://github.com/jhonny8765/agristore-pos/actions/runs/40140523679), source `2932af5`, also passed. The application, schema and dependencies are unchanged from deployed source `86ea026`; these changes extend tests and handover documentation. No new deployment or hosted migration was required.

Two new unit cases inject storage failures after writes have begun. An interrupted recovery part leaves no partially imported sales or false completion marker; the original export remains intact, and retry imports each record once. A failed snapshot transaction rolls back catalog, stock, version and acknowledgments together, preserves the pending sale and its local deduction, and subsequently recovers without a double deduction. These use IndexedDB emulation, not physical disk faults.

The new real Chromium case aborts the native IndexedDB transaction after the sale's add request succeeds but before commit. The UI shows an error with no saved-sale success, preserves the basket/cash, retains zero sales from the aborted transaction, then retries under the **same permanent checkout ID**. Exactly one saved sale remains after retry and reload. The case passed in 1.9 seconds in that run; it is simulated transaction failure in an isolated browser profile, not a Windows power-loss or disk-full test.

The expanded disposable backup fixture records an original sale/payment, full linked refund with held goods, approved damage hold and a transfer with saleable/held receipt and **0.75 kg still in transit**. It compares row counts and content hashes across 21 application tables immediately after dump/restore, verifies stock and acknowledgments through the authenticated transaction API, retries the original requests without additional effects, and performs a new held-stock release after restoration. The original branch returns 10.25 kg before the new release and 10.5 kg after it; destination saleable stock remains 2 kg. Immutable sale updates still fail and ledger/projection differences are zero. This proves recovery of that complete synthetic workflow, not a scheduled cloud backup or annual-size restoration.

A read-only hosted check during this follow-up confirmed the existing four sales/four reversals, zero open shifts, zero pending issues/held quantity/open investigations and zero ledger/projection differences. This test pass wrote no hosted business transactions and made no account/session changes.

See [the owner test-day guide](owner-next-steps.md) for a 200-purchase rehearsal with explicit cash/kilo expectations, and [remaining release work](remaining-work.md) for the unfinished features and release gates.

## Measured annual storage and retry capacity

[40141010629 passed](https://github.com/jhonny8765/agristore-pos/actions/runs/40141010629), source `0fa05df`, in the disposable Linux database. It retains the 547,500-sale annual scenario above, with two product lines per historical sale and all validation/projection triggers enabled. After five concurrent new purchases, 1,000 additional uploads and ten further same-stock purchases, it contains **548,515 sales, 548,515 payments and 1,096,015 sale movements**.

| Additional check | Measured result |
|---|---|
| Replay all 1,000 uploaded payloads with the same IDs/content after deliberately discarding initial acknowledgments | Every response Duplicate; no added sales, payments or movements; 0.69 seconds |
| Twenty simultaneous attempts at the same branch/stock/shift, two attempts for each of ten separate purchases | Exactly one Created and one Duplicate acknowledgment per purchase; 2.22 seconds |
| Changed cash contents under an existing burst transaction ID | Review response; original retained |
| Two authenticated branch receipt pages at annual history size | 100 distinct displayed IDs, correct branch, 0.15 seconds for the two SQL page queries |
| Final ledger vs stock projection | Zero differences |
| Snapshot with 1,000 acknowledgment IDs plus dashboard | 1.06 seconds; serialized snapshot JSON 40,085 bytes |
| First 51-row receipt-page query result | Serialized JSON 59,561 bytes; the app displays 50 and uses the extra row for pagination |
| Original 1,000 sequential API-function uploads | 93.5 seconds |
| Fixture loading | 277.9 seconds, historical bulk seeding rather than browser checkouts |

Public application table/index growth measured **1,709,842,432 bytes (1,630.6 MiB / about 1.59 GiB)**, or approximately 3,117 bytes per retained sale in this particular two-line fixture. The complete Postgres database measured **1,723,160,243 bytes (1,643.3 MiB)**. Largest retained relations were sales at 856,252,416 bytes, inventory movements at 294,158,336 bytes, sale items at 224,616,448 bytes, audit events at 187,441,152 bytes and payments at 132,112,384 bytes, including their indexes. The small stock projection occupied 14,647,296 bytes after repeated transactional updates; physical allocation can exceed its live-row content.

Measurements use Postgres database/relation-size functions. They **exclude WAL/system disk, backups, browser storage, HTTP traffic and browser rendering**. Timing covers SQL and the actual authenticated transaction function, not end-to-end queue clearance, client retry intervals or a particular hosted plan. The fixture has a small catalog and does not establish large-catalog/lot capacity, actual item-per-sale averages, annual-size restore time or years of elapsed hardware durability. Do not multiply this size into a guaranteed multi-year cost forecast. Supabase distinguishes database size from additional disk consumption in its [size guidance](https://supabase.com/docs/guides/platform/database-size).

The first expanded run [40140420392](https://github.com/jhonny8765/agristore-pos/actions/runs/40140420392) stopped because its new result parser counted the echoed test-login claims as an extra acknowledgment (1,001 instead of 1,000). Commit `0fa05df` validates that prelude separately and still requires all 1,000 sale responses. The corrected run passed; the earlier harness failure is not evidence of an extra POS sale.

## Required before a real pilot

The test in-app browser explicitly reports that persistent storage is **not granted**. This is not the selected Edge cashier installation. Validate storage on the intended PC; a storage failure blocks pilot release and triggers the planned Tauri/SQLite fallback.

Choose the real cashier PC and pass the actual timed outage, Windows restart, eight-hour storage stress, printer/scale and staff-rehearsal gates. Establish a verified opening count and cost basis. Test a real cloud backup restoration and document recovery objectives, backup ownership, maintenance and daily branch reconciliation.

Production Auth/password-protection settings, paid hosting/database capacity and backup subscriptions still require an account-specific operational decision. No billing settings were changed. The synthetic database table/index footprint is now measured above; the actual account's storage/backup cost, total disk headroom and production sizing have not been established. Earlier heavy trials ran in disposable CI when the development drive was nearly full. This follow-up found about 15.6 GB free and completed a local optimized build and targeted browser test; this is still not the chosen cashier PC. Database and restore gates continued on disposable CI.

Purchase-order matching, completely rejected supplier deliveries, purchase cost valuation of unresolved loss, due-date/assignee escalation, proactive expiry worklists, authenticated second-person approval, partial financial refunds and broader operational reporting remain separate work. Existing batch metadata/expiry blocking does not imply these workflows are complete.

See [the staff/owner routine](stock-control-operations.md) and [the original loss and sustainability review](stock-loss-and-sustainability-review.md). Original sales, payments, stock movements and test reversals are retained.
