# November 3 reference workspaces

The supplied screen designs are applied to the existing Better Yield POS, retaining the real logo, Manrope/DM Sans typography, Magpet-only business scope and original financial commands. Demo figures and product units from the pictures are not business data.

## What changed

- Checkout pairs product cards with the existing basket, cash/change and weighed-quantity controls. Verified catalog photos remain available offline; unverified photos keep an explicit fallback. Close shift remains directly accessible.
- Sales & receipts has search, Manila date/status filters, scoped loaded-record metrics, ten visible receipts per page and a selected original receipt detail with printing and the original authorized correction controls. Actions bind to full permanent UUIDs, including records sharing a short display prefix.
- Inventory has actual on-hand quantities, category/stock filters, ten-row registers and task tabs for expiry, controls, price history and setup. Price history reads up to 1,000 actual business price versions under existing database permissions; no price is changed by reading it.
- Purchasing has task tabs, compact order search and a selected-order detail. Each line retains its original selling unit, conversion and base-unit accepted/held/rejected/unreceived quantities. Unlike units are never summed into a misleading delivery total.
- Stock counts has a focused selected entry, checklist, workflow steps, search and ten-row worklist. Expected stock stays hidden until independent observations seal. Original third-person owner approval and online command boundaries remain.
- Overview uses the existing validated sales report with a responsive line chart and attention links. Exact trend tables/exports and existing reconciliation/audit records remain available. A report is sales activity, not profit or counted drawer cash.
- Settings groups the original forms into task tabs and gives direct branch/shift/recovery shortcuts. Storage status is read from the actual browser grant. Sync search/status filters affect the visible queue only; pending checks and exports still inspect full records.

## Held drafts

Hold sale saves one draft per PC/cashier/shift before clearing the basket. It does not reserve stock, post a sale or modify cash. Resume requires the same authorized scope and an empty basket. Draft items, raw weighed inputs and payment entry survive reload. Complete cash sale uses the original checkout persistence path. Before saving, the draft stores the complete original attempt; a cleanup failure after commit cannot resume it as a new charge. A remaining held draft blocks closing until completed or explicitly removed. Drafts are not included in completed-sale recovery exports, as the UI states.

## Verification

480 unit tests in 37 files passed, including Manila filters, exact full-ID correction bindings and durable held-draft behavior. Type checks, lint, production Next build and the configured Cloudflare archive build passed. The detector returned no findings. The independent design review requested three bounded readability fixes (phone money, order identity/conversion separation, phone chart labels); its verdict scored all three resolved and returned `ship` at that scope.

Browser coverage includes separate identical purchases, aborted saves retaining the basket/original ID, offline reload and a real browser process restart, authorization/lot expiry, underpayment, weighed/peso entry validation, 200 retained checkouts, 100,000 retained-history capacity, multipart recovery retry, explicit storage permission, support exports and closing safeguards. Eleven-receipt paging verified 11 unique complete records, 1,738,000 centavos due, 2,200,000 tender and 462,000 change; feeds stayed at 1,550 kg after eleven 50 kg sales from 2,100 kg. Hold/reload had zero sales and unchanged stock; completing once created one receipt and reduced feeds from 2,100 to 2,050 kg. A forced hold write failure preserved the basket. A forced cleanup delete failure retained one receipt and blocked a second charge.

The initial combined local run passed 38 of 40 cases. Two test-harness errors (Next hydration replacing an isolated fixture document and an ambiguous alert locator) were fixed and both passed on rerun; the post-review affected subset passed all 14 cases. The separate long-money phone case passed with intact 9,999,999.99 and 1,234,567.89 peso figures. Actual Practice desktop/phone screens and isolated real-component count/order/analytics fixtures were captured; Axe found no violations and no horizontal page overflow. Fixture data is explicitly TEST and never reaches business APIs.

## Scope and limits

No live business sale, refund, stock adjustment, purchasing command, catalog import or SQL migration was submitted for this redesign. Existing catalog/photo work is retained as a UI dependency. Import scripts and the pending catalog migration remain outside this release. Authenticated Supabase end-to-end mutation tests were not rerun because this PC has no Docker/disposable database runtime; existing service permission and financial command logic is retained. Those cases still need their disposable database environment, including navigation-selector updates for the new task tabs and selected detail layout. Physical printer, scales, staff procedures and production opening-data acceptance are not established by these UI checks. The settled November 2 endurance evidence remains separate.

## Release evidence

Released archive: **cf-mvztt182**, SHA-256 `ae641f2c99faf31c1d9e9afc26350dd0f306bf81711d4ac734bbc972eee5880a`, 117 files. Published November 3, 2026 to **https://better-yield-magpet-pos.pages.dev/**. Preview **https://reference-workspaces.better-yield-magpet-pos.pages.dev/** passed all **31** published Practice browser checks. Both preview and production health responses report this exact release with `status: ok`. The source commit is **11933a7**. Production smoke checks passed all **8** cases: closing navigation/guards, eleven-receipt cash/stock preservation, forced hold/cleanup failures, held-draft reload and one-time completion, receipt/settings filters, desktop/phone accessibility and response security headers. These tests used isolated Practice mode and created no business transactions. Prior live release **cf-mvzrdm7g** is preserved for rollback, with its exact archive and checksum under the private review directory.

After release, an already-open installed POS can receive the update through **Settings → Application & recovery → Check for app update**, after finishing the basket and checking unresolved records. Never clear site data.

The upload initially stopped at 3/117 prepared files. Read-only deployment-tab diagnostics identified HTTP 403, Cloudflare error 8000013 (`Authorization failed`) from the asset check. Renewing the same existing account sign-in through the ordinary UI resolved it; all 117 files then uploaded and the normal dashboard deployment succeeded. No permission grants, new persistent API credentials, security changes or API bypass was used. The exact same checksum-verified archive was uploaded to preview and production.
