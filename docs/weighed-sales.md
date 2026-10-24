# Loose products and peso requests

The owner confirmed that customers ask for both weight and a peso amount. This counter flow is part of the first release. All example prices here are synthetic staging values, not Better Yield quotations.

## Sell a requested weight

1. Add the product to the receipt. Choose **Kilo**, or use **¼ kg**, **½ kg**, **¾ kg** or **1 kg**. These shortcuts select the configured kilo selling unit and its retail price.
2. Type a weight such as `0.5`, `.5` or `1/4`. Alternatively change the weight-entry selector to **g** and enter the scale reading, such as `250`.
3. Check the quantity, unit, batch where applicable, amount due and cash received before completing the sale.

The cashier can type an unfinished `0.` without the field snapping back to the previous quantity. Checkout stays blocked until the entry becomes valid. Decrease never removes a fractional line; use its explicit Remove button. Switching selling units resets the quantity to one of the newly selected unit, so a fraction of a kilo cannot silently become a fraction of a sack.

Bulk stock on product tiles is shown in exact base kg or liters and includes every lot. Selling ¼ kg from 500 kg shows **499.75 kg**, instead of rounding 9.995 sacks back to “10 sacks.” The sale price beside the product still states its configured selling unit. Whole piece packs keep their pack name where the stock divides into complete packs; otherwise the remaining base pieces are shown. None of these figures claim that the warehouse contains a particular number of unopened bags.

## Sell a requested peso amount

1. Select **By peso amount** on a product with a configured kilo unit.
2. Enter the customer's budget and select **Estimate weight**. This is a conservative whole-gram suggestion using the retail kilo price.
3. Weigh the goods. Enter the **actual scale reading**, in kg or g, in the quantity field above. The estimate does not replace measurement or claim a particular scale accuracy.
4. Check the final price. If it exceeds the requested budget, reduce the weight or agree the final amount with the customer. Select **Confirm weighed amount**, receive cash and complete the sale.

At the staging price of ₱35/kg, ₱50 suggests 1.428 kg and ₱49.98. An actual reading of 1.430 kg costs ₱50.05. The POS shows that difference; it does not change the retail price or invent a discount to force an exact budget. Peso entry can be canceled to restore the original receipt line. An unconfirmed estimate blocks checkout even after leaving Checkout and returning.

The quantity, unit, conversion factor, batch, recorded unit price and centavo-rounded amount enter the same existing immutable sale contract. Completed fractional sales receive the same offline persistence, permanent transaction ID, sync/retry and linked-refund handling as whole-unit sales. The budget is a temporary cashier aid, not a second price or saved customer record. Uncompleted basket drafts survive navigation within the running app; they are temporary and are not promised to survive closing or reloading it. Completed sales are saved before success appears.

## Configure products to match the goods

| Goods and owner decision | Configuration and counter behavior |
|---|---|
| Products the store sells loose by weight | Base stock in kg; a factor-1 Kilo selling unit with its own retail price; optional explicitly configured 25/50 kg bag or sack units. Opening stock, receiving, sales and counts refer to the same base stock. |
| Sealed packets, bottles, sachets or tools sold as complete units | Base stock in pieces; selling units convert to whole pieces. A fractional piece is rejected. Do not configure a sealed item as loose kg merely to permit decimal input. |
| Products actually sold by volume | Base stock in liters with explicit product units. Existing decimal unit entry applies. This release's gram shortcuts and peso-weight estimator apply to kg products only. |
| Batch-tracked or expiring products | Configure the actual lot and expiry. Select the appropriate batch at sale/receiving. Existing expired-batch checks apply to fractional sales too. |

Do not derive loose retail price by dividing the sack price. Do not use a loose-goods workflow as an instruction to open, divide or relabel sealed products: the owner must confirm which goods are actually sold loose and how they are packaged.

## Counter rehearsal and remaining decisions

Use the staging account's labelled stock to rehearse a full sack plus ¼ kg and ½ kg, a ₱50 request, a customer changing the requested amount, insufficient cash, removing one of two identical products, and a refund after synchronization. Compare scale reading, printed sale record, drawer cash and base-unit stock.

Before the pilot, the owner must provide the real product list, saleable units, pack sizes, separate loose/pack prices, batches, expiration dates and verified stock. Confirm scale increments and receipt-printer needs on the chosen cashier PC. Direct scale integration and hardware rounding policies have not been implemented. Actual Windows restart and timed-outage acceptance remain in [the pilot checklist](pilot-checklist.md).

The hosted test receipt `B01-851E7BCBDBF7` verified quarter/half kilos and a 1,430 g actual reading for a ₱50 request: ₱76.30 total, ₱100 cash, ₱23.70 change, 497.82 kg remaining. Its linked refund restored 500 kg and its test shift reconciled at zero. See [the test-account record](test-account.md) for the retained receipt and PC setup history.

Business context comes from the owner's supplied [Better Yield public profile](https://www.facebook.com/profile.php?id=100054562864276), which describes crop nutrition and crop care products/services. Public marketing locations and posts are context only; they do not replace the owner's confirmed Magpet, Kidapawan, Mlang and two temporarily named branches, or establish real catalog prices and stock.
