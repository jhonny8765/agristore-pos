# Five-per-product store test setup

On November 3 the user renewed the previously cancelled instruction to give every active product five on hand for testing. The earlier cancelled attempt made no stock changes. This authorized setup sets the balance to exactly five, rather than blindly adding five to existing negative balances.

All 984 active Magpet products currently have a configured base measurement of piece and a selling conversion of one. None has an active lot or mandatory-expiry configuration. The one-time operation appended 984 stock adjustments through the normal journal projection trigger. Existing zero balances received five; Sungkit lubi and Bayna moved from minus one to five through adjustments of six. Total active on-hand quantity is 4,920 configured stock units.

The journal/audit reference is `6c533ddb-607c-414a-b499-3e6d96e5c258`. Its audit reason explicitly records the user's TEST setup and states that no physical stock count was verified. No staff observations, approved physical counts, purchase receipts, sales or payments were manufactured. No trigger was disabled and no historical movement was edited or removed.

A fresh consistent backup and server fingerprints were saved privately under `outputs/stock-five-20261103/authorized-before.json`. The reviewed SQL refuses a changed baseline, an open shift, held/in-transit goods or a repeated execution. A rollback rehearsal passed before the atomic committed operation. Independent fresh readback confirms all 984 quantities are exactly five, total 4,920, and the complete journal matches the stock projection. Products, selling units, prices, batches, staff, branches, existing movements and all other-branch/inactive-product stock remain unchanged. Sales and payments remain zero.

The owner's Inventory screen was refreshed and visibly shows five per item, 984 catalog products and zero low-stock products. The screenshot is retained privately as `stock-five-live-inventory.png`. Existing pending price/unit/cost review flags were preserved; test quantities do not certify those configurations or physical opening stock. These artificial balances must be reconciled before real trading.
