# Magpet TEST run: recovery and cash/stock results

Completed at **1:04 AM on November3,2026**, Philippine time. These were labelled TEST purchases with simulated cash. No real store inventory or physical drawer was certified.

## Result

**All200 original sales reached the server exactly once. No sale, payment or stock effect was duplicated.** Every complete original transaction ID and full sale payload matched the original saved recovery file. Each sale has exactly one matching item, original cash payment and sale stock movement. No sale required pricing/stock review.

| Check | Result |
|---|---|
| One-hour POS-only outage checkpoint | Passed at2:55 PM November2 |
| At least eight hours of local sale retention | Passed; a fresh file exported12:59:43 AM November3 retained all200 complete originals, original authorization and valid checksum |
| Eight uninterrupted offline hours with all200 unuploaded | **Interrupted, not passed.**25 originals uploaded at5:10 PM November2. The cause of this temporary API access was not established. Own-site health requests still failing did not prove complete API isolation. |
| All200 original sales recovered on server | Passed; complete IDs and payloads matched |
| Replaying original recovery file | Passed;200 records checked/restored through normal UI, with all server financial rows and totals unchanged |
| Test shift closure | Passed; only this TEST shift closed with simulated expected and counted cash both₱1,925 |
| Previous sales, payments, shifts and movements | Unchanged; six original-history/other-stock hashes matched |

## Money and stock

| Figure | Verified result |
|---|---:|
| Original purchases | 200 |
| Sales / net cash added to zero-opening drawer | ₱1,925.00 |
| Simulated tender | ₱4,000.00 |
| Change | ₱2,075.00 |
| TEST feed sold | 55 kg |
| TEST feed remaining, server ledger and projection | 445 kg |
| TEST fertilizer remaining | 400 kg |
| TEST seed packets remaining | 50 |
| Extra sale/payment/movement effects after recovery replay | 0 |

The final database contains609sales,620payments and639inventory movements, exactly200 more of each than the original409/420/439 baseline. All seven reconciliation mismatch counts were zero: duplicate sale IDs, negative stock, closed-drawer arithmetic, sale movements, item totals, original payments and ledger/projection consistency. The original baseline file and its private copy also retained their original SHA-256.

The POS showed **Your local queue is clear** after acknowledgments and after replay. Local feed availability remained445kg: server confirmation did not deduct the same stock a second time. The test shift closed online at1:03:49 AM November3 with expected/count both₱1,925. These amounts are simulated; they are not a physical cash count.

## Evidence retained privately

Fresh retention export: `E:\New folder (2)\agristore-recovery-85f5c8b0-5ca9-4171-8a0d-1b46adf9a356-part-1-of-1.json`. Its actual export time was `2026-11-02T16:59:43.114Z`, later than the required `13:59:10.835Z`. The complete record check is `.impeccable/review/magpet-endurance-record-check-1793638837693.json`.

Final evidence under `.impeccable/review/` includes `magpet-endurance-final-verdict.json`, `magpet-endurance-final-server.json`, `magpet-endurance-final-server-verdict.json`, `magpet-endurance-replay-server-verdict.json`, `magpet-endurance-final-history.json`, `magpet-endurance-closed-shift-verdict.json` and `magpet-endurance-closed-reconciliation.json`. The live state is `magpet-endurance-20261102.json`; original recovery files and TEST receipts remain intact. Keep these financial records private.

![Closed TEST shift and clear queue](../.impeccable/review/magpet-endurance-final-queue.png)

## What this does not certify

Repeat the strict eight-hour offline test using independently verified API isolation before claiming that gate passed. A Windows restart, whole-PC power/internet interruption and actual cashier hardware were not tested. Before real Magpet use, select the cashier PC/profile, verify scales/printer and actual opening stock/costs/units/lots/expiry, use individual staff accounts and separate stock approvers, restore a real production backup in isolation, and run the controlled one-branch pilot with daily signed cash/stock reconciliation.

The temporary awake request ended as planned without changing the saved power plan. The single-run follow-up automation is stopped after settlement; no more purchases, refunds, stock resets or replacements are needed for this run.
