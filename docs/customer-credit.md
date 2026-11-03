# Customer credit: operation and rollout

## Current build

This is a local implementation of Clients & credit and the online credit checkout extension. It has not been applied to the hosted database or published website. The owner confirmed **VAT registration** and **authorized printed/manual invoice booklets** on November 3, 2026. The website links each credit purchase to the actual booklet series/number; internal credit records and statements are explicitly not tax invoices. VAT breakdowns and official issuance remain on the existing authorized manual document.

The first version supports owner-approved clients and limits; approved 30/60/90-calendar-day terms; one final due date per invoice; partial cash paid at sale; per-invoice later cash collections; retained collection reversals; inspected credit returns with separate debt/cash effects; current balances, aging, loaded-row CSVs and complete loaded statements. Holding a draft preserves its credit selection and any original attempted request.

Credit operations require an online authorized session. Collections/refunds require the employee's own current open shift; the owner manages credit policies and approves returns/reversals. Stock staff cannot access customer credit records. Existing version-1 cash checkout and offline sales remain intact.

An unresolved credit-sale request blocks another cash checkout on that PC. After confirmation, a newer online stock snapshot is required before cash checkout resumes, so a pre-credit download cannot clear the stock-refresh safeguard. Original saved cash retries remain available.

## Owner setup

1. Open **Clients & credit → Add client** with an owner account.
2. Enter the actual name, phone, billing address and appropriate invoice TIN details.
3. Set the credit limit and approved terms. New forms default to 30 days; enable 60/90 only as agreed.
4. Enter an approval reason, confirm owner approval and save.
5. Use **Edit credit policy** to change a policy later. Versions prevent overwriting a newer owner's edit. Suspending new credit still allows existing debts to be collected.

## Credit checkout

1. Open your own shift online. Finish synchronization of original pending cash sales and requests.
2. Build the basket normally, using the configured product units and actual measured quantities.
3. Choose **Credit · 30/60/90 days** in Current sale.
4. Select the client and one of their approved terms. Review the exact due date, available credit and balance after any down payment.
5. Enter the exact cash retained under **Cash paid now**. Give any required change separately; if the full sale is paid, use Cash checkout.
6. Issue the authorized manual VAT invoice using the existing booklet process. Enter its series and invoice number. The same normalized number cannot be reused for another credit sale.
7. Confirm the manual invoice and the client's agreement to the due date; select **Complete credit sale** once.
8. Wait for confirmation before handing over goods. For a lost response, use **Confirm original credit sale** or retry its original request in Sync center. Do not create another invoice or basket to force confirmation.

The server checks the current client limit, overdue balance, role/shift/device, prices, units, batches and confirmed available stock. It adds the selected calendar days to the issue date in Asia/Manila. A midnight date change requires re-review. Stock posts once at the sale; unpaid amounts do not become drawer cash.

## Collections and returns

Select the client and invoice. **Record cash payment** applies the exact retained cash to that invoice, requires a reference/note and records the current drawer. For a payment covering several invoices, record the appropriate amount separately against each invoice and retain the shared external payment reference. The first release does not automatically allocate one combined payment or hold unapplied customer deposits.

The linked credit record contains the original invoice ID and payment references and can be printed or saved as PDF. The **Payments** tab retains collection events and allows the owner to reverse a mistaken collection with a reason and verified cash handover. Reversal restores debt and affects the correcting drawer; it never deletes the original payment or creates another sale.

Under **Owner: return goods / credit this invoice**, check original remaining quantities and the physical return. Preview splits debt reduction from any cash refund. Inspected saleable goods re-enter saleable stock; damaged or uninspected goods remain held. A credit against an unpaid amount does not invent cash paid back. The previous cash-only refund commands refuse credit invoices.

Credit-note correction after subsequent activity, write-offs, limit/overdue overrides, due-date extensions, automatic fees, payment-provider integration and opening-debt import are not exposed in this first version. Preserve the originals for documented owner/accountant reconciliation; do not work around those limits with fake sales or stock adjustments.

## Reports and statements

- **Outstanding / overdue** cover the full current account filter, not only the visible register page.
- **Original credit sales** count each original product sale once. **Net cash collected** includes down payments and subsequent collections less cash refunded or reversed; it is not additional product sales.
- Aging uses days past the due date: not due/due today, 1-30, 31-60, 61-90 and 91+ overdue. A Net 90 invoice is not 90 days overdue on issue.
- The register shows 10 loaded rows per page. **Load older credit invoices** fetches older records. CSV includes loaded invoices and says so.
- Choose one client and **Statement**, load every older page, then **Print statement / Save PDF**. The printed statement renders all loaded invoices and related events instead of only the ten visible rows.
- Issued sale/client details are snapshots; later client renaming does not rewrite old documents. Current balance figures carry a displayed snapshot time.

## What the owner still needs to provide

1. Approved customer list with names, contacts, billing details, credit limits and allowed terms.
2. The actual booklet series/number format and a sample invoice layout, with confirmation of the accountant's VAT treatment and how existing selling prices are represented. Do not send account passwords or credentials.
3. Which individual staff accounts may collect payments and who will perform owner approvals.
4. Existing unpaid invoices, original amounts, payments already received, due dates and reconciled balances, if old debts need a separately designed opening import. Do not enter old debts as new product sales.
5. The owner's documented way to capture acceptance of payment terms and goods handover.

## Verification and release gate

Local tests use an isolated PostgreSQL/PGlite database with simulated Auth claims, not the hosted business. They cover atomic stock/cash/debt posting, all three terms, due-date changes, limits, suspension/overdue blocking, partial collections, reversals, debt/cash return allocation, original-request retries, permissions, local recovery exports and cash closing. UI fixtures execute real database commands through an isolated test binding; they do not connect to the hosted API.

Before hosted release: run genuine disposable Supabase/Auth/PostgREST and concurrent-session checks; verify RLS/direct API denials, same-request and concurrent-limit/collection behavior; perform a restore including the three new credit tables and payment links; verify the compatible migration and old cash-client replay; then rehearse one approved customer end to end. Reconcile manual invoice, sale, collection, drawer and stock. Update installed cashier windows after original pending work clears. No local test establishes BIR registration/approval, production restore, real customer approval or physical cash/stock acceptance.

The migration depends on the existing imported-catalog setup fields. Preserve the existing catalog migration and user changes when packaging this release. Do not push a migration history that omits them.
