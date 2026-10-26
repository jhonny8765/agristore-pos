# Better Yield stock-control routine

This guide describes the new staging stock-control workflows. Follow the release evidence in `docs/stock-control-verification.md` before using them with real inventory. Test records cannot explain the reported ₱170,000 discrepancy.

The [blind-count procedure](blind-counts.md) is now released to staging: two different counter accounts seal observations, then an owner who entered neither approves. The old typed-witness procedure cannot authorize new adjustments. Historical approved counts remain retained.

The [expiry and assigned-investigation procedure](expiry-and-investigations.md) is also released. At opening and closing, refresh Inventory, review expired/approaching/missing-date stock, and check overdue or unassigned cases. Owners/managers assign a named active employee and deadline; that employee records progress. A progress note keeps the case open. Only an owner resolution closes it, and physical stock changes still require their separate approved workflow.

## Establish a trustworthy starting point

Use named staff accounts. Keep the owner account private. Choose the real cashier PC, check the weighing scale and tare containers, and complete a witnessed opening count before importing stock. Count sealed sacks and loose contents separately, using net kilograms. Keep held goods physically separate and identify their product and lot.

For each unexplained difference, preserve the original sheets and delivery, sale, return and transfer documents. Record the count cutoff and any movements crossing it. Establish whether the reported value uses purchase cost or selling price. A shortage is evidence of a difference, not proof of theft.

## During the day

- **Checkout:** choose the right selling unit and lot. For loose goods, use weight or peso-amount entry and confirm the measured weight. Record every sale before goods leave. A saved offline sale stays pending until acknowledged; never enter it again as a new sale to force synchronization.
- **Supplier delivery:** count and inspect actual goods. Enter only accepted stock. When the supplier document differs, record its quantity and an explanation. Preserve the delivery reference and make the supplier claim separately. A fully rejected delivery and purchase-order matching still require a documented manual process.
- **Transfer:** dispatch the exact quantity and lot. The destination enters saleable and damaged/held quantities actually received. Missing goods remain outstanding. The owner investigates and explicitly records a transfer loss if established; this does not deduct the origin twice.
- **Return/refund:** the first release supports a full financial refund. Record actual returned quantities separately for every line. Hold uninspected goods. For a mixed return, enter the inspected saleable portion; the remainder stays held. Goods not physically returned do not reappear in stock. Partial financial refunds remain outside this flow.
- **Damage, spillage, expiry or internal use:** submit the actual quantity, category, physical disposition and evidence. The owner checks and approves it. A pending request alone does not change stock. Do not submit an issue and a count adjustment for the same physical shortage.
- **Held goods:** identify and segregate them physically. The owner records release, disposal or supplier return. Releasing increases saleable stock once; disposing held goods does not deduct saleable stock again. Expired lots cannot be released for sale.

Checkout checks the current lot again when saving, including across Manila midnight. An expiry or missing-lot error means that attempt was not saved: remove the item, check the physical lot and use the owner's stock-issue process where appropriate. Do not give out expired goods or change the PC clock to complete a sale. A previously completed sale keeps its original identity when uploading later; never re-enter it just because its lot has since expired.

Keep disputed supplier goods separate and documented until their final accepted quantity/disposition is established. The app does not replace supplier agreements or an inspection record.

## Close each branch

1. Synchronize all cashier sales and finish unresolved online operations. Investigate records requiring owner review; do not clear browser data to remove a warning.
2. Count drawer cash, compare it with the shift expectation, record differences and close every branch shift online.
3. Resolve pending physical stock movements before counting. Count saleable goods independently; exclude held goods and stock still in transit. Weigh loose goods using a checked scale.
4. Complete the blind first count and independent recount under two different stock-authorized accounts. Both entries seal before comparisons are revealed. A third person with owner access approves; an owner who entered either count cannot approve it. Disagreement requires investigation and a fresh count. All differences require the independent step in this release; typed witness names cannot replace sign-in.
5. Approve only a current count. Any intervening inventory movement requires a fresh count. Approval creates an adjustment and retains the discrepancy investigation; it does not establish the cause.
6. Review Inventory's open investigations, held goods and pending issues. Review transfers still in transit, overdue synchronization and unusual refunds/adjustments. Keep a separate assigned-person/due-date log until assignment and escalation are implemented in the app.

Rotate daily counts through valuable, fast-moving and loose products. Review recurring differences by product, lot, branch and supplier weekly. Reconcile the full inventory and unresolved cost-valued loss monthly. Avoid netting unrelated shortages and overages into one reassuring number.

## Protect the cashier records

Settings shows browser persistence and estimated browser usage. Persistence reduces automatic eviction; it does not protect against clearing site data, a failed drive or an unusable PC. It is distinct from Windows free disk space.

Export recovery files while unresolved records exist, keep every numbered part on a separate protected device, and repeat the export after later sales. Recovery exports prioritize unresolved transactions; confirmed history remains retained on the PC and server. Restore all parts, in any order, while online and signed in to the correct branch. Repeating a part is safe. Server acknowledgments are verified before restored records stop affecting local availability.

Keep the app open and connected until uploads finish. Updates must wait for the current checkout/cart and unresolved records to be protected. Never uninstall, clear browser storage or reset the PC as a synchronization fix.

Use one dedicated cashier window. A sign-out in any window sharing that browser profile also signs out the other windows and clears their temporary baskets; completed saved sales remain recoverable. Sign in to the correct store before uploading them. Late responses from an older stock download or signed-out session cannot replace the current cache. If a download reports that a newer request replaced it, refresh the current branch and check the existing queue rather than re-entering completed purchases.

## Release and maintenance responsibilities

The owner must name a daily reconciliation reviewer, a technical maintainer and a backup/recovery owner. Select a cloud recovery objective and test a real backup restoration. Review storage growth, failed uploads, persistent discrepancies and dependency/security updates regularly.

Before a real branch pilot, pass the actual Windows restart, real 60-minute outage, eight-hour storage stress, scale/printer and staff-rehearsal gates. Synthetic capacity and automated browser tests support these gates; they do not replace them. Expand only after daily cash and stock reconciliation succeeds at one branch.
