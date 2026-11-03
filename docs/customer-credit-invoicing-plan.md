# Customer credit and invoicing: recommended implementation plan

Prepared November 3, 2026. Original recommendation, subsequently approved for implementation. The first local build is described in [Customer credit: operation and rollout](customer-credit.md); the hosted database and website have not been updated by this work. Items in this plan remain proposals unless that implementation note explicitly lists them as delivered.

## Confirmed request

Better Yield Magpet needs customer credit checkout, customer balance tracking and both business credit documents and official BIR-compliant invoicing. Each invoice has **one selected term: 30, 60 or 90 calendar days**. These are alternative final due dates, not three scheduled installments. Customers may make partial payments before the final due date.

The existing forest sidebar, warm paper, typography and checkout/register-detail layouts remain the visual authority. This is an extension to the current UI.

## What the project currently supports

- `packages/domain/src/index.ts`: the strict version-1 sale contract requires cash received to cover the full sale total and has no customer or credit-term fields.
- The foundation database defines the same cash-paid constraint on sales and restricts payment method to cash. A completed sale records stock movement and its cash payment together.
- Shift reconciliation uses recorded payment amounts. Receipt details currently calculate change as cash received minus the entire sale total.
- Reports distinguish original purchases from refund/recovery activity, but do not provide customer receivables or collections reporting.
- Cash sales already have offline persistence, original request IDs, recovery and immutable history. Credit and official invoices are explicitly outside the previous pilot scope; this proposal adds them deliberately.

A payment-selector-only change would produce incorrect cash, refunds and reporting. The financial records and user interface must be implemented together.

## Recommended first release

### Customer accounts

Add **Clients & credit** to the sidebar. Use a searchable client register and selected-client detail matching Sales & receipts. Provide tabs for Profile, Invoices, Payments and Statement.

Store the customer's legal/display name, contact person, phone, billing address and invoicing details required for the selected official issuance route. Record a customer ID that remains stable when names change. Limit access to billing/contact information by role; avoid collecting unrelated identity documents.

The owner enables credit, sets a credit limit, chooses a default term and permitted terms, and can suspend further credit. Capture who approved the policy and when. Cashiers cannot create credit eligibility or increase limits.

Show outstanding balance, overdue amount, remaining credit and the next due date. A suspended customer remains visible and may pay existing debts.

### Checkout

Retain the product catalog and Current sale layout. Add a labelled **Payment: Cash / Credit** choice in the sale panel.

Choosing Credit reveals:

1. Client search/selection; anonymous credit checkout is unavailable.
2. Current outstanding, overdue amount and available credit.
3. Payment term: Net 30, Net 60 or Net 90, limited to that customer's approved options.
4. An explicit calculated calendar due date in Asia/Manila.
5. Optional cash paid now, including tender/change details when cash is taken.
6. A clear balance due and a **Complete credit sale** action.

Recommended term calculation: invoice issue date plus the selected number of calendar days. Display the due date before confirmation; do not substitute one/two/three calendar months or silently shift weekends. Mark unpaid balances overdue starting the day after the due date in Asia/Manila. Any later approved extension must retain the original due date and its change history.

Before completing, the server verifies current permissions, open shift/device, product/lot/price validity, customer status, approved term and remaining credit. It atomically records the sale, stock deduction, receivable, initial payment if any, and invoice reference. Two simultaneous requests cannot both consume the same remaining credit. Retrying an uncertain request returns its original result.

Stock is deducted once when goods are released through the completed sale. Later collections never deduct stock. An invoice draft or quote does not release goods or create a receivable.

### Collections

Add **Record payment** in the client/invoice detail. Initially accept cash only, using the collector's own authorized open shift. Later bank transfers, GCash or checks need separate verified method/clearing records and must not increase drawer cash.

The collector selects the invoice(s), enters the cash received and confirms exact allocations. Default suggestions may prioritize the oldest due invoice, but allocations must be visible before saving. An allocation cannot exceed that invoice's current unpaid balance. Any extra tender is change in the first release; unallocated deposits/customer-wallet balances are a later feature.

Create a uniquely identified payment acknowledgement linked to the original invoice(s), cashier, shift, posting time and allocations. Support partial payments and full settlement. Never create another product sale for a debt collection.

Use server-side balance checks and locks for concurrent collectors. Persist the original collection request locally before sending, retain uncertain results in Sync center, and retry that request rather than entering another payment.

