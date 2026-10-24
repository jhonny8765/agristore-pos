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
