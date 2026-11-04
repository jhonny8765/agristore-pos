# Owner and cashier usability — November 4, 2026

The user approved the five priorities from the owner review. This change preserves the Better Yield forest/paper design and existing database transaction/permission rules.

1. **Outage wording:** the actual branch/shift mode controls the header and shift authorization labels. Multiple-PC mode says **Offline · checkout paused**. Existing online confirmation enforcement stays in place.
2. **Owner preparation:** Inventory → Needs review prioritizes unit/price blockers, then starting stock, cost and owner questions. Search supports products sold today, each product names its next check, and less-used overlapping filters are disclosed. Recorded stock breaks ties; it does not certify saleability. No price, unit, cost, stock or due date is inferred or changed by this list.
3. **Credit completion:** the confirmed original request supplies the invoice summary, customer/booklet reference, cash paid, invoice balance and due date. Print credit record / Save PDF uses the existing 58 mm body-level receipt portal with all product lines and the original ID. New sale and customer account access remain beside the confirmation. This internal record is not an official VAT invoice. Later payments are visible in accounts, not retroactively applied to this original checkout summary.
4. **Loose selling:** Add names its configured unit; By weight and By peso amount are visible on eligible products. The existing blank-draft, retail-price and actual-scale confirmation rules are unchanged.
5. **Phone use:** the rail offers a labeled expandable menu that closes on selection, focus exit or Escape. Frequent sale controls are at least 44 px high. Urgent owner attention appears before the summary figures and chart, while full monetary amounts remain visible.

## Verification

- 603 unit tests passed, including exact credit acknowledgements, retained malformed responses, original-request retry and deterministic review priorities.
- Type checking, strict lint and the production Next.js build passed locally.
- 13 distinct focused browser scenarios passed across the initial and corrected runs: product review/posting/owner questions, credit retry, late rejected requests after leaving checkout, confirmed credit and print/new-sale, accessible credit entry, labeled phone navigation and control dimensions, weight entry, the owner reference layout, and ordinary/long cash receipt printing.
- Desktop, 390 px and 320 px confirmation layouts and the print output were inspected. Accessibility scans passed on the covered views. The original credit ID and all product lines printed even while the on-screen detail disclosure stayed closed. Cash receipt regressions still produced one 58 mm PDF page with exact discounts and change.
- Two independent source reviewers identified account-change and print-container concerns; the implementation fences stale callbacks and reuses the body print portal. A late rejected request test confirms that a newer basket attempt remains intact.
- The mechanical UI scan returned no findings on the changed components. No live business transactions or schema changes were performed for these checks. Full release verification uses the existing GitHub workflow and disposable test databases.

## Owner inputs remain necessary

The read-only review found pending unit, price and cost checks and historical opening invoices without confirmed due dates. The software now makes the work easier to prioritize; it does not establish the missing business facts. Confirm actual packs, conversions, prices, supplier costs and stock from evidence. Keep historical dates unknown when their original agreement is unavailable. Assign individual real staff accounts, then rehearse with the store's actual printer, scale and PCs before accepting the pilot.
