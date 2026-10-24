# Product selling setup

The owner chooses how each product is stocked and sold under **Inventory → Add a product**. Product prices and costs are entered in pesos; checkout records integer centavos. Creating a product requires connectivity and does not add stock. Receive or import verified opening stock separately.

| Setup | Stock measurement | Selling units |
|---|---|---|
| Sacks / bags | kg | Named sack/bag and its actual kg content. **Also sell loose kilos** is an explicit optional choice. |
| Loose kilos only | kg | One Kilo unit; cashier weight, gram and peso-budget controls. |
| Sealed item / packet / piece | piece | One named sealed item. A 500 mL sealed bottle is one Bottle, not a measured-liter product. |
| Measured liters | liter | One Liter unit, for products actually dispensed by volume. Quantity may be fractional. |
| Other pack or container size | kg, liter or piece | Explicit conversion and optional separate stock-unit retail price. |

Use the store's actual selling practices. A seed packet is counted as one sealed packet; loose seed sold by weight uses kg. The preset is not a recommendation to open or repackage a product.

For example, a **25 kg sack** sold for **₱900**, with loose sales at **₱45/kg**, has two independent prices. The POS must not infer the retail price by dividing ₱900 by 25. Enter the cost of each enabled unit as well; zero cost must be entered explicitly. Newly created selling prices must be positive. Leaving loose selling unchecked creates only the pack unit, rather than an unintended ₱0 loose unit.

The conversion summary shows exactly how much stock one selling unit represents before saving. Changing the selling setup clears the pricing fields so a sack price cannot silently become a packet or kilo price. A confirmed successful addition clears the form for the next product; a failed addition retains the entered values and shows feedback beside the form. Duplicate SKUs are refused by the server.

On Checkout, the normal **Add [selling unit]** action adds one configured unit. Eligible kg products also expose **By weight** and **By peso amount** directly on their catalog cards, beside the separate kilo price. Weight entry starts blank and moves focus to the quantity. Peso entry moves focus to the budget, estimates conservatively, and requires confirmation of actual scale weight. Unfinished blank entries do not contribute a provisional kilo to Amount due and block completion. Canceling a new peso entry removes that new line; canceling peso entry on an existing line restores its previous quantity and unit.

Existing product definitions and price versions are retained. This form creates new definitions; it does not silently add/remove units on existing products. Existing prices are changed through the separate owner price-version form. The server transaction contract and role restrictions remain authoritative. See [weighed-sales.md](weighed-sales.md) for the full cashier flow and physical-scale checks.
