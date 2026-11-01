# AgriStore POS

Cash checkout and auditable inventory for a growing network of agricultural stores in the Philippines. One Windows cashier PC per branch, PHP currency, Asia/Manila time, and a 12-hour offline authorization window.

This is a development implementation. The real Windows restart test, an actual timed eight-hour outage, off-site production backups, and the one-branch operational pilot must be signed off before live store use. Simulated elapsed-time tests do not replace those checks.

## Open the application

Development preview: https://agristore-pos-staging-team-payaman2.vercel.app — Vercel authentication protects previews. Select **Try practice checkout** for a separate, local-only sample business. Practice transactions never upload to Supabase.

Use this stable staging address for browser-storage and update tests. Records saved under an older preview URL remain at that original browser origin; synchronize or export them there before moving to the stable address.

This installation is configured for **Magpet Branch only**, with branch creation/renaming and transfers unavailable. Sign in to the existing business; do not create a replacement business to bypass the restriction. The owner adds the catalog, imports independently verified opening stock once, registers the dedicated PC and assigns individual employee roles under Staff access. Open cashier shifts online. A maintainer can enable another branch only after owner acceptance of the Magpet pilot. See [the fixed setup](docs/single-branch-setup.md), [software verification](docs/magpet-pilot-verification.md) and [the actual-store test sheet](docs/magpet-store-test.md).

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

Without Docker or GitHub-hosted compute, `npm run test:db:preflight`, `npm run test:counts:local` (after an application build) and `npm run test:counts:restore` provide supplementary local PostgreSQL/count-component checks. They use simulated Auth and an ephemeral loopback fixture; they do not replace the complete Supabase/PostgREST/Auth/dump-restore gate. The [blind-count follow-up](docs/blind-counts.md) passed the full Supabase/Auth/restore gate on the [clean MIT source edition's free public runners](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40259205535) and is deployed to staging. The original business history, private deployment defaults and company artwork remain private. No paid settings were changed. See [the publication and verification boundary](docs/public-source-release.md).

## What is implemented

- Owner/assigned-manager [sales analytics](docs/sales-analytics.md): weekly/monthly/custom periods, comparisons, daily/weekly/monthly trends, complete CSVs and product popularity by distinct purchases or gross sales, with exact product units and separate refund/cash-recovery activity.
- Cash checkout, exact centavo calculations, sack/kilo conversions, batch selection, expiry checks, cash change, and printable sale records.
- Atomic local sale/outbox/stock accounting, unique checkout IDs, reload recovery, backoff, interrupted-upload recovery, authorization checks, and atomic snapshot reconciliation.
- Supabase Auth; organization and branch RLS; RPC-only mutations; current-session and device checks; immutable sales, payments, journal entries, and audit records.
- Products and price history, suppliers, delivery receiving, one-time opening-stock CSV import, dispatch/receipt transfers, physical counts, stale-count rejection, and owner-approved adjustments.
- Cash shifts, cash reconciliation, full owner-approved refunds, branch totals, stock-shortage and price-conflict reports, device synchronization monitoring, employee access, and PC retirement/replacement.
- Local recovery-file export/import; retained ambiguous online requests; explicit owner approval of recovered sales while preserving original cashier and transaction IDs.

AI, customer credit, electronic payments, marketing, full accounting, and official tax invoicing are excluded.

Receipt history loads 50 records at a time with **Load older receipts**. Refunds, recovered sales and PC retirement use explicit inline approvals with recorded reasons. Local recovery exports follow the current account/branch permissions; signing out clears cached account data while preserving unresolved transaction records. Application updates wait for the cart and every pending record to clear.

See the [overall review and improvement plan](docs/improvement-plan.md) for repaired bugs, measured scope and the remaining priorities.

Start the hardware/store handover with [your next test session](docs/next-test-session.md) and [what the owner needs to do next](docs/owner-next-steps.md). It includes a 200-purchase example with independently calculated cash and kilo totals. See [remaining release work](docs/remaining-work.md) for unpassed pilot gates and missing workflows, and [stock-control verification](docs/stock-control-verification.md) for current durability evidence.

See [loose weights and peso requests](docs/weighed-sales.md) for quarter/half kilos, grams, actual scale confirmation, distinct kilo/sack prices, sealed-piece configuration and counter rehearsal.

See [product selling setup](docs/product-setup.md) for pack sizes, opt-in loose selling, independent retail prices, sealed packets and measured liquids.

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

See [operations and recovery](docs/operations.md), [staff roles and branch responsibilities](docs/permissions.md), [acceptance evidence](docs/acceptance.md), and [source references](THIRD_PARTY_NOTICES.md).

See [measured lengths, liquids and pieces](docs/measured-units.md) for rope meters, the liter/ml checkout switch, real pack conversions and sealed items. See [correcting a mistaken refund](docs/refund-corrections.md) for full recovered-cash checks, untouched stock safeguards, preserved originals and linked replacements.

The [refund-correction and measured-unit verification](docs/refund-correction-verification.md) records the latest full gate and staging preservation checks.
