# Better Yield production releases

The private GitHub repository `jhonny8765/agristore-pos` is the source of truth.
GitHub Actions publishes to the existing Direct Upload project `betteryieldpos`, at
`https://better-yield-magpet-pos.pages.dev`. Do not recreate it or replace the domain.

Cloudflare account: `b7f2cf5b5c6cd82599ac2317cf7b7968`.
Supabase project: `vbmnnouwmxcuibywdkjw` in organization `wswgckuzbvppmstwfbej`.

## Release flow

1. Push work to a feature branch and open a pull request against main.
2. Shared verification runs application/unit/browser checks, dependency audits,
   disposable database tests, an isolated restore rehearsal and ordinary plus fixed-Magpet
   integration tests. Tests receive no live business credentials.
3. Merge verified changes into main. Production repeats the gates, builds with the existing
   live Supabase public URL/key and publishes the checked commit to the same Pages project.
4. The publisher checks the live health release, served HTML hash and public release identity.
   If verification fails after its own deployment, it restores the previous successful
   deployment. It refuses to overwrite an intervening unrelated deployment.

Production runs are serialized. An old queued commit cannot publish after main advances.
Checked, built and current main commits must agree and descend from the previously hosted
inventory release `74cdddf`. Feature branches never publish production.

The private repository's current GitHub plan does not support enforced branch protection.
Deployment gates are enforced by workflow code; maintainers can still edit that code.
Keep deployment secrets away from pull requests and review changes to workflows.

## Owner-authorized manual release

On November 10, 2026, the owner explicitly requested publishing directly after the completed local checks, without waiting for the GitHub Actions billing restriction. This authorizes a manual Direct Upload to the existing Pages project for the owner inventory update. It does not disable future verification workflows.

Keep the ordinary release identity rules: merge the reviewed PR into main, apply and verify the matching database migration, build that exact clean main commit against the existing public backend, and retain the prior healthy deployment. A project-scoped short-lived upload token may upload assets through Wrangler; the connected Cloudflare API creates the deployment with its manifest, worker, headers and routes. Check the live health release, served HTML hash, backend and migration identity. Roll back only this deployment if verification fails, without overwriting an intervening release.

The owner inventory release has passed the recorded local checks in `docs/owner-product-editing.md`. Hosted Supabase Auth/PostgREST and Magpet integration remain unexecuted while the GitHub restriction persists. Preserve this distinction in release evidence.

The owner subsequently authorized the Distribution tab update, requesting local testing followed by publication through Cloudflare. The same manual release path applies if the GitHub billing restriction persists, after the relevant local checks pass. This change separates existing classifications in the frontend and requires no new live migration. Preserve customer and distributor records and verify the existing live migration and release identity before publication.

## Configuration

Repository variables:

- `MAGPET_PUBLISHABLE_KEY`: the existing public Supabase publishable key.
- `MAGPET_DATABASE_MIGRATION`: latest live migration independently checked through
  Supabase MCP, initially `20261104020000`.

Production environment secret:

- `CLOUDFLARE_API_TOKEN`: Pages publishing access limited to the stated Cloudflare account.
  It must not grant DNS, billing or unrelated account administration. Pages publishing
  permissions are account-scoped, so protect this secret accordingly.

The initial publishing token expires November 4, 2027 (00:00 UTC). Rotate it before
that date; its value is stored only in the production environment secret.

Each package includes public `release.json`: Git commit, package release, required migration
and public backend URL. No secret or business rows belong in it.

## Database changes and recovery

Website deployment never migrates or seeds the live database. A newer migration blocks the
website release until separately reviewed, backed up, applied and verified, followed by
an update of the repository confirmation variable. Do not change that variable merely
to bypass a failing release.

Retain the previous healthy Cloudflare deployment. Deployment evidence is saved as a GitHub
Actions artifact for 30 days. App rollback does not undo database changes or erase browser
queues. Keep cashier browser storage intact.

## November 4 verification

The first full verification passed 600 unit tests, 72 application browser tests,
1,521 database assertions, an isolated restore rehearsal, 69 ordinary workflow tests
and 44 fixed-Magpet workflow tests. The latter includes 300 distinct offline sales,
lost-response recovery and an exact closed drawer without duplicate payments or stock.
These are synthetic Linux checks, not physical Windows/printer endurance certification.

Supabase MCP applied `20261104080035_fixed_branch_exact_totals` and
`20261104080047_inactive_branch_original_retry`. Source files retain those actual
server migration versions. The fixes rebuild exact report strings after branch scoping
and acknowledge only an original cashier's exact saved sale before the active-branch
check. Original handlers still validate access and payload; new inactive-branch sales
remain rejected. Nine business-table checksums covering 4,137 rows matched before and
after both fixes, and function ownership/permissions stayed unchanged.

Original function definitions and verification evidence remain in the private local
`tmp/github-cloudflare-release` folder outside this repository. No database administrative
credential belongs in the workflow. The current confirmed migration is `20261104080047`.
