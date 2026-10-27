# Active endurance run — October 28, 2026

**In progress; not passed.** Two hundred NEW TEST purchases are pending in the installed Brave Work profile, Test Branch 4. They are separate from the earlier 200 successfully synchronized purchases. Keep the same app, browser profile and site data. Do not enter these purchases again.

## Verified before the physical handoff

- New TEST shift: `a9427fb4-d8c4-44ad-8a55-c601c8d69b72`, opened online with ₱0 cash.
- Storage protection granted; starting test stock **195 kg**, price **₱35/kg**.
- Fifty quarter-kilo, fifty half-kilo, fifty 100 g and fifty ₱10-request/confirmed-250 g purchases saved through the normal UI while this tab's network was disabled.
- All **200 new distinct transactions** are pending, totaling **₱1,925** and **55 kg**; local stock **140 kg**.
- A server read still found only the earlier **200 synced sales / ₱1,925 payments / 195 kg**, plus the new open test shift. The new purchases have not uploaded.
- The new recovery file exists on E:\, contains the complete 200 original IDs and records, and its checksum matches the application's canonical JavaScript checksum. None of the new IDs overlap the earlier run.
- Baseline file: `E:\agristore-recovery-94cf93fe-228b-4b2d-ba8d-e1a407a261cc-part-1-of-1.json`. A private ignored copy and the active machine-readable run record are in `.impeccable/review/`.

The browser-only simulated outage began **05:28:25**. All 200 purchases were saved by **05:34:16**. Therefore the earliest eight-hour storage observation is **13:34:16**, October 28, Asia/Manila. This alone does not establish an eight-hour physical outage. The physical disconnect and Windows restart have **not yet been observed**.

## Your short offline checklist

1. **Save all other work.** Aim to start at **05:45 today**. Physically disconnect this PC: turn off Wi-Fi and unplug any wired network connection. Write down the actual disconnect time. If later than 05:45, shift the checkpoints later.
2. Perform one **normal Windows restart** while the network remains disconnected. Reopen the installed Better Yield app in the same Brave profile. Check Test Branch 4, **200 waiting for confirmation**, and **140 kg**. Do not sign out, switch profiles, uninstall or clear site data.
3. Export a fresh recovery file after reopening and confirm it is saved on E:\. Keep the baseline and every checkpoint file.
4. At **one real hour after physical disconnection** — 06:45 if starting at 05:45 — check the same counts/stock, export another recovery file and record the time. This completes only the one-hour observation, not the eight-hour test.
5. At **eight real hours after physical disconnection** — 13:45 if starting at 05:45, and never earlier than 13:34:16 — check again and export one more recovery file **before reconnecting**. Keep the PC powered for the test and keep the app/profile intact. Do not change the clock.
6. Reconnect only after that final evidence is saved. Reopen ChatGPT and say **“I’m back; the endurance test is finished”**, giving actual disconnect/restart/checkpoint times and any error. The follow-up can then verify the files and server results. A missing sale, early upload or incomplete checkpoint remains a failed/incomplete test, not a reason to recreate a purchase.

If the offline app cannot open or a completed sale is missing, preserve the PC/profile and all files, record the error and reconnect to report the failure. Do not repeat a purchase or delete the evidence to restart the test.

Offline authorization expires at **17:28:04 today**. Do not create new offline sales after expiry. Completed records must remain recoverable even if you reconnect later; renew the original identity's sign-in if requested.

## After reconnecting

Do not close the new shift until the original new sales are acknowledged and independently checked. Expected new-run figures are **200 sales / ₱1,925 / 55 kg**; expected final stock is **140 kg**, with exactly one payment and stock movement per new ID. Combined branch history will contain **400 sales / ₱3,850** across the two separate test shifts. The **new drawer alone** closes at **₱1,925**, not the combined amount.

The scheduled follow-up is **13:45 today** in this chat, with no automatic pass based on elapsed time. Local scheduled work needs the PC on and the app running; keep/reopen ChatGPT after reconnecting and send the results rather than assuming an offline scheduled run inspected the PC. [Official OpenAI documentation](https://learn.chatgpt.com/docs/automations?surface=app).

## Evidence and limits

Read `.impeccable/review/endurance-active.json` before continuing this run. Actual physical disconnect/restart/checkpoint fields remain blank until evidence is received. Compare full original IDs, payloads, fingerprints and pending states in the recovery exports; verify the same Windows PC's new boot time against `endurance-windows-boot-before.txt`. Preserve checksum verification using the shared JavaScript `stableJSON` ordering, which uses `localeCompare`; Python's default key sorting is not an equivalent canonicalization. The initial Python checksum assertion was a verifier mismatch, not evidence of a damaged export; the shared implementation verified the file successfully.

Real equipment, independent staff, real opening stock/costs, production backup restoration and signed one-branch pilot acceptance remain separate requirements. No production release or new software deployment was made for this test.
