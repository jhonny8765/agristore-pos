# Acceptance evidence

Tests are executable evidence, not a blanket claim of production readiness.

| Check | Evidence / status |
|---|---|
| Exact cash, conversions, authorization, immutable checkout IDs, queue recovery, import/export, ambiguous receiving requests | 40 Vitest checks passed locally |
| Atomic server sales, RLS, role restrictions, price versions, transfers, owner counts, refunds, failed-PC recovery and revoked sessions | 77 pgTAP assertions passed against the selected empty staging project, inside rolled-back transactions |
| Browser cash checkout, separate identical sales, offline reload, expired local authorization, fractional kilos, persistent browser-process restart | 7 Playwright checks passed locally and in CI; the responsive check also verifies the basket shortcut and reset control |
| 200 offline browser checkouts with simulated one-hour elapsed time | Passed in Chromium using real IndexedDB and service-worker reload |
| 200 queued transactions and simulated eight-hour elapsed time, zero repeated server effects | Passed in Vitest using IndexedDB emulation and a deterministic server transport |
| Type checks, lint and optimized PWA build | Passed locally; CI repeats them |
| Security advisors on staging | No security findings after the final migration; staging contains zero organizations, sales and inventory movements after rolled-back tests |
| Fresh migrations and database dump/restore | Passed in the disposable GitHub Actions database job: complete database dump restored into an isolated database; authenticated snapshot API returned the expected ledger-derived stock |
| Actual Windows reboot during outage | Not performed; requires the intended store PC |
| Actual timed 60-minute / eight-hour outage | Not performed; automated elapsed-time simulation is a separate check |
| Production encrypted off-site backup and restoration | Not configured or verified; required before live use |
| Actual three-branch opening stock and daily cash reconciliation | Not performed; requires the owner’s verified business data and branch pilot |

Verification run: [GitHub Actions 39794349493](https://github.com/jhonny8765/agristore-pos/actions/runs/39794349493), implementation commit `bd5614f`. The database job log records the restore pass at 2026-10-22 14:19 UTC. The application checks include type checks, lint, 40 unit assertions, optimized build and seven Playwright scenarios. The fresh Supabase stack applies all migrations, passes database lint and 77 pgTAP assertions, then performs the restore drill. The drill uses the disposable container's local `supabase_admin` role to restore built-in Supabase functions; it does not use or request a production administrator credential.

Local Docker initialization encountered a full drive and then engine failures. No other project’s containers or data were removed. Fresh-stack and restore verification therefore ran on disposable CI infrastructure.

The bounded interface review resolved three checkout findings: compact flat product category markers, a mobile basket summary with a working receipt shortcut, and a visibly named Reset control. This review covers those checkout fixes; it does not certify every owner workflow or replace the operational pilot. The actual design system is recorded in [DESIGN.md](../DESIGN.md).

The dependency audit reports five high-severity development-tool findings through the current Next ESLint plugin’s `braces` chain. No fixed upstream `braces` version was available at implementation time; runtime production dependencies have no reported findings. Do not force-downgrade the application framework as an automated audit fix.
