# Owner inventory controls

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

## Hide and restore products

Open a product, then choose **Hide this product**. Enter its exact SKU, a reason and confirmation. Hiding is reversible and preserves prices and historical records. Recorded stock must be zero first; unresolved imported stock, holds, stock issues, counts, transfers and purchase orders must be resolved through their existing workflows.

Use **Inventory → Hidden products / Restore** to find a hidden product and restore it with a reason. Only items hidden through this workflow appear here. Products retired by an inventory source rebuild are excluded. Restoring preserves the original product ID, units, prices and setup warnings. It does not add stock or clear unresolved setup.

Use **Stock** to record an actual delivery through Quick receipt. Use **Count** to correct an existing stock balance through the established count and owner approval process. Add stock is disabled for products whose selling units are still unconfirmed.

## Deployment order and verification

**This branch is a draft, not production.** The database migration must be reviewed, tested in a disposable local or staging database, and applied **before** shipping the UI. Applying only the frontend will make the new save action fail.

Local verification with a disposable Supabase database:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:owner-inventory
npm run test:db:preflight
npm run build:cloudflare -- --practice
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

2026-11-10: Reused the inventory controls from draft PRs #12–14, without the unrelated sign-in and recovery changes. Added Restore, a private owner-hidden catalog, safeguards for private blind counts and open purchasing, live-session checks, full-schema PostgreSQL assertions, and browser coverage for editing, pricing, hiding and restoring. The migration is `20261110075227_owner_inventory_controls.sql`; apply it before publishing the frontend, after the complete release gate passes. GitHub currently reports an account billing/spending-limit restriction that prevents hosted jobs from starting. No production inventory data is changed by this branch.
