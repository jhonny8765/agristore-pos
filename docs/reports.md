# Finding and exporting older records

Select the branch in the top bar before opening a register. Branch switching requires a connection and a closed cashier shift.

| Screen | Register | Included records | Date used |
|---|---|---|---|
| Purchasing | Receiving history | Purchases and opening-stock receipts recorded at this branch | Receipt recorded date |
| Transfers | Transfer register | Dispatches from, or receipts addressed to, this branch | Dispatch date |
| Stock counts | Count register | Physical counts submitted at this branch | Count recorded date |
| Overview | Audit register | This branch's events and events applying to the whole business | Event recorded date |

Dates follow **Asia/Manila**. From date starts at midnight; Through date includes the whole final day. Leave either field blank for an open-ended range. **Apply dates** loads that range; **Clear dates** returns to all dates. Editing the fields alone does not change the loaded range printed below the table.

Registers start with 50 rows, newest first. **Load older records** extends the list. The footer distinguishes older available records from the end of matching history. A failed next-page download leaves the loaded rows intact; use **Retry history**. Reconnect to fetch more history or apply dates. Loaded rows can still be read and exported during a brief outage.

On narrow screens, scroll inside the table to reach its remaining columns. Keyboard users can Tab to the named history-records region and use the arrow keys to scroll it. Audit details can be expanded with the keyboard as well.

Transfer and count rows identify the product and lot, display its expiry when known, and label every quantity with the base measure (`kg`, `liter` or `piece`). Count rows also show the reason beside the recorded discrepancy. Long lot identifiers and reasons wrap in their product cell; numeric and action columns remain reachable through the table's horizontal scroll region. An unavailable batch retains its ID rather than being labelled as stock without a lot.

**Export loaded rows (CSV)** downloads exactly the displayed records, including branch scope and complete record identifiers. Load the older pages you need before exporting; the button does not export the entire database. The filename includes the register, branch identifier and applied range. Timestamps in the CSV retain their database timezone offset; the date filter always uses Manila time. Text resembling spreadsheet formulas is escaped when exported. Keep exports with the business records they contain.

Transfer/count exports include product ID, batch ID, lot, expiry date and base unit in separate columns. Quantity columns remain numeric; count exports include the exact counted-minus-expected difference. Product/lot descriptions come from the current downloaded catalog, while original IDs and numeric records remain the audit references.

Transfer/count quantities and stock-journal quantities are requested as exact database text before JSON parsing, then displayed/calculated using decimal arithmetic. This avoids losing the last decimal places of a larger balance before exporting its discrepancy. Journal/event identifiers are also retained as text so large IDs cannot round to another record. These changes do not alter stored stock or journal entries. The standard stock measures still support six decimal places; use the actual scale and configured product conversion during selling.

Receipt history under Sales & receipts has its own **Load older receipts** action. Overview totals include all confirmed records; its flag, cash reconciliation and stock movement previews remain bounded to the most recent 1,000 records. The separate audit register supports older pages. Sales, stock movements and corrections remain immutable: an export or filter does not change stock.

These registers supplement reconciliation. They do not provide official tax invoices or a full accounting ledger.
