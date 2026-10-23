# AgriStore overall review and improvement plan

Scope: the five-branch staging test business, cashier checkout, inventory operations, owner controls, synchronization/recovery, accessibility and operating performance. Preserve the established visual system and cash-only pilot boundary.

## Work order

1. Review the implementation and exercise real staging workflows using labelled test data. Record reproducible failures and expected results.
2. Fix access/data correctness and recovery problems first. Add regression coverage at the layer where each failure occurs.
3. Improve feedback, update handling, history navigation and avoid unnecessary data downloads. Inspect desktop, mobile and the user's browser width together.
4. Run type checks, lint, unit, browser, database and restore checks. Deploy the verified staging build, repeat affected workflows, and document remaining pilot requirements.

## Initial confirmed findings

| Priority | Finding | Intended result | Status |
|---|---|---|---|
| P1 | Signing in does not replace the previous cached catalog; signing out leaves prior cloud/UI records in memory | A signed-in account sees only its own branch data; unresolved records remain recoverable | Investigating regression coverage |
| P1 | History queries silently stop at the most recent 1,000 organization records | Branch receipts can be paged beyond the API limit; other bounded report lists state their scope | Planned |
| P2 | Password fields use a generic trimming helper | Preserve the exact password typed by the user | Confirmed in source |
| P2 | Update checking inspects `waiting` before a newly downloading worker finishes installation | Show downloading/ready/failed accurately and recheck cart/queue protection before activation | Confirmed during previous staging updates |
| P2 | Retiring this browser's PC keeps its retired device UUID in local settings | A permitted owner can register a new device identity without clearing transaction/recovery storage | Confirmed in source |
| P2 | Generic busy state says “Saving sale…” during unrelated work | Describe checkout saving only while checkout is committing | Confirmed in UI |

## Workflow checks

- Cash checkout: insufficient cash, correct change, sack/kilo conversion, seed batch selection, synchronization and online refund.
- Owner operations: separate transfer dispatch/receipt, count/approval after closed shifts, device retirement and re-registration.
- Failure cases: failed branch download, changed authorization, failed local write, interrupted upload and interrupted app update.
- History: more than 1,000 records, branch isolation and clear older-record navigation.
- Accessibility: labels, keyboard operation, status announcements, contrast and responsive overflow. Audit scores apply only to measured surfaces and do not imply full WCAG certification.

## Release requirements that need the owner or chosen hardware

The cashier PC is not selected. Actual Windows reboot recovery and timed 60-minute/eight-hour outage tests remain required on that PC. Production backup retention/restoration, verified real opening stock, cash reconciliation and branch pilot sign-off remain separate from this staging review. Review the existing Auth password-protection advisory before production. No production deployment or paid plan change is part of this pass.
