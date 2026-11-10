# Customer credit: operation and rollout

## Current build

### Separate Customers and Distribution registers — November 10, 2026

**Customers & credit** now places **Distribution** beside **Customers**. Customers contains normal customers (including legacy accounts without an explicit type) and any owner accounts; Distribution contains distributor accounts. Both use the same account table, search, balance filters, ordering, pagination, account details, payments and statements. The summary cards cover the entire selected account group, independent of table pages or search, with exact integer monetary totals. Invoices, Payments and Statements remain shared all-account views.

Opening an account remembers its register for the Back button. **Add distributor** defaults the new account to Distributor; the owner may still choose its actual classification. Changing an account's type places it in the appropriate register after refresh without copying the account or rewriting its invoices, payments or balance. Combined aging and full account totals remain in the shared views; individual registers show only their group's summary. This frontend-only change requires no database migration or data import.

### Checkout without limits — published November 3, 2026, 20:51 Manila

Release `cf-mw0ob7d5` removes required credit limits, separate client approval and per-client term restrictions at checkout. Any saved client in the branch can use 30, 60 or 90 days. The owner explicitly chose a warning with continued sales for overdue utang. Unknown historical due dates also remain warnings; their dates and balances are not reset. Add/Edit client now requests contact details only. Legacy policy fields and original saved policy requests remain supported without rewriting existing client records. This supersedes older release notes below that required credit approval or a limit.

Migration `20261103110000` changes the authoritative credit rules and adds the owner-only, versioned, idempotent `save_credit_contact` action. Original role/shift/device, term, money, product/unit/batch, stock and duplicate-invoice checks remain. Two restrictive policies preserve client-contact privacy in shared audit/request histories. Contact requests participate in original-request recovery. No existing application row was updated by this migration.

