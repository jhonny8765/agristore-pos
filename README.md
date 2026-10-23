# AgriStore POS

Cash checkout and auditable inventory for a growing network of agricultural stores in the Philippines. One Windows cashier PC per branch, PHP currency, Asia/Manila time, and a 12-hour offline authorization window.

This is a development implementation. The real Windows restart test, an actual timed eight-hour outage, off-site production backups, and the one-branch operational pilot must be signed off before live store use. Simulated elapsed-time tests do not replace those checks.

## Open the application

Development preview: https://agristore-pos-staging-team-payaman2.vercel.app — Vercel authentication protects previews. Select **Try practice checkout** for a separate, local-only sample business. Practice transactions never upload to Supabase.

Use this stable staging address for browser-storage and update tests. Records saved under an older preview URL remain at that original browser origin; synchronize or export them there before moving to the stable address.

For your real business: create and confirm your account, sign in, and create the business. This creates three starter branches. Under Settings → Branches, rename them and add as many additional branches as needed. Codes are assigned automatically, and interrupted creation requests can be retried from Sync center without duplicating a branch. Add the catalog, import each branch’s verified opening stock once, register its dedicated PC, and open a cashier shift. Employees create their own accounts; the owner assigns their role and branch under Staff access.

The selected Supabase project (`vbmnnouwmxcuibywdkjw`) is the staging database. Rollback-only SQL tests leave no test businesses or transactions in it. Create a separate production project before the pilot.

## Develop locally

Use Node 24, npm, and Docker Desktop with its Linux engine running.

```sh
npm ci
npm run db:start
cp .env.example apps/web/.env.local
npm run dev
```

For local database development, replace the public Supabase URL and publishable key in `apps/web/.env.local` with those reported by `npx supabase status`. Local ports are 55321 (API), 55322 (Postgres), and 55323 (Studio), avoiding other local projects. Never put a secret or service-role key in a `NEXT_PUBLIC_` variable.

```sh
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
npm run test:e2e
```

The browser tests use a production build at `http://127.0.0.1:3100`. Development mode intentionally does not install the service worker. Install Chromium for tests with `npx playwright install chromium`.

The database CI job also runs `npm run test:integration` against its disposable local Supabase stack. This builds the PWA with the stack's public API key and exercises real Auth, registered-PC user switching, offline checkout, a committed upload with a lost response, stock reconciliation, and employee revocation. The runner requires Linux CI and the exact loopback API; hosted projects are prohibited. It never passes administrative credentials to the application, and authenticated traces are disabled.

## What is implemented

- Cash checkout, exact centavo calculations, sack/kilo conversions, batch selection, expiry checks, cash change, and printable sale records.
- Atomic local sale/outbox/stock accounting, unique checkout IDs, reload recovery, backoff, interrupted-upload recovery, authorization checks, and atomic snapshot reconciliation.
- Supabase Auth; organization and branch RLS; RPC-only mutations; current-session and device checks; immutable sales, payments, journal entries, and audit records.
- Products and price history, suppliers, delivery receiving, one-time opening-stock CSV import, dispatch/receipt transfers, physical counts, stale-count rejection, and owner-approved adjustments.
- Cash shifts, cash reconciliation, full owner-approved refunds, branch totals, stock-shortage and price-conflict reports, device synchronization monitoring, employee access, and PC retirement/replacement.
- Local recovery-file export/import; retained ambiguous online requests; explicit owner approval of recovered sales while preserving original cashier and transaction IDs.

AI, customer credit, electronic payments, marketing, full accounting, and official tax invoicing are excluded.

Receipt history loads 50 records at a time with **Load older receipts**. Refunds, recovered sales and PC retirement use explicit inline approvals with recorded reasons. Local recovery exports follow the current account/branch permissions; signing out clears cached account data while preserving unresolved transaction records. Application updates wait for the cart and every pending record to clear.

See the [overall review and improvement plan](docs/improvement-plan.md) for repaired bugs, measured scope and the remaining priorities.

See the [owner accessibility review](docs/accessibility.md) for keyboard navigation, contrast, narrow-screen and forced-color coverage, plus the remaining checks on the actual cashier PC.

See [app updates and saved records](docs/app-updates.md) for guarded installation, reopening, multiple windows and offline recovery across downloaded versions.

Purchasing, transfer, count and audit registers offer branch-scoped older pages, Manila date ranges and CSV export of the loaded rows. See [finding and exporting older records](docs/reports.md) for scope and date meanings.

## Architecture and deployment

`apps/web` contains the Next.js PWA. `packages/domain` owns exact arithmetic and versioned sale contracts; `packages/offline` owns IndexedDB persistence and synchronization. `supabase/migrations` is the canonical schema history. The public API is `agri_command(action, data)`; privileged implementations stay in an unexposed private schema and independently authorize every command.

The checkout never displays success until its IndexedDB transaction commits. A server acknowledgment alone does not mark the local sale synchronized: its authoritative stock snapshot must also arrive. Sales use immutable IDs and JSON payload comparison, never content/time-window deduplication or mutable upserts.

Vercel project: `team-payaman2/agristore-pos`, root `apps/web`; install `cd ../.. && npm ci`; build `cd ../.. && npm run build`; Node 24. Workbox generation runs in Next’s post-compilation hook so Vercel’s adapter includes the offline assets. The cached HTML shell contains no server-rendered personal information.

`apps/web/vercel.json` ignores Git-triggered production builds until pilot approval. Previews remain available. Do not remove that gate until the deployment checklist passes. The connected Vercel account is Hobby; arrange a commercial hosting plan before live use. No paid plan was purchased by this implementation.

The preview was deployed with the authenticated Vercel CLI. Automatic Git deployments are not connected yet: Vercel requires this account's GitHub login connection. Add it under Vercel account settings, then connect `jhonny8765/agristore-pos` to the existing project. Until then, deploy previews from the repository root with `npx vercel deploy --yes --target preview --scope team-payaman2`. Keep the production gate in place.

After a preview is ready and its checks pass, move the staging alias with `npx vercel alias set <ready-preview-hostname> agristore-pos-staging-team-payaman2.vercel.app --scope team-payaman2`. This keeps the staging browser origin stable without promoting a production release.

Staging Auth URL settings are declared separately under `deploy/supabase/config.toml`; pushing the local development config would disable email confirmation, so never use the development config to configure the hosted project.

See [operations and recovery](docs/operations.md), [acceptance evidence](docs/acceptance.md), and [source references](THIRD_PARTY_NOTICES.md).