### Invoices, statements and official issuance

The customer's credit document should show seller/buyer details, original item units and prices, issue date, selected term, due date, sale total, payment received and remaining balance. Provide print and PDF, plus a statement listing invoices, payments, credit notes and balance as of a displayed time.

Use explicit document identities: internal sale/reference, official invoice number when issued, payment acknowledgement and statement. A reprint keeps the original number. Issued documents are immutable snapshots; later payments are linked records rather than rewritten copies of the originally issued document. A current balance view is labelled as current with its own timestamp.

For official invoicing, first establish the business's VAT/non-VAT registration, applicable product tax classifications, required invoice fields, series/numbering, registered system or manual route, and any applicable electronic issuance/reporting requirements. Do not assume every agricultural product has the same tax treatment.

**Recommended route:** ask the owner's accountant to confirm either the existing authorized manual invoicing process to be linked to POS records, or a suitable registered official invoicing system/provider. Build direct official issuance only against the confirmed requirements. Until that route is ready, any internal credit document must be labelled appropriately and linked to the separately issued official invoice; it must not claim to be BIR-compliant.

A sale with an external official issuance step needs visible states for pending issuance, issued and failed/uncertain response. Use one permanent correlation ID and retry safely. Confirm the official release procedure before enabling real credit checkout; do not treat an unresolved official document as successfully issued or create a second receivable to retry it.

The BIR's RR 7-2024 defines invoicing for cash and on-account/credit sales. RMC 77-2024 clarifies invoicing requirements and example formats. RR 26-2025 distinguishes covered taxpayer categories for electronic invoicing. These sources do not establish Better Yield's own registration or prove that this POS is approved; the accountant must confirm current applicable rules before official issuance.

Sources checked:

- [BIR RR 7-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%207-%202024.pdf)
- [BIR RMC 77-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf)
- [BIR RR 26-2025 official digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2026-2025%20Digest.pdf)

### Credit controls

- Recommended default: new approved clients start on Net 30; the owner explicitly enables Net 60/90 where agreed. The owner chooses actual limits rather than software assigning them.
- Block new credit for suspended clients, exhausted limits or overdue balances. A permitted owner exception requires a reason and retained audit record; it does not erase the debt.
- Show remaining credit after the proposed sale. Only the unpaid portion consumes the credit limit.
- Start without automatic interest, late fees or collection messages. Any later fee policy needs explicit agreed rules. In-app due reminders and downloadable statements are sufficient initially.
- Do not allow deletion of issued invoices, collections or historical clients with activity. Correct using linked reversals/credit notes. Owner-authorized write-offs remain visible and do not silently become cash payments or stock returns.
- Record customer acknowledgement of the agreed term and goods handover through the owner's chosen documented process.

### Returns and corrections

A return against an unpaid invoice first reduces the amount owed through a linked credit note. It must not create an invented cash payout. A paid/part-paid invoice requires a preview separating debt reduction, refundable cash and physical goods disposition. Never pay back more than justified by the linked paid/credited amounts.

Keep the existing inspected saleable/held return workflow. Stock changes only for goods physically returned and accepted into the appropriate state. A price allowance, write-off or invoice correction has no automatic stock effect. Reverse mistaken collections through linked records in the proper drawer/shift; do not edit closed-shift cash history.

### Reporting

Extend Overview with separate figures for original cash sales, original credit sales, actual cash collected, outstanding receivables and overdue receivables. Collections of earlier invoices must not increase today's gross product sales. Clearly distinguish a sale's original date from a collection's posting date.

Provide a receivables register with customer, invoice date, original/current due date, term, original amount, payments/credits, remaining balance and status. Support customer, term, due-date, invoice-date and status filters. Show full-filter totals independently from paginated loaded rows.

Provide **aging by days past due**, with distinct buckets: Not due (including due today), 1-30, 31-60, 61-90 and 91+ days overdue. Contract terms and aging are separate: a Net 90 invoice is not 90 days overdue on its issue date.

Invoice states: Draft, Awaiting approval if applicable, Issuance pending, Open, Part-paid, Paid, Credited/cancelled and Written off as appropriate. Overdue is calculated from remaining balance and due date; a part-paid invoice can also be overdue.

## Example to verify the accounting

