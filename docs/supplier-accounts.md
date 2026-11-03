# Supplier invoices and payment history

Open **Purchasing → Supplier accounts** while signed in as the owner. This is Better Yield's own debt to suppliers, separate from customer credit.

1. Add the actual supplier invoice number, invoice date, amount and stock description. Select due now or one final due date after 30, 60 or 90 calendar days. Optionally link a recent receiving reference belonging to the same supplier and branch.
2. Select an invoice to see its original amount, net payments, supplier credit notes and remaining utang. The register shows unpaid, partly paid, paid, settled with credit, overdue and voided records. Due-today, due-soon and overdue notices use Asia/Manila dates.
3. Record payments already made outside the sales drawer. Enter the applied amount, actual date, bank transfer/owner cash/cleared cheque source, reference and note. Confirm the payment was actually made or cleared. A planned future payment is not marked paid.
4. Use the history to inspect each original invoice, payment, credit note and correction. Both the actual payment/document date and recording timestamp remain visible. Paid invoices stay searchable. Filters run across the full supplier history, before paging; account totals retain their stated supplier scope.

Adding an invoice does not receive stock again. Supplier payments do not initiate bank transfers or deduct cash from the sales drawer. Existing stock receipts are not automatically converted into debt: use the actual supplier invoices and recorded payments. Earlier unpaid bills can be entered using their original invoice dates and verified amounts.

Mistaken entries use a linked reversal. An invoice with net payments or credits cannot be voided until those entries are corrected. A voided invoice remains in history and can be replaced with a linked correct invoice. Original records cannot be overwritten or deleted.

## Verification

- The final local run passed 545 unit checks, including exact-centavo input, large balances, due-date calculations and owner-only recovery of interrupted supplier requests.
- [Application verification](https://github.com/jhonny8765/agristore-pos/actions/runs/41599860948) passed all 59 browser cases, including receipt printing, supplier status/history, interrupted-response retries, desktop/phone layout and accessibility. The final invoice-prefill precision change has an additional targeted test and was included in the final unit run and connected production build.
- [Database verification](https://github.com/jhonny8765/agristore-pos/actions/runs/41600358625) passed all 1,361 PostgreSQL assertions, the authenticated encrypted backup/restore drill across 49 retained tables, and four signed-in workflows in both normal and fixed Magpet setups. Supplier tests cover concurrent original retries and competing payments, authorization, remaining balances, linked receipts, and unchanged physical stock and sales drawers. This is a scoped signed-in integration set; the entire legacy integration suite was not run.
- The first restore run placed new post-restore test payments before its unchanged-retry comparison. That test order was corrected without removing the comparison or excluding supplier tables. The rerun passed.

Forward migration `20261103060000_supplier_accounts.sql` adds two empty, protected tables, restricted helpers and a guarded route in the existing dispatcher. It renames no dispatcher. Hosted installation verified its original and expected function definitions. Before/after snapshots matched all 6,676 retained rows in the original 47 tables; financial records, customer credit, sales, payments, stock movements and shift records stayed unchanged. Only the two empty supplier tables were added. No live supplier invoice or payment was created for testing.

The connected website package is release `cf-mw0epgk4`, SHA-256 `a5c3583aa16776bd6232514f31dd92164e3027dc04f6c558718a4880edb86612`. Its previous working package and authenticated encrypted database snapshot are retained outside the repository. The release also contains the dedicated 58 mm store receipt repair: Better Yield branding, original items and discounts, tender/change, and no printed checkout controls. The VAT-booklet note appears once. Physical printer output still requires checking on the store's actual printer.

On an already-open till, finish or hold any current sale, sync pending records and choose **Settings → Check for app update**. Reprint an existing sale from **Sales & receipts** after updating. For the thermal printer, choose its 58 mm roll, portrait, 100% scale and no browser headers/footers.
