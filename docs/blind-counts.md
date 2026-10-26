# Blind counts and separate-person approval

October 26, 2026. **Released to staging** after [full real Supabase verification](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40259205535) passed: 175 unit checks, 37 browser scenarios, 222 database assertions and the expanded 25-table dump/restore. The clean [MIT source edition](https://github.com/jhonny8765/agristore-pos-open-source) uses free standard public runners. Earlier private-repository jobs were billing/usage-blocked; no payment change was needed. Original business history and artwork remain private. Existing approved counts are historical records, and a typed witness cannot authorize a new adjustment.

## People and preparation

Use three people with their own accounts: two branch-authorized counters (stock staff, managers or owners), then an owner who entered neither observation. If the owner performs either count, another owner must approve. Cashiers cannot count or approve. Do not share the owner password or create a second account to impersonate an independent person.

Synchronize every cashier PC, resolve unfinished online operations, close all branch shifts and record the physical cutoff. Count saleable stock in base units: net kg, liters or whole pieces. Tare loose-goods containers; count sealed packs using the documented conversion. Keep held/damaged goods and goods in transit separate. Do not adjust stock merely to close an unexplained investigation.

## Counting in the released staging app

1. First counter: open **Stock counts → Enter blind counts**, select the product/lot, describe the scope and select **Start blind count**. Confirm the branch and physical lot.
2. Enter the first physical quantity and notes; select **Seal first count**. Expected stock, the first observation and its notes remain absent from the recount response/public count history until both observations are sealed. The entry view never displays quantity comparisons or the historical count register.
3. Independent counter: sign in separately, open the same branch and count the physical goods without consulting the first counter's result. Enter quantity/notes under **Independent recount needed**, then select **Seal independent recount**. The first counter cannot submit this step under their own login, including through a forged API request.
4. Separate owner: select **Review sealed counts**. Verify the expected balance, both sealed quantities, notes, named counters and discrepancy. If the two quantities agree, no stock has moved and neither counter has lost stock access, enter **Approval evidence → Confirm adjustment**. Approval creates one linked adjustment; an exact retry cannot apply it twice. An owner who entered either count receives no approval action and is denied by the server.
5. Keep the original sheets and investigate the cause of any difference. Approval reconciles the quantity; it does not establish theft, explain a loss or close the discrepancy investigation automatically.

Every difference requires a matching independent recount in this release; there is no unagreed materiality threshold or owner override. Even a count matching the system balance requires the independent steps. Zero-difference approval records evidence without a stock movement.

## Exceptions and recovery

- **Counts disagree:** both observations remain sealed. No adjustment is allowed. Investigate, close the record with a reason and start a fresh blind count. Neither value can be edited or replaced.
- **Stock moved or a shift reopened:** the old count cannot continue/approve. Synchronize, close shifts, close the stale count and start fresh. The branch-wide ledger revision deliberately treats movements in any branch product as a fresh-count boundary.
- **Counter access revoked:** approval stops and a fresh count by currently authorized staff is required. Original evidence stays retained.
- **Response interrupted:** the current PC retains the original online request in Sync center. Retry **Retry original request** as the employee who began it. Do not invent another quantity or create another observation to force confirmation. Reopening the count list also shows server-confirmed progress.
- **Replacement test profile:** export the recovery file and restore it while signed in to the same business/branch as the original employee. Operation-only files work with every shift closed; sale files still need an authorized cashier shift. Counts, observations, approvals and closures retain their original request identity. An owner can keep another employee's evidence for review but cannot retry as that employee. Keep the original PC and export until confirmation is independently checked.
- **Closing a count:** the original starter or owner can close it without adjustment and with an explanation. The observations remain; an approved count cannot be cancelled this way.
- **Older pending counts:** retained as legacy evidence. A typed witness/recount field cannot approve them after migration. Start a fresh blind count instead. Historical approved adjustments remain immutable and auditable.
- **Unknown catalog lot:** the screen retains the recorded lot identifier and says **Expiry unavailable**. It does not describe a recorded lot as “No lot.” Check the physical lot and catalog before proceeding.

The app separates authenticated user IDs. It cannot prove that different humans used those accounts or prevent staff with inventory access from looking up balances elsewhere. Physical independence, private passwords and witnessed procedures remain necessary. All counter quantities/notes stay in private server tables until the controlled comparison response is allowed; these are not client-side-only hiding rules.

## Local verification and future release checks

Run the supplementary local checks without GitHub-hosted compute or Docker:

```powershell
npm ci
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run build
npm run test:e2e
npm run test:db:preflight
npm run test:counts:local
npm run test:counts:restore
```

The preflight applies every migration to ephemeral PGlite/PostgreSQL databases and executes the actual pgTAP files with minimal Auth tables/claims test doubles. The count-browser harness renders the actual production count component and compiled application CSS, replacing only transport/sign-in with local simulated identities backed by those actual SQL functions. It binds loopback only, accepts no hosted credentials and must never be deployed. The snapshot drill reloads a PGlite binary data directory; it is not a `pg_dump`/`pg_restore` or cloud-backup certification. The [PGlite API](https://pglite.dev/docs/api#dumpdatadir) explicitly limits these snapshots to reimport into PGlite.

For future releases, run **Actions → Verify AgriStore → Run workflow** on the latest main source in the public repository. Match the critical migration/domain/offline/count files to the private business edition before applying changes. The gate includes fresh migrations, warning-failing database lint, pgTAP, the expanded dump/restore and 17 real database-connected browser scenarios with separate Auth contexts. After success, apply/read back the migration, inspect advisors and rehearse the guarded app update on staging. This release completed those checks and preserved the existing business baseline; actual staff/PC acceptance remains separate.

GitHub-hosted Actions for private repositories use an included allowance; blocked jobs do not by themselves establish that payment is owed. Check included usage, reset date and account restrictions before choosing a paid option. Waiting for the allowance to reset or using a properly configured local test environment are alternatives; no billing or original private-repository visibility changes were made. See [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Actual cashier-PC outage/restart tests, verified opening stock, a real cloud-backup restoration and the one-branch pilot remain separate gates in [the owner guide](owner-next-steps.md).
