# AgriStore POS

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-approved: Next.js, TypeScript, Supabase, Vercel, Tailwind, shadcn/ui, Dexie, Workbox, Zustand, Vitest, Playwright, pgTAP.

## Users
Cashiers at agricultural supply stores in the Philippines; branch managers, stock staff, and the owner. As requested November 1, 2026, this Better Yield installation enables only **Magpet Branch**. Branch addition and renaming are fixed by the service provider; further branches are a separate maintainer change. The other existing branch records remain inactive historical references. The user maintains and runs the website for the merchant; the merchant owner manages business roles and stock decisions.

## Product Purpose
Replace handwritten records with cash checkout that survives brief network outages and an auditable stock movement journal across all branches.

## Operating Context
November 4 decision: the user requires several simultaneous cashier PCs. An owner-enabled branch mode supports multiple registered PCs with a separate shift/drawer per PC and server-confirmed cash/credit checkout. Cash checkout pauses offline in that mode; durable original requests and confirmed receipts survive interrupted responses. The old single-PC offline policy below remains available only for branches that have not enabled multiple-PC mode. See docs/multiple-cashier-pcs.md.

One Windows cashier PC per branch. PHP currency, Asia/Manila business time. Online login and shift opening; the same cashier may resume offline for up to 12 hours. Opening stock is imported and verified before live use.

## Capabilities and Constraints
Cash-only checkout; product-specific sack/kilo conversions; batches and expiration; purchasing; owner-approved count discrepancies; cash reconciliation. The generic system retains transfers and branch expansion, but this installation has a fixed single-branch setup: no customer add/rename controls, no transfer navigation or all-branch loss-report control, and Magpet-only dashboard totals. Do not delete or merge retired-branch sales, cash or stock history. No customer credit, payment processing, AI, marketing, full accounting, or official tax invoices in the pilot. Illustrative fixtures belong in the separate practice database unless the user explicitly authorizes labelled synthetic data in their staging test business.

Customers request loose products by weight and by peso budget. The cashier enters fractional kg or grams using configured retail kilo prices; peso estimates require confirmation of actual scale weight. Whole-piece products remain indivisible. The owner's Better Yield public profile supplies crop nutrition/crop care context; it does not establish actual prices, stock, or branch changes.

Catalog cards expose weight and peso choices for configured kg retail units. Owner product setup distinguishes sacks, loose kilos, sealed pieces and measured liquids; additional retail units are opt-in with independent positive prices, not automatically created at zero. Blank new weight/budget drafts block checkout and contribute no provisional kilo to Amount due.

Owners and assigned branch managers can read branch-scoped Sales analytics outside practice mode, with Asia/Manila weekly, monthly and custom periods, daily/weekly/monthly grouping, comparison dates and explicit snapshot/synchronization context. The report separates original sales from refund and recovery posting activity, ranks products by distinct purchases or original gross sales, and retains each product's own base-unit quantity. Aggregated trend and all-product CSV exports cover the displayed report snapshot; pending offline sales are excluded, and a loaded report retains its original scope on offline or refresh failure.

Analytics responses are verified before replacing a loaded report: branch/period/calendar scope, exact totals and averages, complete trend partitions, product gross totals, supported base quantities and possible receipt frequencies must agree. Incomplete or inconsistent responses use the existing retry flow and retain the last valid report/exports. Independent automated database checks compare reports with original receipts/items and dated refund/recovery payments; these checks do not establish that every physical sale was recorded.

Checkout can hold one unfinished draft on the same PC for the same cashier and open shift. Holding or resuming a draft does not create a receipt or change cash/stock. The draft retains its original checkout attempt ID, including after a saved-sale cleanup interruption. A held draft must be completed or explicitly removed before closing that shift. Drafts are separate from completed-sale recovery exports; preserve the browser profile.

## Brand Commitments
Customer-facing identity: Better Yield POS, for Better Yield Agri Trading and Services. AgriStore remains the internal product/repository identity. Practical, clear, non-technical language. At the user’s request, use the actual logo, product-display photograph and public tagline from the supplied Better Yield Facebook page; source details are in docs/brand-assets.md. Extend the established forest/paper operational design and retain the cashier composition. This request applies to the existing POS only. It does not authorize replacing configured branches with public marketing locations or assigning photographed goods to synthetic catalog records.

## Product Principles

November 4 record-management cleanup: owners use Overview → Records & exports (also linked from each register) to search stored receipts, customer invoices/payments, supplier bills/activity, stock movements, receiving and audit history. Consistent date/search/status controls and 25-row server pages keep the screen manageable. Recent receipt/operating histories default to this Manila month; customer/supplier invoice reports default to all-date outstanding debt. Supplier accounts default to outstanding, including partial payments. Paid and older history remains available and is never deleted by these filters.

