# Installed Brave cashier rehearsal

October 28, 2026. Staging only, Test Branch 4, TEST Grower Feeds and simulated cash. This is an interactive test on the accessible Windows PC; it does not certify the eventual store hardware or production business. The application remains the verified [closed-shift recovery release](candidate-pc-verification.md#final-release-and-repeated-interactive-check), with no new software/schema change for this rehearsal.

## Installation and storage

The user reported completing installation in Brave. In the same Brave Work profile, Settings → Check storage protection changed from **not granted** to **Persistent storage granted** after installation. Refresh PC checks also reported protection granted. The Windows/browser profile and site data were preserved; no permission was forced through development tools and no security setting or extension access was changed. Application-window/process restart is still a separate check; the automated interactive check here reloaded the POS tab.

The earlier missing-install-option and denied-persistence findings in the [candidate audit](candidate-pc-verification.md) are historical. Persistence passing is a prerequisite, not a backup or a completed hardware/endurance gate.

## Starting point and exact expected results

An independent server read before testing found Test Branch 4 with **250 kg** of TEST Grower Feeds, no sales/payments and no open shift. The other branches retained four historical sales. The test profile registered a separate Test Branch 4 device and opened an owner test shift at **₱0**. Magpet's registered device was not moved or retired. Real cashier/staff separation remains untested on this PC.

The visible loose-selling price was **₱35/kg**. The following 200 separate checkouts were completed through the normal cashier controls while this tab's network was disabled:

| Count | Entry | Recorded quantity per sale | Charge per sale | Group quantity / amount |
|---:|---|---:|---:|---:|
| 50 | Type `1/4` kg | 0.25 kg | ₱8.75 | 12.5 kg / ₱437.50 |
| 50 | Type `0.5` kg | 0.5 kg | ₱17.50 | 25 kg / ₱875.00 |
| 50 | Switch to grams; enter 100 g | 0.1 kg | ₱3.50 | 5 kg / ₱175.00 |
| 50 | Request ₱10, estimate weight, then confirm a TEST reading of 250 g | 0.25 kg | ₱8.75 | 12.5 kg / ₱437.50 |

The last group deliberately changes the 285 g estimate to a different actual-entry weight. The final charge follows the confirmed 250 g, not the requested ₱10 or the ₱9.98 estimate. This tests entry behavior; it is not a physical scale reading or calibration.

Every example used simulated ₱20 tendered. Expected totals: **200 distinct sales, 55 kg sold, ₱1,925 sales/drawer cash, ₱4,000 tendered and ₱2,075 change**, leaving **195 kg**. Consecutive identical purchases retained different receipt references.

## Observed outage, persistence and exports

Network simulation began at **04:57:04.263 Asia/Manila** and ended at **05:06:53.445**, October 28: **9 minutes 49.182 seconds**. Only the selected tab was disconnected through the documented browser developer controls. The PC's Windows network, other tabs and clock were not changed. This is not the required physical sixty-minute outage, eight-hour stress run or Windows restart.

All 200 checkouts displayed Sale saved and the offline queue contained 200 pending records. Local stock reached exactly **195 kg**. An independent server read during the interruption still showed **zero sales, zero cash and 250 kg** in the test branch, confirming these were locally saved purchases rather than online requests represented as offline.

The app exported one recovery part containing all 200 records. The browser download observer timed out, so that result was initially treated as unverified. The user confirmed the download and supplied `E:\` as its location. The actual file was then found and read there. A second export after an offline reload was also found on E:\. Both files have **200 complete distinct transaction UUIDs, identical saved records/payloads and pending states, exactly 55 kg and 192,500 centavos in sales**. All visible receipt references also survived reopening.

Private recovery files retained on E:\:

- `agristore-recovery-eba5e92d-8bd9-4ac1-90d9-246c12889af6-part-1-of-1.json` — before reload.
- `agristore-recovery-875a5f93-c4b1-4e74-80f0-8dd9e53b80e9-part-1-of-1.json` — after reload.

Local evidence copies remain ignored under `.impeccable/review/`. A file on another volume is not proof of off-site backup or a physically independent drive. No recovery file is published to GitHub.

## Synchronization

The app resumed its bounded automatic upload batches when the tab reconnected. Local availability stayed **195 kg** while confirmations arrived, avoiding a second deduction. After the queue cleared, loading older saved records showed all **200 synced receipts**, beyond the newest-fifty default.

Server readback compared the complete original recovery file against hosted records: **all 200 original UUIDs and payloads matched exactly, with 200 sales, 200 cash payments totaling 192,500 centavos and exactly one sale movement per original ID**. Every movement matched the negative exact quantity of its sale. The stock projection and complete movement sum both equaled **195 kg**; no review flags appeared. Other-branch sale count remained four.

The first automated file selection was blocked because the browser extension lacks local-file access. No broader permission was enabled. The user selected the original E:\ recovery file manually; the app then displayed **“200 sale records checked and restored”** and the queue stayed clear. A new independent server read still found the same 200 original payloads, 200 payments and 200 sale movements, exactly ₱1,925 and 195 kg. Replaying the saved pending file did not reopen sales, duplicate cash or deduct stock again.

The test shift closed online at **05:11:53 Asia/Manila** with **expected cash = simulated counted cash = ₱1,925**. Server readback confirmed the closed timestamp, zero opening cash and 192,500 centavos for both expected and counted cash. No real drawer was physically counted. There are **zero open shifts** and **zero ledger/projection differences** in the hosted readback.

A further offline reload after shift closure retained Test Branch 4 and all 200 confirmed receipts. The complete visible receipt list matched the 200 server receipt identifiers exactly. Normal connectivity was restored after the check. Evidence screenshots are retained privately under `.impeccable/review/`: `installed-200-offline.png`, `installed-200-restored.png` and `installed-storage-and-closed-cash.png`.

Compared with the earlier pre-test snapshot, only the nine expected business tables changed: device registration, shifts/authorizations, sales/items/payments, inventory movements/projection and audit history. The other **31 business-table content hashes and row counts stayed unchanged**. This rehearsal deliberately added 200 auditable TEST sales; the earlier release's no-business-write statement describes that earlier release only. Current test-branch inventory is **195 kg**, and net recorded simulated test cash added is **₱1,925**.

## Next real-duration session

Keep the installed app, the same Brave profile and both recovery files. For another 200 purchases using the same worksheet, independently record the fresh starting stock/price first. If it is still **195 kg** at **₱35/kg** and no other movements occur, another identical 55 kg/₱1,925 test leaves **140 kg**. Do not reuse the historical 250 kg starting figure or erase the first 200 transactions.

Open a new TEST shift online and note its twelve-hour authorization deadline. The actual-duration test needs sixty real disconnected minutes, eight actual hours, reopening the installed application/browser process and a normal Windows restart while disconnected. Save other work before any shared-PC restart. A tab network simulation does not prove Windows restart survival. Reconnect within the authorization period or renew authentication as required, compare every original sale ID and stock/cash result, then close the simulated drawer online. Keep customer sales out of this test.

## Remaining acceptance

- A real sixty-minute outage, eight actual hours, installed-app/browser-process reopening and a normal Windows restart on the selected cashier PC.
- Physical scale/tare, meter/liquid measures and printed output.
- Separate real cashier/counters/approving owner, signed physical opening inventory and actual purchase-cost evidence.
- Actual production setup/off-site backup restore and a signed one-branch pilot.

Passing persistence and this 200-sale rehearsal does not remove these gates. Test transactions remain auditable staging history; they are not erased or represented as real business sales.
