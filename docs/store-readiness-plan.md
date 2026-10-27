# Store-use and readiness plan

October 28, 2026. Cover the common operating and recovery situations below, preserve evidence when an unexpected situation occurs, and stop an affected workflow when its safety checks fail. No plan can guarantee that every incident is prevented. The current site is staging; completing software work does not certify an unchosen cashier PC, real physical inventory or a production backup.

## Implementation sequence

| Stage | Deliverable | Acceptance |
|---|---|---|
| 1. Establish the operating boundary | Cash-only, exact kg/grams/meter/liter/ml/piece conversions, named branch roles, immutable sales/stock history | Existing documented workflows and their full verification gate; customer credit, electronic payments, full accounting and official tax invoices remain excluded |
| 2. Make routine and incident guidance available in the app | Settings → PC checks & store guide; sixteen expandable procedures, available with the cached application | Readable desktop/390/320 px, keyboard and accessibility checks; instructions available offline without permitting online-only actions |
| 3. Make unresolved records visible before maintenance | Complete pending-sale/request counts, authentication/review states, other-account warning, catalog timestamp, remaining lease, storage/cache observations | Includes records beyond the recent fifty receipts; no other employee's request contents; no false “ready for launch” indicator; no local or server business write |
| 4. Pause on access expiry during an upload batch | Authentication-required state without consuming network attempts; preserve committed-but-unconfirmed and owner-review records | Simulated expiry before and after a real server commit, original-ID retries, no duplicate sale/payment/movement, exact cash and quantity |
| 4a. Retain uncertain requests on native timeouts | Distinguish full SQLSTATE strings from numeric browser timeout codes; retain original receiving IDs and recovery evidence | Native timeout/abort, incomplete codes, genuine SQL rollback, repeated timeout and original duplicate-acknowledgment regressions |
| 5. Verify and release staging | Type/lint/unit/production build, practice and genuine Supabase/Auth browsers, permission/database checks and real disposable dump/restore | All jobs pass for the exact release source, stable alias read back, hosted business data preserved |
| 6. Establish real store readiness | Hardware, individual staff, independently verified inventory, production hosting/backups | Owner supplies the signed evidence below; one-branch pilot before expansion |

Stages 2–4 are implemented in this follow-up; its final automated and deployment evidence is recorded in [verification](operating-readiness-verification.md). Stages 1 and existing controls are detailed in [stock-control verification](stock-control-verification.md). Stage 6 remains open until the actual checks pass. Follow [the test-session worksheet](next-test-session.md) and [pilot checklist](pilot-checklist.md).

## Situations the operating plan covers

| Situation | Staff response and control | Evidence / limit |
|---|---|---|
| Opening a branch | Check account/branch, scale tare, actual opening cash; download catalog; inspect expiry/holds/cases; open own shift online | Individual identity and displayed authorization, signed physical starting point |
| Loose or packaged sales | Read actual unit conversion and retail price; weigh kg/grams or measure meter/liter/ml; confirm actual weight for a peso request; pieces remain whole | Saved receipt and measured quantity; real measuring devices still need checks |
| Wrong product, price or unit before saving | Fix the basket before payment; check configured price/unit and physical lot | Do not compensate with a false quantity; sensitive price changes require their authorized online path |
| Recorded offline price differs after reconnect | Retain the recorded sale and original price; review server discrepancy flags | Do not edit a completed sale or silently reprice it |
| Two identical purchases or double click | Each separate checkout keeps a separate ID; retry the same failed/ambiguous attempt with its original ID | One acknowledgment/payment/movement per transaction; no content-based deduplication |
| Storage failure or unclear checkout result | Check Sync center; a failed save is not a receipt; preserve basket and original evidence | Stop goods handover on failure; stop pilot if success was shown without persistence |
| Network/power/browser/Windows interruption | Resume same profile and authorized shift; verify receipts; reconnect and synchronize original records | Twelve-hour authorization ceiling; actual sixty-minute/eight-hour/restart tests remain required |
| Sign-in expires during uploads | Pause authentication-required records; renew original identity; verify original IDs after reconnect | Do not consume network retry allowance, duplicate sales or overwrite an existing owner-review outcome |
| Access revoked, staff leave or wrong account | Owner checks role/branch, retrieves device and evidence; no account sharing | Disconnected devices learn revocation when they reconnect; protect the remaining authorization window operationally |
| Cashier/owner unavailable | Retain completed records and closed/open drawer evidence; authorized staff continue only permitted work | Owner-only actions wait for authorized access/recovery; no password-sharing or self-approval workaround |
| Partial, short, damaged or rejected delivery | Match approved order; inspect document/accepted/held/rejected quantities and lots; retain supplier claims | Only accepted goods enter saleable stock; a claim note does not settle supplier credit |
| Saved receiving or opening import mistake | Guarded untouched inspection reversal and linked correction; independent evidence for dependent/legacy reconciliation | No force reversal, duplicate receipt/import or deletion of later activity; broader reconciliation workflow remains a specified gap |
| Transfer partly received, lost or damaged | Keep dispatch and receipt separate; record actual saleable/held goods; investigate remaining transit | Explicit owner loss decision; no second origin deduction |
| Expiry, damage, spillage or internal use | Segregate actual goods, submit measured issue, owner approves or rejects a mistaken pending request | Pending/rejected requests do not change stock; disposal of held goods does not deduct saleable stock twice |
| Count mismatch or movement during count | Freeze cutoff, close shifts/sync, use two separate blind counters and a third approving owner | Disagreement/stale counts require a fresh count; preserve investigations and original observations |
| Missing-stock value or alleged theft | Use itemized differences and documented purchase cost; assign investigator/deadline and retain progress | An adjustment/rejection does not prove cause; missing cost is unvalued, not zero; reported historic loss remains unverified |
| Customer returns part of a purchase | Find original receipt; inspect actual returned quantities; owner/drawer refund selected remaining quantities | Cash and physically returned goods are distinct; no full refund after a partial refund |
| Mistaken saved refund | Full recovered cash and untouched-stock preview; immutable correction and linked replacement | Dependent/legacy evidence requires owner reconciliation; exchanges and price-only concessions need separate agreed workflows |
| No receipt, disputed return or unpaid request | Preserve the claim and identify original evidence; owner reviews | Do not invent a receipt, report unpaid goods as cash paid or use false quantities to create credit |
| Printer fails or customer wants another copy | Reprint the existing saved receipt/reference when equipment works | Printing failure does not cancel the sale; never sell again to print again; official tax invoice remains outside pilot |
| End of day / handover | Finish basket, synchronize, count cash, explain variance, close shift online; review stock/cases/holds/transit | Signed daily reconciliation; do not hide cash differences with stock adjustments or fictitious refunds |
| Low browser storage, failed PC or replacement | Protect original profile; export every recovery part to protected separate storage; authorized restore/retry | Browser persistence is not backup/Windows free disk space; stop pilot and implement SQLite fallback if the browser-storage gate fails |
| Multiple windows or wrong clock | Use one dedicated cashier window and automatic accurate Windows time | Cross-window sign-out clears unfinished baskets; saved sales remain; never advance/reverse the clock to evade authorization/expiry |
| App update | Clear basket and resolve pending requests/sales; use guarded Settings update and reopen | Do not reset site data or uninstall; preserve the exact stable browser origin |
| New branch or employee | Owner creates branch, assigns individual role, verifies stock/conversions and imports opening once | Add hardware and training evidence for each new branch; five branches is not a fixed software limit |
| Stale reports, pagination or export | Check branch/date/category/snapshot, refresh failed filters and load required pages | Full-range totals and loaded-row CSV have different scopes; protect exported records |
| Months/years of use and busy days | Review capacity, queue delays, query plans, access, stock differences and backup restores regularly | Existing annual synthetic sizing supports planning; it does not prove a current hosting plan can handle every real workload or price |
| Full outage with unusable PC | Stop app checkout; owner controls any separately numbered manual contingency record and later reconciliation | No automated paper-slip import is delivered. Before back-entry, compare reference IDs and goods/cash to avoid counting one purchase twice |

