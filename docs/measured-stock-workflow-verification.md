# Measured purchasing, transfers and counts: verification

October 27, 2026. Staging software evidence. This does not certify a physical measurement, a particular Windows PC, prolonged hardware use or an actual production cloud backup.

## Delivered controls

Purchase-order quantities, all four delivery-inspection quantities and quick receipt/document quantities accept the configured unit, meters for meter-based rolls and ml/liters for liter-based containers. Each field displays its exact recorded unit and stock equivalent. Transfer dispatch, saleable/held receipt, investigated missing quantities and both sealed count observations use the same conversion helper. Commands retain their original unit/base-unit contracts; no migration, grant or privileged browser key was added.

Exact decimal conversion refuses nonrepresentable fractions rather than rounding stock. Product/order-line changes clear old measured drafts; successful quick receipts reset quantity and entry unit together. Unchanged-unit labels remain compatible with existing cashier and stock workflows. Whole-piece products reject fractional pieces, and rope has no ml option. The first counter's conversion preview describes only that person's typed quantity; it does not reveal expected stock or another person's sealed quantity. Independent recount and third-person owner approval remain mandatory.

## Passing software gate

The complete [free public-source gate](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40487038202) passed on public source **482cc3e**, corresponding to private source **157b24a**. Results: **240 unit tests, 22 practice-browser tests, 36 genuine Supabase Auth/database browser scenarios, 664 pgTAP assertions in 13 files**, strict warning-failing database lint, type checks, warning-free application lint, and optimized builds. Private local type/lint/build and unit tests passed; supplementary PGlite preflight passed the same 664 database assertions. Its Auth doubles supplement the genuine Supabase gate.

The 21 new unit cases cover exact ml/container/roll conversions, quarter quantities, zero/nonnegative rules, six-decimal limits, unsupported units, nonterminating fractions, whole-piece rejection and repeated unit switching without drift. The 30 new pgTAP assertions verify order/inspection, partial transfer/held/shortage accounting, original-ID retries, independent counts and ledger/projection equality. Fixture expectations were aligned with the established ledger: inspected held goods have their own movement, transfer holds link to receipt IDs, and an investigated short transfer finishes as `closed_short`. No existing server rule was weakened.

The two new genuine browser scenarios:

1. Request and approve 200 meters as two 100 m rolls and 3000 ml as six 500 ml containers. Inspect rope as 100 m accepted, 12.5 m held and 12.5 m rejected; liquid as 2000 ml accepted, 500 ml held and 500 ml rejected. Only 100 m and 2 liters become saleable. Dispatch 12.75 m and 375 ml; source becomes 87.25 m and 1.625 liters. Destination receives 12.25 m/250 ml saleable and 0.25 m/100 ml held. Owner-investigated shortages of 0.25 m/25 ml close the transfers without a second source deduction. Two independent counters and a third-person owner then approve 12.125 m and 245 ml: destination saleable quantities become exactly 12.125 m and 0.245 liter, while held goods stay separate. No payment is created.
2. Commit a 125 ml quick receipt against a 500 ml container and deliberately lose its response. The actual recovery export retains canonical quantity 0.25 container and document quantity 0.5 container for 250 ml. Restore the file in a fresh signed-in browser and retry its original ID: stock is exactly 0.125 liter once. Retrying on the first PC also produces no second effect. A separate real test receipt adds another 125 ml, giving 0.25 liter; the form resets correctly.

The genuine UI test checks purchasing containment and accessibility at **1440, 390 and 320 px**, with no targeted WCAG A/AA findings. All older checkout/offline/recovery, purchasing, transfer, blind-count, reversal and refund tests also pass. These are software scenarios with disposable test data, not staged customer transactions.

## Backup and interface checks

The real disposable **40-table pg_dump/pg_restore drill** now also retains meter/liter orders, mixed inspections, held stock, partial receipts, outstanding in-transit goods and two sealed independent observations. After restoration, retries preserve the original effects; the third owner can approve the saved count and resolve transfer shortages, and another independent meter count completes. All retained table fingerprints match, immutable evidence remains immutable, and there are zero ledger/projection differences. It does not certify a configured cloud backup.

Manual browser review used the production purchasing component, local TEST rope/liquid products and an API that rejects save actions. Desktop, 390 px and 320 px views fit without page overflow and show readable exact equivalents. Proofs: `.impeccable/review/measured-stock-desktop.png` and `measured-stock-mobile.png`. The bounded interface detector returned no findings; the existing forest/paper design was retained.

## Staging and preservation

Preview **agristore-hmpwmt1yg-team-payaman2.vercel.app**, deployment **dpl_6kHL6qLvg3Hdxme9Mo3cMUknZM7b**, was inspected **Preview / Ready** in `team-payaman2/agristore-pos`, then assigned the [stable staging address](https://agristore-pos-staging-team-payaman2.vercel.app/) after the complete gate passed. The existing authorized Vercel CLI was used because the connector's team scope was unavailable. No production promotion, billing change, paid runner, database migration or hosted stock transaction was performed.

Before updating the signed-in browser, the basket and local queue were clear and no branch shift was open. Settings' guarded update downloaded the tested shell and reopened the app. Purchasing, Transfers and Stock counts loaded. Half a seed packet produced the whole-piece error; an unsaved quarter-sack entry displayed exactly 12.5 kg. Both drafts were cleared. The current hosted catalog has no meter/liter product; populated measured save paths were exercised in the isolated real-stack tests instead of inventing hosted stock. Staging proof: `.impeccable/review/measured-stock-staging.png`.

All **40 table fingerprints matched before and after the signed-in interface review**. Existing counts still match the task-start readback: 4 sales, 8 payments, 8 receipts, 7 stock rows, 27 inventory movements and 38 audit events. Existing net payments remain zero, shifts open remain zero, and ledger/projection differences remain zero. No supplier, order, transfer, blind count, refund correction or new product was created in hosted staging.

Advisor readback: 12 intentional private default-deny RLS INFO findings and the existing leaked-password-protection warning; 47 uncovered-foreign-key INFO findings and 33 unused-index INFO findings. No schema or authorization change was introduced by this release.

## Store handover

Follow [the step-by-step measured stock guide](measured-units.md#purchase-transfer-and-count-using-meters-or-ml). On the chosen cashier PC, rehearse with labelled test goods: verify a real roll length and container factor, inspect accepted/held/rejected quantities, dispatch and separately receive measured goods, then use two independent employees and a third-person owner for a count. Write the expected quantities separately and compare physical goods with the ledger. The PC is still unchosen; persistent browser storage, actual outage/Windows restart, measuring equipment, daily reconciliation and production backup/pilot gates remain open.
