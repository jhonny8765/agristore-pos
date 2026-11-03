# Product percentage discounts

Owners and cashiers can enter **Discount %** at the upper right of each product in **Current sale**. Enter a percentage from 0 to 100, with up to two decimal places. Blank or 0 removes the discount. Each line has its own percentage, including its full quantity; changing the percentage does not compound earlier discounts.

For example, two items priced at ₱360 each with 10% off produce a ₱720 subtotal, a ₱72 reduction and a ₱648 amount due. Catalog price, purchase cost and stock quantity stay intact. Cash checkout shows the original subtotal, combined product discounts and net amount due. Credit checkout uses that same net amount for the client’s balance and payment term. The authorized manual booklet remains the official VAT invoice.

The receipt retains the percentage and net line amount. Held drafts, offline cash sync and recovery retain that evidence. Partial refunds allocate the original net amount paid, including centavo remainders, rather than the catalog price. Credit sales still require an online connection and a positive unpaid balance.

Invalid percentages block cash and credit completion. Changing a discount does not bypass unfinished quantity entry or scale-weight confirmation. The server independently validates the percentage, role, catalog price and net amount. Managers cannot create discounted sales under the owner/cashier policy.

## Verification and release

- 527 unit checks and all 54 practice browser cases passed in [application verification](https://github.com/jhonny8765/agristore-pos/actions/runs/41591637116), including held-draft reload, receipt display, invalid input, desktop/phone fit and accessibility.
- 1,303 assertions passed against real disposable PostgreSQL. An authenticated encrypted backup round trip and actual database restoration preserved the discounted receipt and remaining partial-refund basis.
- Five signed-in integration cases passed both normally and with the fixed Magpet setup in [database verification](https://github.com/jhonny8765/agristore-pos/actions/runs/41592592424). They cover discounted offline cash sync, credit, collections, partial refunds, owner/cashier access, duplicate retries, drawer totals, stock counts and receiving. The complete legacy integration suite was not rerun; these are scoped cases.
- The first regression run exposed a test timing race while a saved stock-count worklist loaded. Its helper now waits for that response before deciding whether to start a new count. The rerun passed; no stock-count application logic changed.
- Forward migration `20261103050000_product_line_discounts.sql` patches the existing cash and credit price checks with guarded single-occurrence replacements. It does not rename a dispatcher or rewrite historical rows. Hosted installation also checked both original function definitions before the change and exact expected definitions afterward.
- Live before/after snapshots retained 6,666 rows across 47 tables. Financial records, stock movements and the open shift matched. One existing device advanced only its `last_sync` heartbeat; every other device field matched. An encrypted, authenticated snapshot and previous working website package remain outside the repository.

The connected website package is release `cf-mw0bng79`, SHA-256 `eec6838b95a97275b97b1e9d414eef79109c36ad6bfabc8c300e95bf1a5a1e74`. Live verification uses the deployment result and read-only health endpoint; no real transaction was created for testing.

To load the update on an already-open till, finish or hold the current sale, clear pending uploads in **Sync center**, then choose **Settings → Check for app update**. Keep the browser’s saved site data.
