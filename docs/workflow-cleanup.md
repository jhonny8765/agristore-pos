# Better Yield workflow cleanup

This implements the approved Plan B within the existing Better Yield design.

## Store navigation

The Magpet installation has six main areas: Checkout, Overview, Inventory, Purchasing, Sales & receipts, and Customers & credit. Stock counts are an Inventory tab with the existing separate-counter/owner rules. Generic installations retain their existing transfer access; this change does not enable transfers in Magpet.

Purchasing groups Orders & deliveries, Supplier bills, and Suppliers. Receiving steps and history sit inside the orders/deliveries group. Inventory contains Products, Stock counts, Stock activity, and owner-only Needs review. Product creation and price history remain reachable from Products.

## Review imported products

Inventory → Needs review filters Unit needed, Price missing, Cost unconfirmed, and Stock not posted. Each filter counts matching products; All reviews counts distinct products across the flags. Find any product also supports ordinary price/cost updates.

Source stock is structured product metadata scoped to its original branch. It contains the file, page, source date, quantity, checksum, and posting state. Metadata alone never changes usable stock. An unresolved starting balance is distinguished from confirmed zero stock, and actual newly received usable stock remains visible independently.

1. Confirm a missing selling unit, stock measurement and exact conversion. Enter a positive selling price. Actual cost is optional; blank means unconfirmed and retains the previous numeric cost and pending flag.
2. Review starting stock separately. Enter the quantity intended as the current balance, inspect current stock, proposed final balance and difference, then confirm it with a reason. The source quantity is not automatically posted.
3. Price/cost updates append a new price version without changing the unit, original prices or old transactions. Products with stock history use this path rather than the setup form.

The setup RPC refuses unit changes after recorded stock, sales, purchase orders, holds or blind-count activity. Stock posting requires a confirmed unit, matching source evidence, current stock/revision and unit price version, no open branch shift or unresolved relevant holds/transfers, and supported exact quantities. Batched/expiry stock uses the established stock-count workflow instead. A posting records the difference as an adjustment and retains its original evidence.

Review mutations use durable online operations and request IDs. Replaying an identical request returns its original success; different values cannot reuse the reference. These requests can only be restored by the owner. Existing cash checkout, credit, supplier-account and repaired archive dispatchers remain in place; no dispatcher was renamed.

## Account and checkout presentation

Customer and supplier balances have explicit opposite directions: Customers owe the store and The store owes suppliers. Payment state and timing remain separate, including part-paid overdue invoices. Supplier totals cover recorded bills and explicitly exclude historical bills awaiting balance reconciliation.

Payment entry opens on request. Selected records on narrow screens have a Back action rather than squeezing the register and details into adjacent columns. Credit terms remain one final 30/60/90-day due date, and unconfirmed historical dates remain unconfirmed.

Owner Overview shows the two account totals separately, with checked times, overdue figures, customer debt with unconfirmed dates, and supplier bills due soon. A failed refresh retains the previously checked figures. Unknown/malformed totals are not replaced by zero. These summaries do not broaden supplier-account access to other roles.

Cash sale confirmation shows Print 58 mm receipt, New sale, and saved receipts. Payment-entry controls are hidden after success. A held draft needing recovery remains accessible even after a confirmed sale; it cannot charge the completed request again. Original receipt printing and the separate authorized manual VAT invoice arrangement remain unchanged.

## Validation and rollout

Database regression cases cover role boundaries, branch scope, exact mL conversion, unknown costs, original price versions, stale price/stock rejection, independently reviewed balance differences and duplicate requests. Browser cases exercise the real review components against disposable PostgreSQL fixtures and inspect desktop/phone accessibility. A signed-in integration case checks the same flow, racing price requests, role denial, and absence of unintended sales/cash effects.

The encrypted restore drill retains structured evidence and original unit/stock review requests, proves that replay does not add stock again, and records a new price after restoration. Source evidence for the existing November 3 import is attached separately through a guarded maintenance transaction. That transaction must preserve existing stock and financial records, append its own audit, and verify the original dispatcher and table fingerprints before changing anything.

Supplier bill balances remain pending the owner's remaining-balance/payment records. Product quantities and prices awaiting confirmation remain subject to the existing checkout restrictions.

## November 3 release evidence

- Live release: `cf-mw0h3pr8`, connected to the existing Magpet backend. Package SHA256: `1ea3e3479b185f6ce1db830c98d7fa50fe385d3bd7e6828cb4901538cfa908fb`.
- [Application gate](https://github.com/jhonny8765/agristore-pos/actions/runs/41609535465): type checking, lint, 549 unit checks, 61 browser cases, desktop/phone accessibility and 58 mm receipt checks passed. Production dependencies had no reported vulnerabilities; the existing development-dependency audit remained within the repository's configured gate.
- [Database gate](https://github.com/jhonny8765/agristore-pos/actions/runs/41610036413): 1,392 PostgreSQL assertions, an encrypted 49-table restore, and four signed-in workflow cases in each of the generic and fixed-Magpet configurations passed. The signed-in cases cover credit, cash/offline checkout, supplier payments and product review, including owner balance navigation. This is focused integration coverage, not the entire legacy integration suite.
- Migration `20261103070000` and structured evidence for 252 previously imported stock rows were applied together. Forty-five source balances remain pending actual unit/stock review; no new balance was posted by the rollout.
- A verified encrypted pre-release backup and previous connected package were retained privately. The live readback compared all 49 tables: the 10,115 existing rows were preserved except the intended product source metadata and catalog revision; one source-evidence audit was appended. All stock quantities, 2,019 stock movements, original prices, sales, payments, customer/supplier debt records, staff and prior function definitions outside the reviewed dispatcher remained unchanged.
- Cloudflare displayed deployment success and the public health endpoint returned the expected release with status `ok`. No production checkout or payment was created for testing, and the cashier's existing browser tab was not reloaded by the agent. Physical printer/endurance acceptance remains separate from these automated checks.

To load the release on the store PC, finish the current work and use Settings → Check for app update. Follow the app's existing synchronization and update controls; keep the current browser profile and saved records.
