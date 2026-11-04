# Customer returns and supplier purchases

Customer accounts start as **Normal customer**. The owner can edit the account's
Customer type to **Distributor** or **Owner**. These are customer classifications;
they grant no staff permissions and do not change balances, limits or terms.
The customer register shows Normal customers first, then Distributors, then Owners,
with outstanding balance sorted within each group. Use the type filter to focus
on one group. Clicking a row opens its account or invoice; the named buttons also
support keyboard navigation.

For a sale return, choose **Return / refund items**, check remaining quantities,
then select the original lines and quantities. **Select all remaining quantities**
fills the financial quantities only; record the goods actually returned and whether
they are saleable or held separately. Original discounts and exact remaining
centavos stay attached to the original sale. An authorized owner shift, internet and resolved local requests are required
before submitting. Finish the checkout basket before issuing a cash-sale refund.

Credit returns cancel unpaid debt first. For a ₱400 sale with ₱100 paid and ₱300
owed, returning ₱300 of goods cancels the ₱300 debt and refunds no cash. Returning
all ₱400 cancels the debt and refunds the ₱100 already paid. A fully paid invoice
refunds the selected returned value in cash. Check the debt/cash preview before
authorizing. Imported opening debts have no original product lines to return.

The owner can enter optional quoted unit costs and proposed Cash/Credit terms on
a purchase-order request. Quotes are approval information only: requesting or
approving an order creates neither stock nor supplier debt.

When inspecting a delivery or recording a Quick receipt, select **Save this
delivery with its supplier bill** to record the actual invoice. Enter its number,
date, actual amount and agreed terms from the supplier document. The invoice may
include goods that were held, rejected or missing; accepted quantities do not
automatically determine its amount.

- **Cash** records a verified full payment already made from owner/business cash
  outside the sales drawer.
- **Credit** records a 30/60/90-day debt, with an optional actual advance payment
  from that same external cash source.
- **More goods for an invoice already recorded** links another physical delivery
  to the original bill without another invoice or payment. Paid bills are included
  among these choices. Use Load older supplier bills when needed.

Delivery, new invoice, any confirmed payment and their link save in one database
transaction. The saved bill opens in **Supplier bills**, including paid invoices.
Financial fields and links are owner-only; other authorized receiving staff retain
the stock-only workflow. Record later bank/cheque payments in Supplier bills.

If confirmation is interrupted, retry the saved original request in Sync center.
Its receipt, invoice and payment IDs survive recovery export/import, and the
server returns the original confirmation without receiving or paying twice.
Reversing an inspection corrects stock; it does not erase a genuine supplier bill
or completed payment. Link the corrected inspection to that same invoice and
record any separate supplier credit or payment correction in Supplier bills.

Temporary notices close after three seconds. Unresolved requests remain visible
in Sync center, form errors remain with their task, and the last global action
error can be reopened after its temporary notice closes. The former red global
1,000-row notice was triggered by any loaded table, including the product catalog;
scope details and full-history search/export remain available in each workspace.
