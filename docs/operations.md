# Store operations and recovery

## Before each shift

Sign in online on the registered branch PC, open the shift with the counted cash float, and verify the catalog has downloaded. Install the production PWA from Edge’s app menu. Keep the dedicated Windows/browser profile; do not use private browsing or automatic site-data cleanup. Export a recovery file at shift boundaries and before PC maintenance.

Offline checkout is available only to the already authorized cashier and shift, for 12 hours from authorization. New logins, cashier changes, receiving, adjustments, transfers, refunds, and shift closure require connectivity. Stock on an offline device is an estimate based on its last confirmed snapshot and local pending sales.

## End of shift

Reconnect and confirm every local sale has synchronized. Investigate review-required records in Sync center. Count drawer cash, reconcile the shift under Settings, and close it. Count physical stock only after the branch’s shifts are closed and all local transactions have synchronized. Owner approval records a separate adjustment; it never edits the original journal.

## Interrupted upload

Retry the original record in Sync center. Do not re-enter the customer’s purchase. Transaction IDs and payloads are retained. Deliveries and transfers with an unknown network result also retain their original request IDs under Online operations awaiting confirmation. A definitive database rejection rolls back the operation so corrected input may be submitted.

## Failed PC or lost browser profile

1. Keep the original profile and disk if recoverable. Clearing site data can destroy unsynchronized records; cloud backups cannot contain sales that never reached the cloud.
2. Export the local recovery file when possible. It contains business records and must be kept private.
3. The owner retires the failed PC under Registered cashier PCs. This closes its open shift without inventing a counted cash value and preserves device history.
4. Register the replacement PC at the same branch. The owner opens their own shift, downloads the catalog, and imports the recovery file.
5. Original cashier transactions remain distinct. The owner verifies original receipts and uses **Approve recovery**, entering a reason. Recovery preserves the original transaction, cashier, authorization window, and historical shift; an additional audit event records the approving owner. A closed shift’s expected cash is recomputed; counted cash is preserved.
6. Ambiguous receiving/transfer requests retain their original employee identity. The employee signs in to retry their original request. If access was revoked, the owner must compare the recovery file with the receiving/transfer register before deciding how to reconcile it; never create a second delivery merely because a response was lost.

Recovery approval does not bypass product, price, batch, quantity, or original authorization-window validation. Malformed records stay visible for investigation.

## Backups and release gates

Before production, configure daily encrypted off-site database backups with an independently retained encryption key and a documented retention policy. Include Auth identities and sessions, application schemas, data, grants, and relevant Supabase settings; do not treat a CSV stock export as a full database backup. Enable managed backups on the selected production service and verify the actual restoration process into an isolated project.

CI contains a disposable Postgres dump/restore drill which checks restored Auth identities, RLS, the movement journal, stock projection, and the transaction API. It does not prove that a production off-site backup is scheduled, downloadable, or restorable. Those production credentials, storage destination, and retention choices must be configured before launch.

Run the physical Windows restart test and a real timed outage on each intended store PC. Verify browser persistence and restore an exported recovery file. If browser storage fails the durability gate, do not pilot this PWA: implement the Windows SQLite deployment using the same domain rules and transaction contracts.

Pilot one branch, reconcile daily, and only expand after the owner approves the results. Configure a separate production Supabase project and commercial Vercel hosting; remove the Git production-build gate only after release approval. Official tax invoices remain outside this pilot.

Use [the pilot sign-off checklist](pilot-checklist.md) to record actual hardware, outage and recovery evidence.
