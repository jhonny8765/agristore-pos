# Next cashier-PC test: record sheet

**Status: the new run has started.** Follow the [active-run handoff](endurance-active-run.md) for the original pending batch, baseline recovery file and actual/planned times. The physical outage, Windows restart and timed checkpoints remain unverified. Use Test Branch 4, TEST goods and simulated cash. Keep the installed Better Yield app and the same Brave Work profile. Do not use customer purchases for this test.

## Already checked

- Persistent storage is granted in the tested Brave profile.
- The first 200 TEST sales synchronized once: ₱1,925, 55 kg sold, 195 kg remaining.
- All original IDs/payloads survived an offline reload. Replaying the recovery file created no duplicates.
- The first test shift is closed, with counted/expected simulated cash both ₱1,925.
- The latest completed-run read still matched those results before the new run. A new TEST shift and 200 pending purchases now exist; they are identified in the active-run handoff. Do not start a duplicate run from this blank worksheet.

These results cover a 9-minute-49-second tab outage, not the longer checks below. See [the completed rehearsal](installed-cashier-rehearsal.md) for evidence.

## Before starting

1. Save other work. Reserve this PC for eight actual hours and one normal Windows restart. Use a staging test account and keep the worksheet available offline.
2. Open the installed POS app online. Check **Test Branch 4**, storage protection, empty basket and clear Sync center.
3. Record the fresh price, opening stock and device/profile. Expected current values are **₱35/kg and 195 kg**; refresh and recalculate if they changed.
4. Open a **new** TEST shift with **₱0** opening cash. Record its authorization expiry. Finish the offline test before that twelve-hour deadline; do not change the clock.
5. Keep the earlier 200 sales and E:\ recovery files. Do not restore an old file to create a new purchase or erase the earlier test history.

| Record | Actual value |
|---|---|
| Tester / PC / Windows version | |
| Brave version / same profile confirmed | |
| Storage protection result | |
| New test shift ID | |
| Shift opened / authorization expires | |
| Starting feed stock / price per kg | |
| Network disconnected at | |
| Sixty-minute checkpoint at | |
| Windows restarted at / reopened offline at | |
| Eight-hour checkpoint at | |
| Recovery export filename(s) | |
| Reconnected at / synchronization finished at | |
| Actual saved count / sales amount / final stock | |
| Expected/count cash / shift closed at | |
| Error or discrepancy and retained evidence | |

Use actual local dates/times (Asia/Manila), including the date if crossing midnight.

## The new 200-purchase worksheet

Use simulated ₱20 cash for each purchase. Record and check change; never hand real goods over for these test entries.

| Purchases | Entry | Actual recorded amount per sale | Due | Change |
|---:|---|---:|---:|---:|
| 50 | Type `1/4` kg | 0.25 kg | ₱8.75 | ₱11.25 |
| 50 | Type `0.5` kg | 0.5 kg | ₱17.50 | ₱2.50 |
| 50 | Switch to grams; enter `100` | 100 g | ₱3.50 | ₱16.50 |
| 50 | Request ₱10; estimate; enter and confirm a TEST reading of 250 g | 0.25 kg | ₱8.75 | ₱11.25 |

With unchanged price and no other movements, this **new shift** adds **200 new IDs, 55 kg and ₱1,925**. Starting at 195 kg leaves **140 kg**. Opening cash is zero, so this new drawer closes at **₱1,925**. The earlier closed shift remains separate; do not count its ₱1,925 again in the new drawer.

## During the outage

1. Disconnect the PC's network for the physical test. Record the actual time. Each purchase must show **Sale saved** and remain in Sync center. Consecutive identical purchases must have different IDs.
2. Keep the network disconnected for at least sixty real minutes. Check the count, amounts, stock and original references at that checkpoint. Do not change the PC clock.
3. Export every recovery part and verify the files exist. Keep the originals and a protected separate copy when available. If an export fails, preserve the original app/profile and records; record the failure.
4. Close and reopen the installed app/browser. Then perform a **normal Windows restart** while disconnected, after other work is saved. Reopen the same installed app/profile and compare the saved records. A tab reload is not a Windows restart.
5. Keep the completed pending records for the full eight actual hours. Recheck count, original IDs, cash totals and stock at the end. Stop test selling if authorization expires; retain every completed record.
6. If a completed sale disappears, a save fails after claiming success, stock changes unexpectedly or a duplicate appears, stop the test. Keep the PC/profile, recovery files, exact error and times. Do not clear site data, uninstall the app or re-enter the purchase.

## Reconnect and finish

1. Reconnect. Renew the original identity's sign-in if requested. Wait for every original sale to be acknowledged and the queue to clear.
2. Compare complete original IDs/payloads, exactly one payment and stock effect per sale, new-shift cash and the ledger/balance. Account for any additional tests separately.
3. If the starting baseline and worksheet remained exact, the new run is **200 sales / ₱1,925 / 55 kg**, ending at **140 kg**. The branch then has 400 TEST sales across two separate shifts. Never use the combined branch total as the cash in the second drawer.
4. Close the new TEST shift online with the independently checked simulated cash. Record its expected/counted values and preserve the evidence.

This sheet does not check the physical scale, printer, real opening stock/costs, separate employees, production backup or owner pilot sign-off. Those remain separate launch gates in the [pilot checklist](pilot-checklist.md).
