# Cashier browser rehearsal — October 25, 2026

The agent operated the POS through this PC's in-app browser: clicking products, typing quantities, correcting mistakes, receiving simulated cash and checking saved records. All sales below are labelled practice transactions stored locally on their own preview origins. They never upload or change hosted store stock. This is browser rehearsal evidence, not an installed Edge PWA, physical scale/printer, Windows restart or timed-outage test.

## Basket and payment checks

On `agristore-fiqygi8mk-team-payaman2.vercel.app` (application `517e14e`), adding a sprayer, increasing it to two, decreasing to one, adding a feed sack and removing both left an empty basket with ₱0 due. Cancelled items did not deduct stock.

| Completed practice sale | Cash | Change | Visible local record prefix |
|---|---|---|---|
| 0.5 kg Grower feeds at ₱33.60/kg + ¼ kg compost at ₱14.80/kg + one ₱145 vitamin sachet = **₱165.50** | ₱200 | ₱34.50 | `e9fc1474` |
| ₱50 feed request: estimate 1.488 kg / ₱50.00; entered actual 1,500 g / **₱50.40**, explicitly confirmed after the above-budget warning | ₱100 | ₱49.60 | `905ead45` |
| ¼ kg feed = **₱8.40** | ₱10 | ₱1.60 | `7d2f90f1` |
| Separate identical ¼ kg feed purchase = **₱8.40** | ₱10 | ₱1.60 | `7616eb5d` |

The first basket rejected ₱100 as insufficient cash without saving a sale. The peso estimate could not be completed before weighed confirmation. Both kg and grams entry were exercised, and the compost fraction was typed as `1/4` before normalization to `0.25`.

After a page reload, all four records remained visible. The two identical purchases retained distinct identifiers. Feed stock was **2,097.5 kg**, compost **599.75 kg**, vitamins **119 sachets** and sprayers **18 pieces**, matching the completed purchases and leaving removed sprayers unchanged. The four records remain on that original preview origin; they were not moved or deleted.

## Bug found and corrected

Typing the intermediate draft `0.` correctly blocked checkout but still displayed the previous valid quantity's price and kg/gram conversion. The cashier could therefore see a misleading amount while correcting the weight.

Application `e84f3fa`, preview `agristore-p2jt6wgqr-team-payaman2.vercel.app`, derives displayed pricing from the current editable draft. Invalid or mismatched drafts show **Enter weight** or **Enter quantity**, hide the stale conversion, and contribute no amount. Other valid lines remain priced. This does not turn an incomplete basket into a payable sale: checkout remains blocked. A valid peso estimate still shows its price while requiring actual weighed confirmation.

Manual retesting on this new, separate origin verified:

- Typing `0.` from a blank loose-weight line shows no provisional amount or stale conversion. Completing it to `0.5` restores ₱16.80 and the 500 g hint.
- With one valid vitamin sachet in the basket, changing feed to `0.` leaves **₱145** due and blocks checkout.
- Entering `0.5` for a sealed sachet shows **Enter quantity**, retains only the valid **₱16.80** feed amount and blocks checkout. Restoring a whole sachet returns **₱161.80**.
- Completing that corrected basket with ₱200 saves **₱38.20 change**. Reload retains local practice record `f516db5f`, ₱161.80 / ₱200 / ₱38.20.
- A fresh ₱50 estimate still shows **1.488 kg / ₱50.00** and remains blocked until weighed confirmation. The later unfinished test basket was removed without creating another sale.

The corrected state was inspected at the user's 1280px width, 1440px desktop and 390px narrow width, including the mobile receipt shortcut and payment area. Temporary viewport overrides were reset. Unmodified browser screenshots are retained locally under `.impeccable/review/cashier-*`; those files are review evidence, not shipped product assets.

## Automated regression evidence and remaining gates

[GitHub Actions 40115606676](https://github.com/jhonny8765/agristore-pos/actions/runs/40115606676), source `e84f3fa`, passed **136 unit tests, 17 practice-browser scenarios, 12 real database-connected scenarios, 98 pgTAP assertions and the restore drill**, plus type checks, zero-warning lint and optimized builds. The new browser case checks invalid kg/gram/fraction and sealed-piece drafts, preservation of other valid line totals, cash rejection, restored checkout and a priced but unconfirmed peso estimate. Ten unit cases cover the draft/pricing boundary, including valid zero-price items.

The intended cashier PC still needs Edge installation, actual Windows restart recovery, real one-hour/eight-hour outages, storage-pressure checks, scale/printer checks and staff cash/stock reconciliation with verified opening stock. No physical cash, real goods or production records were involved in this rehearsal.

## Signed-in staging account follow-up

The user requested testing in their account. The existing owner session was still signed in, so no supplied credential was entered, stored in the repository or used to open another service.

Opening a shift first returned **This device is registered elsewhere or disabled**. The existing owner recovery action released the matching retired registration (last sync October 24, 7:22 AM) while retaining the three historical local receipts. Opening a zero-cash shift then registered the replacement browser successfully. This is test-browser registration, not selection or acceptance of the production cashier PC. Its active registration remains available for further staging rehearsal.

The agent typed `0.` then `0.5` for TEST Grower Feeds, verifying the invalid draft stayed unpriced and blocked. It typed `1/4` for TEST Complete Fertilizer, added a TEST Vegetable Seeds packet, increased the packet to two, decreased to one, removed it and added it again. The selected seed batch remained **TEST-LOT-001**, expiry **2027-12-31**. The final basket was **₱89.50**: 0.5 kg feeds / ₱17.50, 0.25 kg fertilizer / ₱7.00, and one seed packet / ₱65.00. ₱50 was rejected; simulated ₱100 completed with **₱10.50 change**.

Receipt **B01-D1B4A824B132**, transaction `d1b4a824-b132-4474-ba8c-0fdf2455dcbf`, synchronized and survived a page reload. Independent database reads confirmed exactly one payment of 8,950 centavos and three sale movements of −0.5 kg, −0.25 kg and −1 seed piece, with the selected batch retained. Stock became **499.5 kg feeds / 399.75 kg fertilizer / 49 seed packets**.

The online full refund used reason **TEST SIMULATION ONLY**, explicitly documenting no real cash or goods. Linked reversal `58e4745b-6547-45c0-966e-adccbcd07dbe` preserved the original sale, added a −8,950-centavo payment and exactly reversed all three stock movements. Shift `fec371e8-6bb4-40f8-92cc-7f03ab3a2187` closed at **₱0 opening / ₱0 expected / ₱0 counted**.

Final independent reads confirmed **four retained sales, zero open shifts and restored 500 kg feeds / 400 kg fertilizer / 50 seed packets**. Sync center showed all four local receipts as Synced with a clear queue. No records or site data were deleted. Screenshots `cashier-account-synced-sale.jpg`, `cashier-account-refunded.jpg` and `cashier-account-shift-closed.jpg` retain the actual browser results in `.impeccable/review/`. The account was left signed in at Checkout with an empty basket. This follow-up changes the earlier three-sale baseline by adding one retained, fully reversed test sale; it does not alter the physical hardware gates.