Excel-ready CSV exports include the entire matching selection from one database statement snapshot, not only loaded pages. Above 10,000 rows, export fails explicitly and asks for a narrower range/search; no partial file is presented as complete. Account links use original IDs, including for same-name clients. Exact money strings, scope/checked-time metadata and original record IDs survive export. Imported customer opening amounts remain labelled unpaid-at-import balances, with no inferred historical payments or original invoice totals. Date filters select source/event dates; debt balances are current at the checked time, not reconstructed period-end balances. This read-only owner workflow adds no transaction permissions, archival, deletion or replacements for database backups. Existing receipt and statement printing is unchanged.
Completed sales survive interruption. History is append-only. Each checkout is distinct. Failed sync stays visible. Permissions are enforced in the database.

The locally implemented blind-count follow-up requires two different branch-authorized counter accounts and an owner who entered neither observation. Expected stock and unpaired quantities/notes remain private; comparisons are shown only after both entries seal. Any disagreement or intervening branch stock movement requires a fresh count. There is no self-approval or typed-witness override. This follow-up passed its complete Supabase integration gate and is released to staging; actual staff and hardware acceptance remain separate. See docs/blind-counts.md.

## Customer credit extension - November 3 release

On November 3 the user approved adding customer credit with one selected Net 30, 60 or 90 calendar-day due date per invoice, partial payments and client balances. The owner confirmed VAT registration and authorized manual invoice booklets. The deployed extension links the actual booklet invoice number; website credit records/statements do not claim official tax-invoice issuance or calculate a new VAT breakdown. Owner-approved limits, online credit sales/collections, separate debt/cash returns, collection reversals and receivable aging extend the incumbent UI. Previous cash-only exclusions above describe the published pilot; this extension is now hosted on the existing Magpet website, including source-preserving opening receivables with unconfirmed due dates and no automatic new-credit approvals. See docs/customer-credit.md for limits, required owner inputs and release checks.
## Stock follow-up workflow

Connected Inventory worklists show recorded expiry and unresolved investigations with explicit snapshot times. Owners and branch managers assign an active authorized employee and due date; assignees can record progress. Assignments and progress leave cases open and stock unchanged. Only the owner resolves an investigation with evidence. Staff/hardware and real opening-data acceptance remain separate.

## Approved workflow cleanup — November 3

### Later checkout decision — November 3

The owner requested credit checkout without limits or separate client approval. Any saved branch client can use 30, 60 or 90 calendar days, chosen per invoice. The owner explicitly chose a warning with continued sales for overdue utang. Historical unconfirmed due dates remain unknown and show a warning. These decisions supersede the earlier approval/limit and overdue-block descriptions. No existing balances, dates, client policy values or financial history are rewritten. Owners add/edit contact details; existing sales staff permissions, shift/device checks, authoritative totals, confirmed stock, invoice uniqueness and original-request retries remain enforced.

The deployed Magpet layout has six main areas, with stock counts inside Inventory and supplier bills inside Purchasing. Customers & credit tracks money owed to the store; supplier accounts track the store's own debts and verified payments outside the sales drawer. Their roles and transaction rules remain separate. Historical supplier amounts awaiting payment reconciliation are excluded from recorded payable totals.

## Owner and cashier usability follow-up — November 4

The user approved all five priorities from the owner/usability review. Keep the established visual identity. Multiple-PC outage and shift labels explicitly state that checkout pauses offline. Inventory Needs review prioritizes selling-unit/price blockers, then stock, cost and owner questions; recorded stock breaks ties without certifying expiry or saleability. A selected product names its next check. This view does not confirm any business values automatically.

Credit checkout retains a confirmed-sale summary with the original invoice amounts, due date and booklet reference, direct 58 mm printing and New sale. The printed record is internal and does not replace the authorized manual VAT invoice. Matching original acknowledgements are required before pending credit requests settle; late callbacks are fenced from another account or basket. Confirmed balance means the balance at that checkout, with later payments in customer accounts.

Eligible catalog products expose weight and peso entry directly, with explicit Add-unit labels. Phone navigation has a labeled expandable menu, larger sale controls, and urgent owner attention before monetary summaries/chart. Real product measurements, costs, starting stock, historical due dates, individual staff onboarding and physical equipment acceptance still need verified owner/staff inputs.

Owner Inventory → Needs review distinguishes missing units/prices/costs and unposted source balances. Structured, branch-scoped import evidence is separate from usable stock. Unit confirmation never posts a balance; a separately reviewed current target posts only its difference with stock/version checks and a durable request ID. Price/cost changes append versions and preserve original activity; blank cost remains unconfirmed. Source notes do not authorize guessing a measurement or applying old stock automatically. See docs/workflow-cleanup.md for the workflow, release gates and data-preservation evidence.