## Day-to-day ownership

The owner names a daily cash/stock reviewer, an independent counting pair, a technical maintainer and a backup/recovery owner. Record their names and contact method in the store's private operating sheet. Never put passwords, recovery contents or sensitive personnel allegations in public bug reports.

- **Opening:** account/branch, drawer cash, scale/tare, stock/catalog snapshot, expiry/holds/transit, unresolved queue and authorization time.
- **During selling:** save before goods leave; retain original requests during interruptions; check actual units/price/lot; keep held goods separate.
- **Closing:** every cashier queue checked, physical cash reconciled, shifts closed online, unresolved cases assigned with deadlines and evidence.
- **Daily technical review:** failed uploads, storage pressure, unacknowledged records, missed backup runs and unusual cash/stock movements.
- **Weekly:** rotate independent counts of valuable/fast-moving/loose products; review overdue claims/transfers/investigations and staff access.
- **Monthly and after significant changes:** compare full inventory/cost-valued differences, review actual hosting growth and maintenance updates; rehearse recovery and record backup-restore results. Choose and record an acceptable lost-data window and recovery time before launch.

## Real-store release gates

1. Select the first branch and actual Windows cashier PC. Keep one normal Edge profile, same stable address and persistent storage. Complete at least 200 labelled TEST cash purchases, two identical consecutive purchases, sixty actual offline minutes, eight actual hours and a Windows restart within the twelve-hour authorization period. Reconcile every ID, cash and stock. Include busy-day bursts representative of the reported 300+ daily sales; the test must use the real catalog and pack definitions.
2. Check quarter/half-kilo and grams, peso requests against actual scale weight, rope measurements, liter/ml measures and whole pieces. Record scale/printer models, tare checks and readable physical output. Do not use an estimated quantity as a measured fact.
3. Prepare signed independent opening counts by branch/product/lot, actual conversions, expiry and purchase documents. Separate held/in-transit goods. Import each opening once into the eventual production business; never use staging TEST balances as real opening stock.
4. Use real separate staff accounts and rehearse prohibited actions, first count/recount/third-person approval, receiving, mixed transfers, held outcomes, partial refunds and recovery of a lost response. Plan owner absence and staff departure without sharing passwords.
5. Configure a separate commercial production environment with a responsible maintainer, capacity, recovery objectives, encrypted off-site backup and retention. Restore an **actual production backup** into a functioning isolated environment and compare sales, payments, stock, holds, transit and evidence. No paid settings or backup schedules are created by this follow-up.
6. Pilot one branch with daily signed cash/stock reconciliation and no unresolved completed-sale losses or duplicate effects. Document and fix failures before expanding. A missing completed sale, false save-success or duplicate stock/cash effect fails the pilot: preserve evidence and stop real use.

## Work deliberately not claimed as complete

Real hardware/endurance, verified business inventory, individual staff rehearsal, actual cloud-backup restoration and pilot operation remain unpassed. Broader reconciliation for older/dependent deliveries and refunds needs an explicit audited design, not a force button. Unspecified advanced reports, automatic investigation escalation, exchanges and price-only concessions are separate requirements. Credit, electronic payment processing, full accounting, AI/marketing and official tax-invoice issuance remain outside the agreed initial pilot. Follow the [current remaining-work register](remaining-work.md) for those boundaries.
