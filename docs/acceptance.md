# Acceptance evidence

Tests are executable evidence, not a blanket claim of production readiness.

| Check | Evidence / status |
|---|---|
| Exact cash, conversions, authorization, immutable checkout IDs, queue recovery, import/export, ambiguous receiving requests | 40 Vitest checks passed locally |
| Atomic server sales, RLS, role restrictions, price versions, transfers, owner counts, refunds, failed-PC recovery, revoked sessions and expandable branches | 98 pgTAP assertions passed against the disposable CI database, including 21 branch creation/retry/isolation checks |
| Browser cash checkout, separate identical sales, offline reload, expired local authorization, fractional kilos, persistent browser-process restart | 7 Playwright checks passed locally and in CI; the responsive check also verifies the basket shortcut and reset control |
| Real Auth → registered PC → cashier switch → offline sale → PostgreSQL → UI | Passed against the disposable Supabase stack. Two identical purchases produced two sales, two payments and two stock deductions. A committed sale with a lost response retried its original UUID. Revoked access retained a third local sale without uploading it. |
| Interrupted browser upload lock | Passed with a real persisted lock initially showing 44.1 seconds remaining; automatic processing resumed after expiry |
| Deployed staging PWA | Protected staging passed real-browser cash checkout, correct change, offline service-worker reopening and retained practice queue; zero page errors and no hosted API requests from practice mode |
| Deployed app upgrade with a pending record | Passed on the stable staging origin: a saved practice sale disabled manual update; the next service worker waited; closing and reopening the browser offline loaded the new build and preserved the exact sale UUID and queue record |
| 200 offline browser checkouts with simulated one-hour elapsed time | Passed in Chromium using real IndexedDB and service-worker reload |
| 200 queued transactions and simulated eight-hour elapsed time, zero repeated server effects | Passed in Vitest using IndexedDB emulation and a deterministic server transport |
| Type checks, lint and optimized PWA build | Passed in GitHub Actions; the optimized staging build also passed on Vercel |
| Security advisors on staging | No database/RLS findings after the branch migration. Auth reports [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), to review before production. The user has created a staging test business and authorized labelled sample data. |
| Fresh migrations and database dump/restore | Passed in the disposable GitHub Actions database job: complete database dump restored into an isolated database; authenticated snapshot API returned the expected ledger-derived stock |
| Actual Windows reboot during outage | Not performed; requires the intended store PC |
| Actual timed 60-minute / eight-hour outage | Not performed; automated elapsed-time simulation is a separate check |
| Production encrypted off-site backup and restoration | Not configured or verified; required before live use |
| Actual opening stock and daily cash reconciliation across the growing branch network | Not performed; requires the owner’s verified business data and branch pilot |

Latest verification run: [GitHub Actions 39855860054](https://github.com/jhonny8765/agristore-pos/actions/runs/39855860054), implementation commit `11a8bb5`, passed all application and database checks. The application checks include type checks, lint, 40 unit assertions, optimized build and seven practice-browser scenarios. The fresh Supabase stack applies all migrations, passes database lint and 98 pgTAP assertions, performs the restore drill, and runs the additional real cashier integration scenario. The drill uses the disposable container's local `supabase_admin` role to restore built-in Supabase functions; it does not use or request a production administrator credential.

Branch expansion verification includes adding fourth/fifth branches in the real owner UI, visible validation errors preserving entered names, concurrent additions with distinct codes, denied cashier creation, and organization/revocation isolation. Switching between an empty added branch and the stocked original branch loads their respective quantities before changing the selected branch; offline switching is disabled. Actual staging checks also verified Kidapawan's six feed sacks and Magpet's ten. The five-branch labelled sample account is described in [test-account.md](test-account.md). Branches are not limited to three or five; the database tests cover code B100.

The real integration test exposed and verified fixes for two UI faults: Sign out is disabled until the active shift operation finishes, and local transaction states refresh even if the following server snapshot fails. Failure diagnostics contain queue states and UI messages; Auth traces and credential-bearing request recordings are disabled.

Stable staging: https://agristore-pos-staging-team-payaman2.vercel.app, currently pointing to preview `agristore-j0i4376c4-team-payaman2.vercel.app`. The earlier deployed upgrade check used builds before and after `639b9fd` in an isolated browser profile with a local practice sale. It verifies the browser storage/update mechanism; it does not substitute for the intended Windows PC test or a production backup restore. Vercel protection remained enabled, and temporary test authentication/profile files were removed. The branch update was opened in the user's authenticated staging session after verifying the cart and queue were empty.

The branch settings review scored its local state-visibility fix resolved: pending, success and error feedback appear beside Add branch. Existing tokens and composition were retained. Browser-test installation now prefers Ubuntu's official archive over the runner's stalled Azure mirror, retains signed-repository checks and fallback, and has bounded timeouts; both CI jobs successfully installed and ran their browsers afterward.

Local Docker initialization encountered a full drive and then engine failures. No other project’s containers or data were removed. Fresh-stack and restore verification therefore ran on disposable CI infrastructure.

The bounded interface review resolved three checkout findings: compact flat product category markers, a mobile basket summary with a working receipt shortcut, and a visibly named Reset control. This review covers those checkout fixes; it does not certify every owner workflow or replace the operational pilot. The actual design system is recorded in [DESIGN.md](../DESIGN.md).

The dependency audit reports five high-severity development-tool findings through the current Next ESLint plugin’s `braces` chain. No fixed upstream `braces` version was available at implementation time; runtime production dependencies have no reported findings. Do not force-downgrade the application framework as an automated audit fix.
