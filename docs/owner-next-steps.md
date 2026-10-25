# Better Yield: what you need to do next

Use this with the [pilot sign-off](pilot-checklist.md). The app is still in staging. Automated results are recorded in [stock-control verification](stock-control-verification.md); real PC and store checks remain open.

The [blind-count and separate-person approval workflow](blind-counts.md) is now deployed to staging after the complete real Supabase test run passed on the clean public source edition's free runners. Use two independent stock-staff/manager counters and a third person, the owner, to approve. If only one owner exists, that owner should review rather than enter either count. Employees create/confirm their own accounts; assign their branch and role under Settings → Staff access. Do not share the owner password. No paid settings were changed.

The October 26 staging update passed the complete automated test suite. On an already open app, finish the basket, synchronize pending records and use **Settings → Application & recovery** to download/apply the available update. Follow its reopen message and keep the same browser profile and site data. Do not create another business or reset storage to get the new version.

## 1. Choose the cashier PC

Choose one Windows PC for the first branch. Record its Windows and Edge versions, available disk space, printer model and weighing-scale model. Use a normal, dedicated Edge profile, not InPrivate. Keep the same profile and staging address throughout the test:

https://agristore-pos-staging-team-payaman2.vercel.app/

Sign in with the existing test account; do not create a duplicate business. Use **Test Branch 4** for this rehearsal. Have the owner register this PC online, download the catalog and install the app through Edge's app-install control. Keep the account password private. Before real use, staff must have their own accounts with the correct branch and role.

Open **Settings → Application & recovery → Check storage protection**. Save the exact result. “Persistent storage granted” is required for the browser pilot, alongside successful outage/restart tests. If protection is not granted, or completed sales disappear, stop the pilot and report the result. Do not clear the site's data or uninstall the app as a fix. The Windows SQLite fallback is still the planned alternative if the browser-storage gate fails.

Use one dedicated cashier window. Signing out in another window signs this window out too and clears its unfinished basket. Completed saved sales remain on the PC for recovery; sign back in to the correct store before synchronizing. Do not use an unsaved basket as a receipt or repeat a completed purchase after signing in.

## 2. Run a test day on that PC

Use labelled TEST products and simulated cash. These are software checks, not customer sales or evidence of actual stock movements. Keep the starting stock, price and cash figure on a separate sheet before disconnecting. Start online with an empty basket, a downloaded catalog and a newly opened shift with ₱0 opening cash. Note the authorization expiry; complete offline selling within its 12-hour period.

For the current TEST Grower Feeds price of **₱35/kg**, the following provides 200 purchases and checks the loose-selling paths. Check the displayed retail price first. If it has changed, recalculate the expectations before testing.

| Purchases | Entry to test | Actual recorded weight per sale | Due per sale | Group weight / sales |
|---:|---|---:|---:|---:|
| 50 | By weight, type `1/4` kg | 0.25 kg | ₱8.75 | 12.5 kg / ₱437.50 |
| 50 | By weight, type `0.5` kg | 0.5 kg | ₱17.50 | 25 kg / ₱875.00 |
| 50 | By weight, use grams | 100 g | ₱3.50 | 5 kg / ₱175.00 |
| 50 | By peso amount, request ₱10, then confirm a test scale reading of 250 g | 0.25 kg | ₱8.75 | 12.5 kg / ₱437.50 |

The peso amount is a request, not the final weighed charge. The last group deliberately confirms a different actual weight from the estimate. Check the real scale with representative quarter/half-kilo quantities and a tared container; the repeated transactions remain synthetic. Include at least two consecutive identical purchases and confirm their sale IDs differ.

Disconnect the network physically or turn off Wi-Fi. Each completed purchase must show **Sale saved** and appear in **Sync center**. If a save fails, keep the basket and retry that attempt; do not hand over goods based on a failed save. With ₱20 tendered for each example above, expected change is ₱11.25, ₱2.50, ₱16.50 and ₱11.25 respectively.

