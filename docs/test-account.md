# Staging test business

The user explicitly designated this account for testing and authorized sample data. All sample catalog names/SKUs and receiving references carry a TEST label. Values are illustrative, not supplier quotations or verified business stock.

The three original branches are Magpet (B01), Kidapawan (B02), and Mlang (B03). The user approved Test Branch 4 and Test Branch 5 as temporary names. Owners can add and rename further branches under Settings → Branches; the application has no fixed three- or five-branch limit.

| Sample product | Selling units | Test price |
|---|---|---|
| TEST Grower Feeds / TEST-FEED-50 | 50 kg sack; kilo | ₱1,580 per sack; ₱35 per kilo |
| TEST Complete Fertilizer / TEST-FERT-50 | 50 kg sack; kilo | ₱1,250 per sack; ₱28 per kilo |
| TEST Vegetable Seeds / TEST-SEED-PKT | Packet, one base piece | ₱65 per packet |

Magpet received ten feed sacks, eight fertilizer sacks, and fifty seed packets. The seed lot is TEST-LOT-001, expiring 2027-12-31. Kidapawan received six feed sacks; Mlang received eight feed sacks. Test Branch 4 and Test Branch 5 each received five feed sacks. These are labelled test receiving records. The guarded one-time verified opening-stock import remains available for future real setup.

No production cashier PC has been chosen. During the October 23 staging review, the test browser was registered as a Magpet cashier PC and opened a ₱0 shift. One TEST feed sack was sold for ₱1,580 with ₱2,000 cash and ₱420 change (receipt `B01-A5ACCC76AE7A`), synchronized, and fully refunded through a linked reversal. Feeds returned to 500 kg. The shift reconciled and closed with ₱0 expected / ₱0 counted and no unconfirmed local sales. These durable test records remain in the audit trail.

A second ₱0 test shift verified one batch-tracked seed packet: ₱65 sale, ₱100 tendered, ₱35 change, receipt `B01-EBE680995C3A`. Its linked refund returned TEST-LOT-001 to 50 packets. The second shift also closed at ₱0 expected / ₱0 counted. No test shift remains open.

For another trial sale, select Magpet, open a test shift online, choose a sample product, enter the received cash, and complete the sale. Close the shift with the counted test cash afterward. This staging browser exercise does not satisfy the real Windows cashier-PC acceptance or production rollout gates.

## October 24 weighed-sale review

Receipt `B01-851E7BCBDBF7` contains three TEST Grower Feeds lines at the explicitly configured ₱35/kg: 0.25 kg / ₱8.75, 0.5 kg / ₱17.50, and 1.43 kg / ₱50.05. The last line began as a ₱50 request (estimate 1.428 kg / ₱49.98); its entered scale reading was 1,430 g, with the above-budget difference shown before confirmation. Total ₱76.30, cash ₱100, change ₱23.70. The local and server stock both became 497.82 kg; PostgreSQL retained exactly the three fractional deductions.

The linked full refund restored feeds to **500 kg**, and the new test shift closed at **₱0 expected / ₱0 counted**. All three original receipts remain retained and synchronized. A server check confirmed zero open shifts after this test.

The long-lived browser initially held a retired registration. The new owner-only Release retired setup action released that matching local identity without clearing its two older saved receipts. A separate older active staging registration had an empty shift with a one-centavo test opening float and no sales/payments. It was retired through the existing owner approval/reason flow, preserving its historical expected cash and a null counted-cash value for review. The replacement test browser was then registered normally. No cashier hardware has been selected by these browser setup tests.


## October 24 inventory-recovery rehearsal

