# Better Yield: stock-loss prevention and long-term operation

Current status, October 27, 2026: later releases added separate physical refund dispositions and [selected-quantity cash refunds](partial-refunds.md), with original-price rounding, owner/drawer authorization and recoverable requests. The dated audit findings below describe the earlier implementation; see [remaining work](remaining-work.md) for current gaps and actual PC/pilot gates.


Research and source review: **October 25, 2026**. Application reviewed: `e84f3fa`; latest preceding documentation: `234d924`. The findings below preserve that pre-implementation audit. Subsequent fixes, tests, staging status and remaining release gates are tracked in [stock-control verification](stock-control-verification.md); staff procedures are in [stock-control operations](stock-control-operations.md).

## Assessment

The owner reports approximately **₱170,000 of missing stock in one month**, identified when counted goods did not match records. The affected branch or branches, valuation basis, reliable opening balance, itemized count and supporting documents are not yet available. Theft is one possible cause, not an established finding. The four synthetic, fully reversed staging sales are software tests and provide no evidence about the real shortage.

The POS already provides useful safeguards: exact unit conversions, permanent sale IDs, local save before success, retry-safe synchronization, immutable movements, batch/expiry records, branch restrictions, separate transfer dispatch/receipt, owner-approved count adjustments and cash reconciliation. These make recorded transactions traceable. They cannot observe goods physically leaving without an entry, inaccurate scales, fictitious receiving, shared accounts or collusion.

**Long-term conclusion:** the architecture can be developed into a sustainable system for five or more branches, but the present version should not be certified for prolonged, high-volume operation yet. The review reproduced a recovery-size defect and identified operational gaps that matter directly to stock accuracy. No responsible assessment can promise zero loss or zero future issues.

## Investigate the ₱170,000 before assigning a cause

Preserve the original count sheets, prior stock reports, supplier delivery receipts, invoices, sales records, returns and branch transfer documents for the period. Keep original exports; corrections should be separate records. Do not erase a discrepancy by changing opening stock or backdating fictional sales.

1. Establish the affected branch, count date/time and a trustworthy opening count. Stop movements during a recount, or explicitly record every movement crossing the count cutoff.
2. Use two people to recount high-value discrepancies. Count unopened sacks separately and weigh loose contents in net kg, subtracting container weight. Separate storage rooms, display stock, customer returns, damaged goods and goods travelling between branches.
3. Normalize every product to its configured base measure. A 25 kg bag, 50 kg sack, kilo, packet and carton are not interchangeable. Keep brands, sizes and lots distinct.
4. Reconstruct expected stock per product, lot and branch:

   **Verified opening + accepted deliveries + received transfers + saleable returns − sales − dispatched transfers − documented losses/other authorized issues = expected physical stock.**

5. Compare expected and counted quantities; investigate shortages and surpluses separately. Match supplier documents to accepted goods and match both ends of every transfer. Check duplicate entries, wrong branches, wrong pack sizes, missing days and goods released on informal credit or for owner/staff use. Credit remains outside this cash-only POS; those releases must not silently bypass the records.
6. Establish what the ₱170,000 represents. Value missing goods using a documented purchase-cost basis for the loss investigation; keep any selling-price estimate separate. The app's configured unit costs are not proof of actual historical invoice cost or a complete accounting valuation.
7. Assign each difference a documented outcome: counting/unit error, receiving error, unrecorded movement, transfer shortage, damage/spillage/expiry, or unexplained shortage. Do not label an employee responsible solely because their shift overlaps a difference.

