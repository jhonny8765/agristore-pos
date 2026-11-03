# November 3 store test-history cleanup

The user explicitly identified the existing receipts, refunds, transfers and other operational history as test data and requested a clean start while keeping the legitimate stock. This is a one-time preparation step, not a general permission to erase real business history.

## Preservation and backup

A consistent read-only export of all 40 existing public/private business tables was saved outside the repository at `outputs/store-test-clean-20261103/before-cleanup.json`. Its SHA-256 is `296ff9b59a78cf7a52628c93c0c876c488b8027584491f05c9c4ad21ee009da8`. It includes complete original payloads and the previous command definition. Private execution plans, before/after evidence and original test receipts remain backed up. No backup or customer record is committed to source control.

The atomic maintenance transaction also archives the complete snapshot in private database storage. Direct access by anonymous/authenticated application roles is denied. The 610 complete original sales have indexed private tombstones, with SHA-256 hashes of the application's stable immutable payload fingerprints. The original 200 endurance fingerprints were independently compared before preparing the cleanup.

Ten preserved tables compare exactly before and after: organization, branches, accounts/memberships, registered PCs, products, selling units, price versions, batches, suppliers and branch inventory. All 984 active catalog products and all existing prices remain unchanged. The three earlier archived TEST products also remain archived; catalog history is not deleted.

## Cleared operational history

Thirty linked operational tables were archived and cleared in foreign-key order, including sales/items, payments/refunds/corrections, old shifts/authorizations, purchasing/count/stock-control test evidence and prior test audit events. The single open test shift was archived, without fabricating a physical cash count or a normal counted-cash closure.

The stock journal was rebased to nine explicit opening balances, preserving each existing branch/product/lot quantity exactly. No refund, reversal, purchase, stock import or automatic zeroing was used. Internal foreign-key triggers remained enabled throughout. Only the affected application triggers were paused inside the exclusive maintenance transaction; their exact original enabled states were restored and asserted before commit. Existing branch inventory rows were never changed. A new maintenance audit event records the reset.

Independent readback confirms zero active sales, payments, refunds and shifts, with all nine stock balances and all ten preserved-table fingerprints identical to the backup. The existing negative balances for Sungkit lubi and Bayna remain minus one each; cleanup does not certify them as physical stock counts.

## Browser and replay protection

The snapshot may supply a branch-scoped, authenticated archive manifest naming exact backed-up transaction IDs and their payload hashes. The browser removes a named local original only when its scope and full immutable payload match. Conflicts roll the entire snapshot back, retaining both the record and previous stock. Unknown pending records are never deleted. A removed test-shift lease is retired; unfinished held baskets remain available for explicit operator review.

The manifest is cached per business/branch. Once applied, subsequent snapshots omit the large manifest, while the local tombstones continue to protect recovery import. An exact original test recovery cannot resurrect the sale or deduct stock. Server-side exact replay by the original authorized cashier returns an acknowledgment with no live financial/stock effects; conflicting content or unauthorized replay is rejected. Old linked test operations are rejected. Normal new purchases continue through the original authorization/checkout commands.

The support SQL at `scripts/sql/test-history-archive-support.sql` installs storage and guards only. It contains no organization-specific cleanup or destructive reset action. The reviewed private maintenance plan refuses any changed baseline after backup, asserts preserved data/ledger/trigger equality, and was rehearsed with rollback before commitment.

## Verification

Five new unit cases cover exact-only removal, unknown-record retention, conflicting payload rollback, cross-branch rejection, recovery replay, cached tombstones and independent new purchases. Type checking, lint and the connected Cloudflare production build passed. The full unit run passed 484 cases and hit one five-second timing limit in the existing 200-sale simulated outage case; its complete 22-case offline file passed on an isolated rerun. Four browser regressions passed for receipt paging/cash/stock, held drafts, close-shift accessibility and workspace filters.

The rolled-back and applied database transactions verified exact old-file acknowledgment without new effects, conflicting replay rejection, anonymous rejection, authenticated snapshot manifest/confirmation behavior, version acknowledgment, private archive access denial, exact preservation of ten tables, identical stock ledger/projection and restored trigger states. This is software/store preparation evidence. It is not a physical stock count, cash drawer reconciliation, hardware test or production backup/restore certification.

## Published readback

Source implementation `732c692` is published as `cf-mvzyewi7`, archive SHA-256 `9e57ffb345518f4f04a66d28c89c5c9f6ddadcc5a469ae8042224fe4361b6d13`. The exact same 189-file archive passed two preview and two production Practice browser checks; both health endpoints reported this release with status `ok`. The existing owner session used its normal guarded app update with an empty basket and zero waiting uploads. No site data was cleared, no account was replaced and no additional business purchase was created.

The actual owner browser then showed **zero saved local transactions**, **zero confirmed receipts**, **₱0 sales/refunds**, **no open shift**, and **984 catalog products** with the preserved prices and quantities. Screenshots are saved privately as `store-test-clean-live-{sync,receipts,inventory,overview}.png`. The session was left at Checkout with an empty basket and the opening-cash form for the user's store rehearsal. The prior endurance report remains historical evidence of its completed run; this later, explicitly authorized test-data archive does not rewrite those original timed verdicts.
