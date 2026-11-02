# Short lists and product search

Receipts, saved transaction queues, inventory and other saved registers now show at most **10 records per page**. Use **Previous**, **Next**, **First** or **Last loaded** above or below the list. The page number and loaded count show where you are. When the server has older records, the existing **Load older…** action fetches more pages without growing the visible list beyond ten. CSV exports still include all loaded records, as labelled.

The same paging applies to blind-count records, purchasing and delivery registers, stock issues, held goods, expiry reminders, investigations, loss reports, analytics, staff/device/branch tables, pending requests, supplier-claim notes and refund history. Basket lines and editable order/inspection lines remain together so a page change cannot hide an unfinished quantity.

In **Stock counts → Start a blind count**, type part of a product name, SKU, original supplier code or lot in **Product / batch**, then choose the matching result. Suggestions show at most ten matches; type more letters to narrow a large catalog. Arrow keys and Enter choose a result, and Escape dismisses suggestions. No expected stock or previous count is included in this picker.

The same search works for product/unit choices in receiving, price changes, transfers, stock issues, purchase orders and delivery inspections, and for supplier/order choices in purchasing. A typed phrase alone is not a product selection. An optional supplier may be blank, but a typed supplier name must be chosen from the results before saving. Editing a previously selected choice clears its saved ID until another result is chosen, and dependent quantity fields reset when the product or unit changes. New count, issue, transfer and receiving forms require an explicit product choice.

Paging changes presentation only. Full saved records, unresolved-sale counts, pending-request checks, cash totals, stock calculations and original transaction IDs retain their existing sources. It does not delete, refund, import, synchronize or duplicate a sale.

Verification: large-catalog browser fixtures cover 120 products, original-code and lot search, keyboard selection, invalid free text, reset, hidden blind-count balances and exact submitted product/batch IDs. List fixtures cover first/last/next pages, newly loaded rows, shrinking refresh results and intact aggregate amounts. Axe found no violations at 1440px and 390px, with no horizontal page overflow. All 473 unit tests passed. Existing browser checkout checks include 200 retained sales across 20 pages, weighed quantities, cash/change and closing. The published preview passed 26 Practice regression cases. Genuine authenticated Supabase integration selectors were updated; Docker is unavailable on this PC, so those integration cases require their existing disposable-database environment.

The original Magpet endurance verdict remains in `magpet-endurance-20261102-results.md`. These UI checks create no live business purchases or stock movements.


## Website release

Published November 3, 2026 to https://better-yield-magpet-pos.pages.dev as **cf-mvzrdm7g**. The final preview and production health responses both report that release and `status: ok`. The final receipt-page case passed on both origins: 11 original unique Practice sales, 1,738,000 centavos due, 2,200,000 tender, 462,000 change and 1,550 kg remaining feeds after eleven 50 kg sales from 2,100 kg. Paging through receipts and Sync center left the complete saved records and stock unchanged. The 200-checkout regression separately verified ten visible queue rows across 20 pages while all 200 originals remained saved.

The final archive used for both preview and production has SHA-256 `4fa7ac6a5b1051a869a8c307348f98b000a3e0ea2a3cfa847d60a68b8388af30`. The initial preview passed all 26 existing Practice regression cases; the final candidate also includes the checked optional-supplier validation and stable picker labels, covered by the four large-catalog UI fixtures. Type checks, lint, configured Cloudflare build, isolated staged-source type checks, and the design detector passed. The detector returned no findings. Desktop/mobile receipt screenshots and detailed validation are retained under `.impeccable/review/`.

Feature source is committed separately as `0f6fe75`. Existing catalog/photo work already live remains in the deployment and was preserved outside that feature commit. No catalog migration, live business sale, refund or stock adjustment was submitted. Previous production release **cf-mvzq5c2m** remains available for rollback.

For an already-open installed POS, finish the basket and confirm pending records, then use **Settings → Check for app update** and reopen when prompted. Do not clear site data.