The signed-in staging owner recorded **0.25 kg** of TEST Grower Feeds using reference **TEST-RECOVERY-AUDIT-20261024-001**, receipt **1079646b-9a2f-4f8e-8d39-5be4ecba1ced**. Stock increased from 500 kg to 500.25 kg and the confirmed delivery form cleared. A simulated count **56fad55e-7ee7-49ff-a024-0d314902b304** recorded expected 500.25 kg / counted 500 kg; the owner approval created the separate **−0.25 kg** adjustment and restored **500 kg**. Its retained reason explicitly says “TEST SIMULATION ONLY” and identifies it as a software rehearsal rather than a real physical count. Both original records remain in the audit trail.

No cashier shift was opened and no new cash sale was created. Independent reads confirmed the original three retained sales, zero open shifts, 500 kg feeds / 400 kg fertilizer / 50 seed pieces in Magpet. The invalid duplicate-header CSV was rejected before import confirmation and did not create an opening import. The existing browser's guarded update preserved the account and local receipt history.

## October 24 lot-history follow-up

This pass used the existing approved count above for deployed visual and CSV checks. Its register now labels kg, no recorded lot and the original reason. The exported difference is numeric −0.25. Separate two-lot transfer/count operations ran only in disposable CI fixtures; no hosted stock, sale, product, transfer, count or shift was added. Server reads again confirmed five branches, three products, three original sales, zero open shifts and unchanged 500/400/50 Magpet balances. Both guarded updates retained the three synced local receipts. The user tab was left signed in at Checkout with an empty basket; temporary review tabs were closed and viewport overrides reset.

## October 25 permission and precision follow-up

No hosted employee, role, stock, count, transfer, product, shift or sale was added or changed for the new tests. Role assignments and deliberately large synthetic balances ran only in the disposable CI database. The current staging owner applied the guarded update, read/exported the existing approved count and retained all three original local receipts as Synced. The count's exported expected/counted values retain six decimal places, with numeric −0.25 difference. Five branches, three products, three sales, no open shifts and baseline 500/400/50 Magpet stock were verified. The existing owner tab remains at Checkout with an empty basket.

## October 25 hands-on cashier rehearsal

The [cashier browser rehearsal](cashier-rehearsal.md) created four local-only practice sales on the prior preview origin and one after fixing the invalid-draft price display on the new preview origin. Each origin's saved practice receipts survived reload; none upload to this hosted test business. Those practice tabs remain available with their receipt lists, and no saved records were deleted.

Stable staging now serves application `e84f3fa` from `agristore-p2jt6wgqr-team-payaman2.vercel.app`, deployment `dpl_FBEmpkh2T6hKY1aLc8JehzUTVj7L`. The original owner tab updated through Settings, reopened at Checkout and retained all five branches, the three original Synced receipts and a clear queue. It displays 500 kg feeds / 400 kg fertilizer / 50 seed packets, no open shift and an empty basket. No hosted business mutation or site-data clearing was needed. Temporary viewport overrides were reset.

### Later signed-in account rehearsal

At the user's request, the existing signed-in owner session was exercised beyond practice mode. The matching retired browser setup was released through the existing owner recovery control; a replacement registered and opened a ₱0 shift. A mixed test sale of 0.5 kg feeds, 0.25 kg fertilizer and one TEST-LOT-001 seed packet totaled ₱89.50, with ₱100 simulated cash and ₱10.50 change. Add/increase/decrease/remove, invalid decimal entry and insufficient cash were exercised before completion.

Receipt **B01-D1B4A824B132** synchronized and survived reload. Independent database reads verified one payment and three exact stock deductions. Full linked reversal **58e4745b-6547-45c0-966e-adccbcd07dbe** restored all stock, and shift **fec371e8-6bb4-40f8-92cc-7f03ab3a2187** closed with ₱0 expected / ₱0 counted. The latest baseline is now **four retained, fully reversed sales**, no open shifts and **500 kg feeds / 400 kg fertilizer / 50 seed packets**. All four local receipts are Synced. The replacement test-browser registration remains active for future staging work; no production hardware was selected. See the [full signed-in rehearsal evidence](cashier-rehearsal.md#signed-in-staging-account-follow-up).