These procedures adapt inventory-control practice to Better Yield; they do not establish the cause of this incident. Independent counts, separated custody/recording/approval and two-person supervision are supported by the [GAO inventory-count guide](https://www.govinfo.gov/content/pkg/GAOREPORTS-GAO-02-447G/pdf/GAOREPORTS-GAO-02-447G.pdf). It is a control reference, not Philippine retail law.

## Everyday situations the store must handle

The situations below are plausible failure modes to test, not accusations or measurements of their frequency at Better Yield.

| Store situation | Control and realistic example | Present POS / needed change |
|---|---|---|
| Delivery papers say 20 sacks; only 19 arrive, or a bag is damaged | Receiver counts/weighs accepted goods independently, records supplier/reference/lot and rejected quantity before signing; owner reviews the difference | Receiving exists. Ordered-versus-delivered-versus-accepted quantities, evidence and supplier discrepancy resolution need a dedicated workflow |
| Loose feeds are weighed generously, spilled, mixed up or measured with the container included | Check scale zero/tare; use an appropriate verified reference weight and documented calibration arrangements; identify each open sack/lot; record spillage separately | Exact decimal selling exists. Open-sack tracking, tare guidance and categorized loss records are missing. Mathematical precision does not prove scale accuracy |
| Goods leave before payment or a sale is never entered | Cashier saves sale; release staff checks the saved receipt, item, quantity and handover once; use separate staff logins and owner-controlled exceptions | Durable sale exists. Goods handover/collection confirmation and monitored exceptional releases are not implemented |
| A sack is sold as loose kg, or two similar brands/sizes are confused | Explicit pack factors and retail prices; scan/confirm the exact product and lot; keep sealed goods distinct | Configured units exist. Verify the real catalog and scanner/hardware flow; do not assume every agricultural chemical can be split/repacked |
| Ten sacks are sent to another branch; eight arrive | Destination records the actual quantity received, difference and evidence; the remaining two stay unresolved/in transit until investigated | Dispatch/receipt exists, but receipt currently accepts the entire dispatched quantity. Partial/damaged receipt and discrepancy resolution are missing |
| Money is refunded but goods are missing, opened, damaged or expired | Record financial refund separately from physical disposition: resaleable stock, quarantine, supplier return or write-off; retain original sale and approval | Current full refund returns every item to available stock. This must be extended before real-world returns are handled as general stock corrections |
| Pests, moisture, torn sacks or expiry destroy goods | Inspect storage; segregate affected goods; rotate stock and document approved damage/expiry issues instead of hiding them in unexplained adjustments | Lots/expiry and expired-sale validation exist. Quarantine, explicit damage/disposal categories and proactive expiry worklists are missing |
| A physical count is adjusted to match the computer, or an adjustment hides a shortage | Blind first count, independent recount where material, reason/evidence, separate approval and retained before/after values | Count/owner approval exists, but expected stock is visible and the owner can perform both roles. Blind count, independent witness and investigation workflow are needed |
| Seasonal buying leaves too much slow stock or fast sellers run out | Reorder using real demand, supplier lead time, shelf life, available stock and stock already on order | Minimum-stock configuration exists. Purchase orders, stock age, days of cover and suggested reorder quantities are not a complete workflow yet |

FAO specifically links feed storage losses to pests, fungi, handling and physical changes; losses are not all theft. Its pesticide guidance emphasizes receipts/issues, stock rotation, training and avoiding excess purchases. These findings support the storage and reorder controls above. [FAO feed storage](https://www.fao.org/4/x5738e/x5738e0e.htm), [FAO stock planning](https://www.fao.org/4/v8966e/V8966e03.htm).

For expiring goods, prioritize the earliest-expiring **saleable stock actually available at the branch**, and use arrival order where applicable. The current default selects an unexpired batch without checking its branch availability; it is not a complete stock-aware rotation policy. GS1's traceability model supports identifying the goods/lot, quantity, parties, locations and shipment/receipt events. Barcodes alone do not verify a physical count. [GS1 traceability standard](https://www.gs1.org/standards/gs1-global-traceability-standard/current-standard).

Product rules must remain specific. The FPA's published rules restrict pesticide repacking by unlicensed persons and sale of deteriorated/dangerous product. Do not extend loose-feed selling to sealed pesticide containers by default; confirm applicable product permissions and labels before configuration. [FPA pesticide rules](https://fpa.da.gov.ph/wp-content/uploads/2024/05/IRR.pdf).

## Daily operating routine

- **Before opening:** named cashier, counted drawer float, correct branch, recent stock download, scale zero/tare check, storage inspection and unresolved issues reviewed.
- **During trade:** record every delivery, sale, transfer, return and authorized non-sale issue when it occurs. Keep personal/staff goods separate. Cashiers do not use the owner login. Separate receiving and checking where staffing permits; otherwise require independent owner review.
- **After closing and synchronization:** reconcile drawer cash, count selected high-risk/fast-moving products and open sacks, recount material discrepancies, record reasons and assign an investigation owner. Use two people where possible. Do not count against a stale offline stock report.
- **Weekly:** rotate the count selection, review recurring differences by product/lot/branch and supplier, inspect ageing/expiring stock, outstanding transfers, unusual refunds and adjustments. Start with frequent checks after this reported loss; revise frequency from actual results.
- **Monthly:** reconcile the complete inventory, review cost-valued unexplained loss, confirm supplier claims, and compare unresolved cases with earlier months. Do not net unrelated shortages and overages into a reassuring total.

The recommended owner view should show unresolved shortage quantity/value, negative stock, overdue transfers, received-versus-dispatched differences, ageing unsynced sales, near-expiry/held goods, unusual refunds/adjustments and an assigned person/due date. Acknowledging a warning must not erase its source event. Investigation status should survive pagination and remain open until resolved.

## Long-term use: concrete findings

The owner reports **more than 300 sales per branch on a busy day**. The following uses 300 on every operating day as an explicit planning scenario, not a measured daily average.

| Scenario | Per branch | Five branches |
|---|---:|---:|
| 30 days at 300 sales/day | 9,000 sales | 45,000 sales |
| 365 days at 300 sales/day | 109,500 sales | 547,500 sales |

Several item and movement records accompany each sale; those counts and stored payload sizes must be measured before estimating disk needs. Branch count alone does not prove capacity.

### 1. Confirmed recovery-size defect — fix before prolonged pilot

`exportRecovery` includes all retained scoped local sales. `importRecovery` rejects more than **10,000** records. An isolated, in-memory IndexedDB reproduction using valid synthetic records returned:

```json
{"exportedRecords":10001,"restoreResult":"Invalid recovery file","sourceRecordsRetained":10001,"targetRecords":0}
```

The original records remain intact: this is an export/restore incompatibility, **not automatic deletion at sale 10,001**. At 300 records per selling day on one branch PC, the boundary is reached during day 34, earlier at higher volume. Cashier-scoped exports depend on their own record count; an owner branch export can include multiple cashiers.

Implement versioned, bounded recovery chunks with a manifest, counts, stable IDs and duplicate-safe interrupted resume; prioritize unresolved records without discarding them. Restoring synced history must not recreate server sales or incorrectly apply stock deductions. Test 10,000/10,001/100,000 records, mixed states/accounts, partial chunks, corrupt files and repeat restore. Keep existing files compatible. Do not merely remove the guard and make the browser parse an unbounded file.

Evidence: `packages/offline/src/index.ts` (`exportRecovery`, `importRecovery`); isolated reproduction retained locally at `.impeccable/review/recovery-cap-repro.mjs`. No hosted or browser-profile data was read or changed by this reproduction.

### 2. Growing local history and synchronization work — verified source risk

`refreshLocal` reads all saved sale payloads, filters and sorts them. It runs after synchronization; the current interval is 15 seconds during online shifts. `openShift` sends all retained sale IDs to its snapshot, even though ordinary sync already uses unresolved IDs. Full catalog/batch/stock snapshots are also downloaded during each normal sync cycle.

These paths grow with lifetime history. They are not evidence of a measured memory leak, but can cause increasing memory use, latency, network traffic and database work. Add indexed/scoped local history pages, bounded recent display, unresolved counts without full hydration, unresolved-only acknowledgement IDs, and catalog/version-aware refresh. Preserve the atomic stock-plus-acknowledgement rule. Avoid moving the entire yearly ledger into UI state. Retaining history does not require rendering every record.

### 3. Unresolved warnings can fall out of the preview

The overview's flagged-event preview is derived from at most 1,000 recent audit rows. Older audit history remains pageable, but an unresolved issue can leave the preview as new events arrive. Build a persistent exception register with state, owner and resolution, and show its outstanding totals independently of the recent-event limit. Do not imply the whole business has no flagged issues because a recent slice is empty.

### 4. Device storage is a release constraint

The app requests persistent browser storage, but does not expose whether it was granted or show quota/usage health. Browser persistence can reduce automatic eviction; it does not survive deliberate site-data clearing or disk failure. Add visible persistence, estimated usage, low-space and failed-write states; preserve pending records during every migration/update. [MDN storage behaviour](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

This PC's C: drive showed about **0.52 GiB free** during this review. That is a current development-machine observation, not the selected cashier PC or a measured browser quota. It is a poor condition for a storage durability trial. No cleanup or removal of other files was performed. SQLite would still need adequate disk, backup and recovery procedures; it does not eliminate hardware failure.

### 5. Backups, monitoring and maintenance must be operated

The disposable CI restore drill is useful but is not a restored production backup. Define maximum acceptable lost cloud data and restoration time with the owner. Daily backups alone can leave changes since the last backup exposed; if that is unacceptable, use a suitably tested more frequent recovery arrangement. Separately protect pending offline records, which cloud backups cannot contain.

Use independent encrypted backups, retention/versioning, tested restore access and documented key recovery. Include any future evidence photos/files separately: Supabase database backups do not contain Storage objects. Pro currently provides seven days of daily database backups. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

Monitor backup age, disk/database size, checkout failures, oldest pending sale, sync lag, unresolved exceptions, API failures and report latency. Assign a maintainer; review dependency advisories and updates in staging, keep rollback instructions, and regularly rehearse a restore. Do not delete financial/stock history to meet a quota. Managed database capacity limits can affect writes; monitor well before limits. [Supabase disk behaviour](https://supabase.com/docs/guides/platform/database-size).

A fresh read-only npm audit during this review reports **one low-severity indirect finding** (`serialize-javascript`), with a fix available, and zero moderate/high/critical findings. This supersedes earlier point-in-time zero-finding reports. It is not a finding that the running POS has been exploited. Trace the dependency and make/test an appropriate lockfile update in a maintenance change; no forced upgrade was applied here.

### 6. Budget for commercial operation

Published October 25 prices start at **US$25/month for Supabase Pro** and **US$20/month for Vercel Pro**: an indicative **US$45/month starting platform subtotal**, not an actual invoice or guaranteed total. Additional staging/database projects, usage, backup storage, domain renewals, taxes, support, hardware and maintenance can add cost. Cashier app accounts are distinct from hosting developer seats. No plan or billing change was made. [Supabase pricing](https://supabase.com/pricing), [Vercel pricing](https://vercel.com/pricing).

Vercel Hobby is restricted to personal/non-commercial use; plan for appropriate commercial hosting before live branch operation. [Vercel Hobby terms](https://vercel.com/docs/plans/hobby). A free staging project and passing software tests are not a sustainable production operating arrangement by themselves.

## Ordered implementation and verification plan

| Order | Work | Acceptance before calling it done |
|---|---|---|
| 1 — Immediate business control | Preserve/reconcile the reported shortage; independently verify opening stock, product units and named staff access | Signed item/lot/branch count, classified differences, evidence references, unresolved cases visible; no invented history |
| 2 — Release blocker | Repair recovery-size compatibility and remove lifetime-history reads/IDs from frequent paths | Large, resumable, duplicate-safe restore; bounded memory/work at 100k local records; pending records preserved through upgrade |
| 3 — Stock accuracy | Actual/partial transfer receipts; separate refund money from returned-goods disposition; quarantine/damage/non-sale issues | Send 10/receive 8 leaves 2 unresolved; damaged return never increases saleable stock; exact journal and cash reconciliation; retries create no extra effects |
| 4 — Detection and ownership | Persistent exceptions, blind counts/recounts, evidence and independent approval policy | Older unresolved cases remain visible beyond 1,000 events; staff cannot self-approve; late stock movement invalidates stale counts |
| 5 — Prevention | Delivery discrepancy matching, stock-aware expiry rotation, open-sack controls and replenishment | Short delivery recorded accurately; available earlier-expiring lot selected; losses have reasons; reorder respects lead time and shelf life |
| 6 — Capacity and real pilot | Load/soak test, backups, intended Windows PC and staff rehearsal | Test results below plus owner-reviewed daily cash and physical-stock reconciliation |

Capacity verification should use disposable fixtures: at least a one-year planning dataset across five branches, realistic multi-item baskets, historical lots and audit records; five concurrent branch checkouts; peak bursts above the observed rate; a 1,000-sale interrupted backlog; repeated browser open/close; large history/CSV queries; and a multi-shift soak measuring memory, local write time, sync lag, CPU, database queries and bytes transferred. Test catalogue price changes, expired/revoked sessions, lost acknowledgements, low/full disk, interrupted updates/migrations and idempotent recovery. Existing 136 unit checks and 29 browser scenarios are not evidence that this new matrix has passed.

Proposed performance targets, to be agreed and measured on the actual PC: 95% of local checkout commits below one second, ordinary catalog interactions below 200 ms, paged online reports below three seconds on a documented connection, no growth proportional to lifetime sales in a normal refresh, and zero missing/duplicated completed sales. These are engineering targets, not current measurements or guarantees. Financial and quantity integrity are hard requirements even if speed targets need tuning.

Perform the separate physical Windows restart and actual one-hour/eight-hour interruption tests from [the pilot checklist](pilot-checklist.md), check the real scale/printer, and prove production backup restoration. If browser storage fails, use the previously agreed Windows SQLite fallback. Investigate any unexplained variance before expanding past one pilot branch.

The aim is **every stock movement recorded, every discrepancy detected promptly, and every correction attributable**. Software, staff routines and independent checking must work together. A POS alone cannot guarantee that the reported loss will never recur.
