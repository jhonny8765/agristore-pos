# Owner inventory: edit product details (draft)

## What the owner can do

1. Open **Inventory → Edit product** or use the **Edit** shortcut beside an item.
2. Search for a product. The detail panel contains:
   - Product name
   - SKU / barcode
   - Category
   - Low-stock alert threshold in the product's base unit
   - Existing price and cost version form
3. Enter a reason, confirm the correction, then save. The form explains that history stays intact.
4. Refresh the product if another owner changed it in the meantime. The server rejects stale values.

Owner-only controls are also visible for **Add product** and **Add stock** (stock is received through the existing auditable receipt process). Narrow screens stack the form fields and buttons.

## Safety boundaries

- `public.agri_command('update_product_metadata', data)` routes to `app_private.update_product_metadata`.
- The SECURITY DEFINER function checks authenticated, active owner membership; a live authorized branch; a unique request ID; the expected old values; a reason; and explicit confirmation.
- Only `products.name`, `products.sku`, `products.category`, and `products.minimum_stock` may change.
- Product IDs, base units, units, prices, stock balances, and historical sales remain untouched.
- Changes are recorded with before/after values and the owner reason in `audit_events` and as an idempotent command in `stock_control_events`.
- The function is not exposed as a direct table update API. Existing product RLS remains enabled.
- Case-insensitive duplicate SKUs within the business are rejected.

## Deployment order and verification

**This branch is a draft, not production.** The database migration must be reviewed, tested in a disposable local or staging database, and applied **before** shipping the UI. Applying only the frontend will make the new save action fail.

Local verification with a disposable Supabase database:

```sh
npm ci
npm run typecheck
npm run lint
npm test -- tests/unit/product-metadata-edit.spec.ts tests/unit/inventory-owner-shortcuts.spec.ts
npm run build
supabase start
supabase db reset
npm run test:db
```

Then exercise:
- Active owner edits each field, receives a success message, and sees the updated product on refresh.
- Cashier/manager cannot invoke the command, including through a forged direct API request.
- Duplicate SKU, malformed data, concurrent edit (stale expected values), missing confirmation, and reused request IDs with different payload are rejected.
- Idempotent retry of the same request returns `duplicate: true` without a second audit.
- Stock ledger, price versions, and old sale amounts remain unchanged.
- Mobile viewport: form labels, fields, submit/reset actions, and validation messages stay usable.

### Change log

2026-11-10: Added owner product metadata editor, command validation and audit, responsive styling, and unit validation tests. Still awaiting staging database integration and CI confirmation.