Record the actual disconnect time. Stay disconnected for at least **60 real minutes**. Close/reopen the installed app, then perform a normal Windows restart while still disconnected. Reopen the same app/profile and compare every saved sale ID and total. Do not change the clock. Continue the test for **eight actual hours** and recheck records. Keep all completed records; note any extra sales separately.

With exactly the 200 examples and no other movements, expected totals are **55 kg sold and ₱1,925 sales**. A 250 kg starting test balance becomes **195 kg**, before and after synchronization. These expectations do not apply if the starting balance, price or transactions differ.

Reconnect and sign in again if requested. Leave the app open until every sale is acknowledged and the queue is clear. Compare IDs, totals and stock before closing the shift online with the simulated net cash. Keep an export of the evidence. A recovery export contains unresolved records; download **every numbered part** while records are pending and copy them to a separate protected device when available. If downloads are blocked offline, preserve the PC/profile and retry once connected. Do not re-enter pending purchases as new sales.

If checkout reports an expired lot, that attempt has not been saved. Remove the expired item from the basket, physically separate the goods and ask the owner to record the appropriate hold/disposition. This includes a basket left open across midnight in Philippine time. If the app reports that a newer stock download or store change replaced a request, refresh the current branch; do not create another sale to repair the download.

Report the PC details, storage-protection result, start/end/restart times, sale count, sales/cash/stock totals and any error text. Screenshots may omit names and account details. Do not send a password. A missing completed sale, duplicate server deduction or false save-success fails the test: preserve the profile and recovery files, and stop real use.

## 3. Confirm real stock and staff procedures

Pick the first pilot branch. Two people should count sealed sacks, loose kilograms, packets and lots/expiry separately. Separate held/damaged goods and stock in transit. Keep the signed count sheets and purchase costs. Import the verified opening stock once in the eventual production business; do not reuse the staging TEST balances.

For the reported ₱170,000 difference, gather the affected branch, count date, itemized expected/count differences, purchase costs, prior count, deliveries, transfers, returns and sales for the period. Mark unknown values as unknown. Do not use an unexplained adjustment to erase the investigation or infer theft from a shortage alone.

Rehearse receiving, a partial transfer, a damaged-stock hold, owner approval and a full refund with actual returned quantities. Verify that each employee can access their branch and cannot perform prohibited owner actions. Use the [daily stock-control routine](stock-control-operations.md), including cash reconciliation and independent recounts.

## 4. Arrange hosting, backup and maintenance before launch

Name the person who reviews daily differences, the technical maintainer and the backup owner. Decide the maximum acceptable lost-data window and how quickly the store must recover. Have the maintainer configure the production environment, suitable commercial hosting/database capacity, password protection and encrypted off-site backups. Restore an actual cloud backup into a separate functioning test environment and compare transactions, cash, stock, holds and outstanding transfers. The disposable automated dump/restore test does not complete this step.

Review storage headroom, failed uploads and pending investigations regularly. The five-branch annual sample measured about **1.59 GiB of added application data and indexes** at 547,500 historical sales plus follow-up tests, using two lines per historical sale. Database data/index size is only part of hosted disk use; transaction logs and backups also need capacity. See [Supabase's size definitions](https://supabase.com/docs/guides/platform/database-size). Do not delete sales/audit history to make room. This measured synthetic result is a sizing input, not a quote or proof that the current account's plan is sufficient. Actual catalog/lot size and item counts can change it.

Pilot one branch with daily signed cash/stock reconciliation, then expand only after the owner accepts the recorded results. Official tax-invoice issuance, partial cash refunds, purchase-order matching, fully rejected supplier deliveries, automatic investigation escalation and broader reports remain outside the completed workflows. Blind counts and separate-person approval passed their software gate and are in staging; rehearse them with the actual separately signed-in staff before real use. Use documented manual controls for unreleased or unimplemented workflows.

Browser persistence protects against some automatic eviction, not deliberate clearing or drive failure. Microsoft documents IndexedDB and service-worker caching as separate PWA storage mechanisms; installation alone is not a backup. [Microsoft Edge storage guidance](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/offline).
