# Stock controls and durability verification

Date: October 25, 2026. This is staging work. It does not certify production or explain the reported real stock loss.

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

## Required before a real pilot

The test in-app browser explicitly reports that persistent storage is **not granted**. This is not the selected Edge cashier installation. Validate storage on the intended PC; a storage failure blocks pilot release and triggers the planned Tauri/SQLite fallback.

Choose the real cashier PC and pass the actual timed outage, Windows restart, eight-hour storage stress, printer/scale and staff-rehearsal gates. Establish a verified opening count and cost basis. Test a real cloud backup restoration and document recovery objectives, backup ownership, maintenance and daily branch reconciliation.

Production Auth/password-protection settings, paid hosting/database capacity and backup subscriptions still require an account-specific operational decision. No billing settings were changed. Annual database disk footprint and the actual account's storage/backup cost have not been established; capacity timing alone is not a hosting-size or cost forecast. The development PC had very low Windows free space, so heavy builds/database trials ran in disposable CI rather than on this drive.

Purchase-order matching, completely rejected supplier deliveries, purchase cost valuation of unresolved loss, due-date/assignee escalation, proactive expiry worklists, authenticated second-person approval, partial financial refunds and broader operational reporting remain separate work. Existing batch metadata/expiry blocking does not imply these workflows are complete.

See [the staff/owner routine](stock-control-operations.md) and [the original loss and sustainability review](stock-loss-and-sustainability-review.md). Original sales, payments, stock movements and test reversals are retained.
