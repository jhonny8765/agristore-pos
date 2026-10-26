# Remaining release work

Updated October 26, 2026. This list distinguishes missing workflows from failures reproduced by a test. Completed controls and executable evidence are in [stock-control verification](stock-control-verification.md). The [owner guide](owner-next-steps.md) covers actions requiring the actual PC or business records. The latest staging release includes blind counts, separate-person approval, closed-shift operation recovery, [grams-first checkout](grams-switch-verification.md), [expiry/assigned-investigation worklists](expiry-followup-verification.md), and [documented purchase-cost loss reports](purchase-cost-loss-verification.md), verified by 186 unit tests, 43 browser scenarios, 330 database assertions and the expanded 26-table restore. Free public-source runners provide the full integration gate. Hardware, business-data and actual production-restore gates below remain open.

## Before real sales

| Remaining gate | Who supplies the missing evidence | Pass condition |
|---|---|---|
| Cashier PC and browser storage | Owner/cashier with technical help | Selected Windows PC, persistent storage granted, all completed test sales survive actual offline Edge/Windows restarts and eight real hours |
| Scale and receipt printer | Store staff | Tare/weight checks, quarter/half-kilo/gram/peso requests and readable physical output match the saved sale |
| Trustworthy inventory and roles | Owner and independent counter | Signed opening counts by product/lot, documented units and costs, individual branch-limited staff accounts |
| Hosting and restore readiness | Account owner and maintainer | Sized commercial production environment, defined recovery objectives, encrypted backup and successful actual cloud-backup restoration |
| One-branch operations | Branch manager and owner | Daily cash/stock reconciliation, documented discrepancies, controlled receiving/transfers/holds/refunds, no lost or unresolved completed sales |

A synthetic capacity test is not a stress certificate for a particular hosted plan. A successful disposable database restore is not evidence that a scheduled cloud backup exists. These gates remain unpassed until their actual evidence is recorded.

## Next software work, in order of stock-control value

Blind counts and independent approval are implemented, fully software-verified and assigned to staging. Rehearse the [three-person procedure](blind-counts.md) with actual staff before the pilot. The connected [expiry and investigation procedure](expiry-and-investigations.md) is also delivered: owner/manager assignments, deadlines, overdue/unassigned/mine filters, retained progress evidence and owner-only resolution. Assignments and notes keep cases open and stock unchanged; pagination retains old unresolved cases. The [purchase-cost report procedure](purchase-cost-loss-reports.md) is also delivered: documented per-unit costs, visible unvalued rows, retained corrections, separate authorised-use values and complete-range quantities by branch/product/lot. It does not verify the historical reported amount or its cause. Remaining software priorities follow.

1. **Purchase orders and rejected deliveries.** Match ordered, supplier-document, accepted, held and rejected quantities; support a completely rejected delivery without adding saleable goods. Retain supplier claims and credit/return references. Today, accepted quantities can be recorded with document differences; a completely rejected delivery still needs a manual document register.
2. **Partial financial refunds.** Specify the selected line quantities, centavo allocation, remaining refundable balance, role/shift authorization and linked immutable reversals. Continue recording physical disposition separately. The current full financial refund must not be used to simulate a smaller cash refund.
3. **Broader operational reports and maintenance.** Add approved report requirements, storage/queue health review and repeatable maintenance/backup ownership. Preserve history rather than introducing automatic deletion to reduce size.

Until these are implemented, use the documented [daily routine](stock-control-operations.md) and explicit manual records for the gaps. Do not describe them as delivered features. Keep customer credit, electronic payment processing, full accounting and official tax-invoice issuance outside the initial pilot's agreed scope.
