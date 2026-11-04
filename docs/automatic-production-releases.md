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

## Configuration

Repository variables:

- `MAGPET_PUBLISHABLE_KEY`: the existing public Supabase publishable key.
- `MAGPET_DATABASE_MIGRATION`: latest live migration independently checked through
  Supabase MCP, initially `20261104020000`.

Production environment secret:

- `CLOUDFLARE_API_TOKEN`: Pages publishing access limited to the stated Cloudflare account.
  It must not grant DNS, billing or unrelated account administration. Pages publishing
  permissions are account-scoped, so protect this secret accordingly.

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
