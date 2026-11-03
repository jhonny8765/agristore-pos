# November 3 updated UI

The owner supplied `better-yield-updated-ui-20261103.zip` with four design images: Overview, Checkout, Customers, and a credit account. These images define the layout and visual hierarchy. Their sample clients, prices, balances, invoice references and report figures are illustrative and are never imported into business data. The original Better Yield logo and verified catalog assets remain in use.

The later explicit decisions override the old approval language in the images: no credit limits or separate client approval; 30/60/90 days chosen per invoice; overdue debt warns and permits a new sale. Peso discounts apply to the entire product line and remain visible next to each basket product. Catalog pagination shows six products with one set of controls. Historical invoice dates, opening balances, collections and sales retain their existing meanings.

Overview places all-time customer/supplier balances between the dated sales chart and top-product table. The chart caption identifies actual confirmed sales; cash/credit subtotals are not invented because the current analytics report does not supply that split. Historic supplier balances awaiting reconciliation stay excluded. Customer register and account views use server-wide totals separately from loaded invoice/activity lists. Search/status filters do not redefine account balances. Unknown due dates stay outside overdue totals. Statements require every invoice page before complete printing.

The existing installed POS was inspected without modifying its basket or shift. It was still running an earlier approval-based UI, with an empty basket and no open shift. The updated app gives product discounts a clear labelled field and shows a waiting-app-update notice. Updating uses the existing guarded update flow, preserving saved site data and original requests.

Implementation is limited to presentation and derived displays; existing transaction commands, roles, exact-money arithmetic, invoice uniqueness, stock checks, payment/reversal rules and original-request recovery remain authoritative.