Validation: [application checks on `1bd4dd2`](https://github.com/jhonny8765/agristore-pos/actions/runs/41637224806) passed type/lint, 579 unit tests and 68 browser tests. [Database checks on `40b91dc`](https://github.com/jhonny8765/agristore-pos/actions/runs/41638251474) passed strict database lint, 1,476 assertions across 32 files, the 49-table encrypted restore drill including client-contact retries, and three signed-in tests under both ordinary and fixed Magpet setups. Those tests exercise zero-limit clients, sale/collection racing retries, stock exhaustion, role boundaries and offline cash reconciliation. Six focused cases also passed against the actual connected build; desktop/phone accessibility and overflow checks passed.

Before/after comparison verified all 10,116 business rows across 49 tables unchanged, including the 221 saved clients and 743 inventory review records. Existing access policies and unrelated database functions matched; only the intended restrictive contact policies were added. The unpaid total remains `4588259060` centavos. An authenticated encrypted backup round trip and the prior deployment ZIP were verified before applying the change. Live health returned HTTP 200 with the expected release, and served HTML matched the built package. ZIP SHA256: `4299ace7eab326a3cbc8ecdbe3196bbb78e8cde4f3572ae50ce9c3330d9154d3` (189 files). Private evidence remains outside the repository in `tmp/no-limit-credit-release`.

Clients & credit and the online credit checkout extension were deployed to the existing Magpet website on November 3, 2026. Opening customer receivables were reconciled and imported separately from product sales, cash and stock. See [release evidence and limits](customer-credit-verification.md). The owner confirmed **VAT registration** and **authorized printed/manual invoice booklets** on November 3, 2026. The website links each credit purchase to the actual booklet series/number; internal credit records and statements are explicitly not tax invoices. VAT breakdowns and official issuance remain on the existing authorized manual document.

The current version uses saved clients without a credit limit or separate approval. The cashier chooses 30/60/90 calendar days and one final due date per invoice. Existing overdue debts and unknown historical due dates are warnings and do not prevent a new sale, as requested by the owner. Partial cash paid at sale, per-invoice collections, retained collection reversals, inspected credit returns, current balances, aging, exports and complete loaded statements remain available. Holding a draft preserves its selection and any original attempted request.

Credit operations require an online authorized session. Sales/collections/refunds require the employee's own current open shift; the owner manages client details and approves returns/reversals. Stock staff cannot access customer credit records. Existing version-1 cash checkout and offline sales remain intact.

An unresolved credit-sale request blocks another cash checkout on that PC. After confirmation, a newer online stock snapshot is required before cash checkout resumes, so a pre-credit download cannot clear the stock-refresh safeguard. Original saved cash retries remain available.

## Owner setup

1. Open **Clients & credit → Add client** with an owner account.
2. Enter the actual name, phone, billing address and appropriate invoice TIN details.
3. Select **Save client**. No limit, permitted-terms selection or credit approval is required.
4. Use **Edit client** to update contact details later. Versions prevent overwriting a newer owner's edit. Stored legacy policy values remain available to original saved requests but no longer determine checkout eligibility.

## Credit checkout

1. Open your own shift online. Finish synchronization of original pending cash sales and requests.
2. Build the basket normally, using the configured product units and actual measured quantities.
3. Choose **Credit · 30/60/90 days** in Current sale.
4. Search/select the saved client and choose 30, 60 or 90 days. Review the exact due date, current unpaid debt, any overdue/unconfirmed-date warnings and balance after a down payment.
5. Enter the exact cash retained under **Cash paid now**. Give any required change separately; if the full sale is paid, use Cash checkout.
6. Issue the authorized manual VAT invoice using the existing booklet process. Enter its series and invoice number. The same normalized number cannot be reused for another credit sale.
7. Confirm the manual invoice and the client's agreement to the due date; select **Complete credit sale** once.
8. Wait for confirmation before handing over goods. For a lost response, use **Confirm original credit sale** or retry its original request in Sync center. Do not create another invoice or basket to force confirmation.

The server checks that the saved client belongs to this branch, the selected term is 30/60/90, and the role/shift/device, exact prices, units, batches and confirmed available stock are valid. It adds the selected calendar days to the issue date in Asia/Manila. A midnight date change requires re-review. Stock posts once at the sale; unpaid amounts do not become drawer cash. Existing debts and unknown historical due dates retain their original amounts and dates; a new invoice never restarts their clock.

## Collections and returns

Select the client and invoice. **Record cash payment** applies the exact retained cash to that invoice, requires a reference/note and records the current drawer. For a payment covering several invoices, record the appropriate amount separately against each invoice and retain the shared external payment reference. The first release does not automatically allocate one combined payment or hold unapplied customer deposits.

The linked credit record contains the original invoice ID and payment references and can be printed or saved as PDF. The **Payments** tab retains collection events and allows the owner to reverse a mistaken collection with a reason and verified cash handover. Reversal restores debt and affects the correcting drawer; it never deletes the original payment or creates another sale.

Under **Owner: return goods / credit this invoice**, check original remaining quantities and the physical return. Preview splits debt reduction from any cash refund. Inspected saleable goods re-enter saleable stock; damaged or uninspected goods remain held. A credit against an unpaid amount does not invent cash paid back. The previous cash-only refund commands refuse credit invoices.

Credit-note correction after subsequent activity, write-offs, limit/overdue overrides, extensions of new-sale due dates, automatic fees and payment-provider integration are not exposed in this first version. Preserve the originals for documented owner/accountant reconciliation; do not work around those limits with fake sales or stock adjustments.

## Opening unpaid balances

The supplied CREDIT workbook's Amount was confirmed by the user as the **current unpaid balance**. The maintenance importer records customer rows as opening receivable documents, never product sales, past cash payments or stock movements. It preserves the original workbook hash, source rows, references, issue dates and notes. Branch-account rows remain in the private source batch and are excluded from customer debts. Zero-balance rows preserve the client without creating an invoice debt.

Imported clients start with new credit disabled and a zero limit. The displayed term is **Terms not approved**. Original invoice terms and due dates remain unknown; their balances appear under **Due date unconfirmed**, not in a guessed overdue period. The owner can select an opening invoice, expand **Confirm historical due date**, and record the actual agreed date with an evidence reference and reason. Each confirmation retains its history. An unpaid opening invoice with an unknown due date blocks further credit purchases for that client even after a policy is approved.

Actual new collections may be applied to opening invoices through the employee's own online shift and enter today's drawer exactly once. Imported opening balances never enter that drawer. Goods-return controls are unavailable for opening documents because the workbook supplied neither original goods nor earlier payment history. Preserve those originals for separate reconciliation.

`scripts/prepare-credit-import.mjs` prepares private reviewable SQL from a read-only workbook extraction. The importer is inaccessible through public/authenticated API roles. Repeating the same original source is idempotent; a changed workbook cannot silently append or double the opening debt. Source files, customer rows and generated SQL must stay outside version control and public deployment assets.

## Reports and statements

- **Outstanding / overdue** cover the full current account filter, not only the visible register page.
- **Original credit sales** count each original product sale once. **Net cash collected** includes down payments and subsequent collections less cash refunded or reversed; it is not additional product sales.
- Aging uses days past the due date: not due/due today, 1-30, 31-60, 61-90 and 91+ overdue. A Net 90 invoice is not 90 days overdue on issue.
- The register shows 10 loaded rows per page. **Load older credit invoices** fetches older records. CSV includes loaded invoices and says so.
- Choose one client and **Statement**, load every older page, then **Print statement / Save PDF**. The printed statement renders all loaded invoices and related events instead of only the ten visible rows.
- Issued sale/client details are snapshots; later client renaming does not rewrite old documents. Current balance figures carry a displayed snapshot time.

## Finding saved clients at checkout

Credit checkout loads the branch's saved clients from the signed-in organization/branch, including before a cashier shift is open. A missing shift previously left an active empty dropdown because the lookup incorrectly depended on the shift authorization. Searching or selecting a client does not open a shift or create a financial record.

Use **Search saved clients** to filter by name or phone, then choose the correct **Credit client**. Search ignores name case/accents and accepts local or +63 phone formatting. It shows the saved-client count, search matches and last checked time. **Refresh clients** reloads policy changes. A selected client stays explicitly visible if the search stops matching; searching requires confirmation again, and Enter in this search field does not submit checkout. Phone layouts give the search input its own full-width row.

All saved clients remain findable, including those whose new credit is disabled. The picker distinguishes credit not enabled, overdue balances and exhausted credit. A saved opening debt does not itself approve another loan. Existing debt collection remains separate from enabling new purchases.

For a client who needs new credit, the owner opens **Customers & credit**, selects that client, chooses **Edit credit policy**, sets the total credit limit and allowed terms, enables new credit purchases and saves the documented approval. The available credit is the approved limit less current unpaid debt. Return to checkout or refresh clients after approval. New checkout still requires the employee's own online open shift, sufficient available credit, no overdue debt, an allowed term and the linked manual invoice confirmation.

Loading and failed-refresh states do not masquerade as an empty saved directory. A failed refresh preserves the last loaded client/check time and blocks a new credit sale until it can be checked again. Existing uncertain original requests retain their retry path. If owner-approved terms changed, refreshing selects a permitted term and requires invoice confirmation again.

## What the owner still needs to provide

1. Approved customer list with names, contacts, billing details, credit limits and allowed terms.
2. The actual booklet series/number format and a sample invoice layout, with confirmation of the accountant's VAT treatment and how existing selling prices are represented. Do not send account passwords or credentials.
3. Which individual staff accounts may collect payments and who will perform owner approvals.
4. Confirmed original due dates and supporting agreements for imported unpaid invoices. Earlier payment history and original goods remain separate records unless independently supplied and reconciled. Do not enter old debts as new product sales.
5. The owner's documented way to capture acceptance of payment terms and goods handover.

## Verification and release gate

Local tests use an isolated PostgreSQL/PGlite database with simulated Auth claims, not the hosted business. They cover atomic stock/cash/debt posting, all three terms, due-date changes, limits, suspension/overdue blocking, partial collections, reversals, debt/cash return allocation, original-request retries, permissions, local recovery exports and cash closing. UI fixtures execute real database commands through an isolated test binding; they do not connect to the hosted API.

The hosted release evidence records genuine disposable Supabase/Auth/PostgREST checks, concurrent-limit/collection behavior, role/direct-API denials, a full synthetic restore including credit source/due-date/payment evidence, current-UI credit checkout and retained offline cash recovery. The older full browser suite still needs migration to the new UI; focused credit/cash verification is not full-store recertification. Before real use, the owner should rehearse one approved customer end to end and reconcile the manual invoice, sale, collection, drawer and stock. Update installed cashier windows after original pending work clears. Automated tests do not establish BIR software approval, a certified production restore, real customer credit approval or physical cash/stock acceptance.

The migration depends on the existing imported-catalog setup fields. Preserve the existing catalog migration and user changes when packaging this release. Do not push a migration history that omits them.

## Saved-client search release — November 3, 2026

Read-only live checks confirmed **221 saved clients**, zero open shifts and **0 clients enabled for new credit**, each with a zero approved limit. The empty checkout dropdown came from a lookup scoped through the missing shift lease, not a failed credit-register import. The released lookup now uses the authenticated branch independently of shift opening.

Final application source `ec3fa84` passed [application verification](https://github.com/jhonny8765/agristore-pos/actions/runs/41629095072): type/lint, **576 unit tests, all 66 browser tests**, production dependency scan and the hosting build. Focused fixtures cover 221 saved-but-disabled clients before a shift, name/phone search, permission blocking, owner-approved policy refresh, changed terms, preserved selection, failed refresh/retry, held drafts, original lost-response retries and Enter staying separate from financial submission. Desktop/phone checks include accessibility and horizontal fit.

The unchanged database code passed [database verification](https://github.com/jhonny8765/agristore-pos/actions/runs/41628295361): strict lint, **1,430 PostgreSQL assertions**, authenticated encrypted restoration with **49 table fingerprints**, and **6 signed-in workflows normally plus 6 under the fixed Magpet setup**. This remains a focused signed-in selection, not the entire legacy integration suite. No production transaction was used for testing.

Cloudflare confirmed deployment **`cf-mw0m661u`**, 189 files, ZIP SHA-256 **`21e874fba30a54a2ab40d295c4c649d5eb94b9efe74421b60c9fca63f83b8276`**. The live health endpoint returned the matching release and the served home-page bytes matched the package at **19:47:11 Manila time**.

Before/after read-only fingerprints matched all **10,116 rows across 49 application tables**, excluding device heartbeat timestamps. Database functions also matched. There was no schema migration, re-import, client approval or change to limits, balances, sales, payments or stock. All 221 clients remain saved, new-credit approval remains owner-controlled, and outstanding customer balances remain **₱45,882,590.60**. The previous tested deployment package is retained privately for rollback.

On an already-open till, finish or hold the current sale, confirm saved records in **Sync center**, then use **Settings → Check for app update**. After updating, choose credit payment, search the saved client and select the intended name. Use **Refresh clients** after an owner changes that client's approved policy.