| Event | Product sales recorded | Cash entering the drawer | Receivable remaining | Stock effect |
|---|---:|---:|---:|---|
| Complete a ₱12,000 Net 60 sale with ₱2,000 paid now | ₱12,000 | ₱2,000 | ₱10,000 | Deduct goods once |
| Collect another ₱3,000 later | ₱0 additional | ₱3,000 | ₱7,000 | None |
| Collect the final ₱7,000 | ₱0 additional | ₱7,000 | ₱0 | None |

This illustrates operational gross amounts, not tax-accounting entries. The accountant confirms tax treatment. Sales and collections may occur in different shifts and reporting periods.

## Technical implementation boundary

- Add stable customer identities, approved/versioned credit policies, invoice/document snapshots, receivable events, collection requests, payment allocations, linked credit notes and audited approvals. Separate customer-credit adjustments from physical stock movements.
- Preserve existing immutable sale records and version-1 cash payloads. Introduce a versioned credit-sale contract and authorized server commands rather than accepting short cash on old cash-sale requests.
- Never model debt as a fake cash payment or use the Hold sale draft feature as a customer account. The authoritative receivable balance is derived from posted original events and allocations, with transactional limits enforced on the server.
- Extend shift closing to include actual collections and exclude unpaid invoices. Generalize receipt rendering so credit balances cannot appear as negative change.
- Keep new credit issuance, credit-policy changes and collections online in the first release. Cash retains its current offline behavior. Offline credit selection can prepare a clearly unsent draft only; it cannot approve credit or authorize goods release. Held drafts must preserve selected customer/terms/payment mode and revalidate them online when resumed.
- Use database-enforced organization/branch permissions, append-only audit records, unique request IDs and exact centavo arithmetic. History and statements must remain correct after customer names, tax settings, prices or credit terms change.
- Introduce compatible schema/API changes before exposing UI controls. Existing installed/offline clients must still replay legitimate cash requests and recover uncertain operations. Do not silently convert historical cash sales into credit sales.
- Any approved opening customer balances need a separate one-time reconciled import tied to actual historical invoices, with an explicit cutoff so old sales are not counted again. Reimport must not duplicate balances.
- Use the current forest/paper design, semantic register tables, selected-record details, status words and keyboard-friendly forms. On phones place payment choices and balance/due-date confirmation near Review sale. Hide owner-only controls while enforcing the same rules on the server.

## Delivery sequence and acceptance

1. **Agree business and invoice rules.** Owner confirms credit eligibility/limits, who may collect, overdue exceptions and payment-term acknowledgement. Accountant confirms official issuance route, tax setup and applicable registration/reporting. Document the chosen route and acceptance evidence.
2. **Build the complete credit cycle in an isolated test environment.** Customers, credit sale/down payment, stock posting, collections, allocations, debt/paid returns and drawer reconciliation form one coherent release. An invoice-only screen is insufficient.
3. **Connect official documents and reporting.** Integrate the confirmed official route, immutable printing/PDF/reprints, statements, receivable aging, cash/credit reporting and visible issuance recovery states.
4. **Run acceptance checks, then a controlled Magpet pilot.** Rehearse with a small owner-selected group of approved customers and compare daily cash, stock, invoice totals, collections and customer balances. Expose the feature only after those checks pass and the official process is ready. Update the user-guide PDF after the final flow is accepted.

Required tests include all three term dates across month/year/leap boundaries; due today versus overdue; partial cash plus credit; under/over-limit decisions; concurrent sales and collectors; duplicate/lost-response retries; allocation/reversal limits; unpaid/part-paid/paid returns; exact stock and drawer totals; original-sale versus collection report dates; record paging/full totals; scope/role denials; historical snapshot preservation; failed external invoice issuance/retry; old offline cash-client replay; backup/restore and recovery. Existing cash, refund, count and offline suites must remain passing.

## Inputs still needed before official implementation

- Seller registration details and VAT/non-VAT status; actual invoice sample and authorized numbering/issuance route.
- Accountant confirmation of product tax treatment, customer invoicing fields and current BIR obligations.
- Initial approved customer list, limits, allowed terms, collector roles and any existing receivables to carry forward.
- Owner decision on who may override overdue/limit restrictions and how customer acceptance is documented.

These inputs affect production correctness. The recommendation can be reviewed now; they do not require changing the existing cash system during planning.
