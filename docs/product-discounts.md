# Product amount discounts

Owners and cashiers enter **Discount ₱** at the upper right of each product in **Current sale**. Enter the peso amount to remove from that entire product line, with up to two decimal places. Blank or zero removes the discount.

For example, two items priced at ₱360 give a ₱720 gross line. Entering **50** subtracts ₱50, leaving **₱670**. Increasing the quantity to three keeps the discount at ₱50 and changes the line to ₱1,030. The discount is not multiplied by quantity. Changing it replaces the earlier amount rather than compounding reductions.

The discount cannot exceed that line’s gross amount. A reduction in quantity that would make the existing discount too large is blocked until the cashier corrects the discount. Unfinished amounts, invalid quantities and unconfirmed scale weights block checkout.

Catalog prices, purchase costs and stock quantities stay intact. Cash checkout, receipts and credit checkout use the net amount. Partial refunds allocate the original net amount paid, retaining centavo remainders. Credit sales still need internet and a positive unpaid balance; the authorized manual booklet remains the official VAT invoice.

New receipts preserve the entered discount as integer centavos in `discountAmount`. Old percentage receipts and original unresolved requests retain their original `discountBps` evidence and arithmetic. An old held line shows its actual peso reduction in the new input; editing its quantity or discount changes the editable line to a fixed amount. Completed receipts and retry payloads are not rewritten.

The backend validates the amount, original price version, net amount and owner/cashier permission independently. Mixed amount/percentage fields, fractional centavos, negative amounts and discounts exceeding the line total are refused. Managers cannot create discounted sales.

## Current amount-discount release — November 3, 2026

Source `d0cb927` passed the complete [application/database gate](https://github.com/jhonny8765/agristore-pos/actions/runs/41621338660): **573 unit tests, all 63 practice browser cases, 1,430 PostgreSQL assertions**, strict database lint and encrypted restoration with all **49 table fingerprints**. Five signed-in cases passed normally and five with the fixed Magpet setup, including amount-discount cash checkout offline/sync, credit, collections, cashier permission and partial refunds. The focused signed-in selection does not claim every legacy integration case was rerun.

Additional local checks of the connected build passed hold/reload, fixed discount after quantity change, invalid input blocking, desktop/phone accessibility and real 58 mm PDF rendering. No production sale, payment, shift or stock movement was created for testing.

Migration `20261103090000_product_amount_discounts` replaces only the existing private discount helper in place. All **10,116 existing rows across 49 application tables** retained their fingerprints; device heartbeat timestamps are excluded. All **55 unrelated functions** remain unchanged. A fresh encrypted application snapshot and the previous website package are retained privately on this PC; this is not an off-site backup schedule.

Cloudflare confirmed production deployment **`cf-mw0k5e48`**, 189 files, package SHA-256 **`f42bff41e97f7c93fe0db45f54d3c6e6b18aa5e0600231e926e229fa57ee15b1`**. At **18:50:17 Manila time**, the health endpoint returned the matching release and the live home-page bytes matched the deployment package.

After finishing the current sale and synchronizing saved records, choose **Settings → Check for app update** on an already-open cashier PC. Keep the browser’s saved site data.

## Earlier percentage-release evidence

- 527 unit checks and all 54 practice browser cases passed in [application verification](https://github.com/jhonny8765/agristore-pos/actions/runs/41591637116), including held-draft reload, receipt display, invalid input, desktop/phone fit and accessibility.
- 1,303 assertions passed against real disposable PostgreSQL. An authenticated encrypted backup round trip and actual database restoration preserved the discounted receipt and remaining partial-refund basis.
- Five signed-in integration cases passed both normally and with the fixed Magpet setup in [database verification](https://github.com/jhonny8765/agristore-pos/actions/runs/41592592424). They cover discounted offline cash sync, credit, collections, partial refunds, owner/cashier access, duplicate retries, drawer totals, stock counts and receiving. The complete legacy integration suite was not rerun; these are scoped cases.
- The first regression run exposed a test timing race while a saved stock-count worklist loaded. Its helper now waits for that response before deciding whether to start a new count. The rerun passed; no stock-count application logic changed.
- Forward migration `20261103050000_product_line_discounts.sql` patches the existing cash and credit price checks with guarded single-occurrence replacements. It does not rename a dispatcher or rewrite historical rows. Hosted installation also checked both original function definitions before the change and exact expected definitions afterward.
- Live before/after snapshots retained 6,666 rows across 47 tables. Financial records, stock movements and the open shift matched. One existing device advanced only its `last_sync` heartbeat; every other device field matched. An encrypted, authenticated snapshot and previous working website package remain outside the repository.

The earlier connected website package was release `cf-mw0bng79`, SHA-256 `eec6838b95a97275b97b1e9d414eef79109c36ad6bfabc8c300e95bf1a5a1e74`. Live verification uses the deployment result and read-only health endpoint; no real transaction was created for testing.

To load the update on an already-open till, finish or hold the current sale, clear pending uploads in **Sync center**, then choose **Settings → Check for app update**. Keep the browser’s saved site data.
