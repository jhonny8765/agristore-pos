# Acceptance evidence

Tests are executable evidence, not a blanket claim of production readiness.

| Check | Evidence / status |
|---|---|
| Exact cash, conversions, authorization, immutable checkout IDs, queue recovery, import/export, ambiguous receiving requests | 40 Vitest checks passed locally |
| Atomic server sales, RLS, role restrictions, price versions, transfers, owner counts, refunds, failed-PC recovery and revoked sessions | 77 pgTAP assertions passed against the selected empty staging project, inside rolled-back transactions |
| Browser cash checkout, separate identical sales, offline reload, expired local authorization, fractional kilos, persistent browser-process restart | Playwright suite; see final CI result |
| 200 offline browser checkouts with simulated one-hour elapsed time | Passed in Chromium using real IndexedDB and service-worker reload |
| 200 queued transactions and simulated eight-hour elapsed time, zero repeated server effects | Passed in Vitest using IndexedDB emulation and a deterministic server transport |
| Type checks, lint and optimized PWA build | Passed locally; CI repeats them |
| Security advisors on staging | No security findings at initial schema verification; recheck after any migration |
| Fresh migrations and database dump/restore | Disposable GitHub Actions job; consult its result before acceptance |
| Actual Windows reboot during outage | Not performed; requires the intended store PC |
| Actual timed 60-minute / eight-hour outage | Not performed; automated elapsed-time simulation is a separate check |
| Production encrypted off-site backup and restoration | Not configured or verified; required before live use |
| Actual three-branch opening stock and daily cash reconciliation | Not performed; requires the owner’s verified business data and branch pilot |

Local Docker initialization encountered a full drive and then engine failures. No other project’s containers or data were removed. The cloud SQL tests therefore provide current database evidence; the fresh local-stack and restore checks run on disposable CI infrastructure.

The dependency audit reports five high-severity development-tool findings through the current Next ESLint plugin’s `braces` chain. No fixed upstream `braces` version was available at implementation time; runtime production dependencies have no reported findings. Do not force-downgrade the application framework as an automated audit fix.
