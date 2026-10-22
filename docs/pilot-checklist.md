# One-branch pilot sign-off

Record the PC, Windows version, Edge version, tester, dates, results and retained evidence for each check. Use a staging business and clearly marked practice stock. Do not use customer transactions to test failures.

## Cashier PC durability

1. Have the owner or manager register the dedicated branch PC using a setup shift and close it. On the same browser profile, sign in as the cashier, install the Edge PWA, download its catalog and open the actual shift. Verify the displayed branch and authorization expiry.
2. Disconnect the network. Complete 200 cash purchases, including two identical purchases. Save their transaction IDs and cash totals. Confirm every completed sale appears in Sync center with its own permanent ID.
3. Keep the network disconnected for at least 60 actual minutes. Close and reopen Edge. Restart Windows during the outage and reopen the installed app in the same Windows/browser profile. Verify every completed sale, ID and total is still present.
4. Continue the storage test for eight actual hours. Do not change the PC clock. Complete additional sales within the 12-hour authorization period and verify their persistence. Export a recovery file before maintenance.
5. Reconnect, renew authentication when requested, and synchronize. Verify the server has exactly one sale, payment and set of stock movements per transaction ID. Reconcile drawer cash and physical stock.
6. In the isolated test profile, deny or exhaust storage and confirm checkout reports failure without displaying success. Test an app update while the basket or pending queue is nonempty; confirm the update is deferred. Verify logout and login preserve pending records.
7. Restore the recovery export into a replacement test profile. Retire the old test device, register the replacement and use the documented owner recovery procedure. Compare IDs and audit events; do not re-enter purchases.

Any missing completed sale or false success fails the browser-storage gate. Stop the pilot and implement the Windows SQLite client before retrying.

## Business controls and launch

- Record a successful fresh migration, database tests, and isolated dump/restore run. Restore the actual encrypted off-site production backup into a functioning isolated environment before launch.
- Create a separate production Supabase project and configure commercial hosting, backup retention and access. Keep privileged credentials outside the client.
- Verify each employee's branch and role with separate accounts. Attempt prohibited cashier stock adjustments and cross-branch reads.
- Verify opening-stock imports against signed physical counts, including sacks/kilos, lots and expiry dates. Import each branch's opening stock once.
- Dispatch and receive a test transfer; reconcile source stock, stock in transit and destination stock. Verify an owner-approved physical-count adjustment preserves its original expected and counted figures.
- Pilot one branch and sign daily cash and stock reconciliation. Record synchronization delays and resolve every pending/review record. Expand only after the owner signs off on the results.

Official tax-invoice issuance remains outside this pilot. This checklist records work still requiring the intended hardware and verified business data; automated simulation does not check these boxes.
