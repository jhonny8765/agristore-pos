# Remaining release work

October 25, 2026. This list distinguishes missing workflows from failures reproduced by a test. Completed controls and executable evidence are in [stock-control verification](stock-control-verification.md). The [owner guide](owner-next-steps.md) covers actions requiring the actual PC or business records.

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

1. **Blind first count and separately authenticated approval.** Hide expected quantity during the first count, require an independent recount for material differences and prevent self-approval under the configured policy. Preserve both entries and intervening ledger checks. The present witness-name field is an attestation, not a second login or segregation of duties.
2. **Expiry worklist and investigation ownership.** Show approaching expiry and overdue unresolved cases with a named assignee/due date. Keep old cases outstanding across pagination; never resolve a case merely because a reminder was acknowledged. Existing expiry blocking and the persistent investigation register remain useful, but are not this complete workflow.
3. **Cost-valued discrepancy reports.** Show physical quantities and documented purchase-cost valuation separately from selling value, including the chosen cost basis and missing-cost flags. Reconcile opening/receiving/sales/returns/holds/loss/transfers/adjustments by branch and lot. Do not label the reported ₱170,000 as a verified amount or cause without the source records.
4. **Purchase orders and rejected deliveries.** Match ordered, supplier-document, accepted, held and rejected quantities; support a completely rejected delivery without adding saleable goods. Retain supplier claims and credit/return references. Today, accepted quantities can be recorded with document differences; a completely rejected delivery still needs a manual document register.
5. **Partial financial refunds.** Specify the selected line quantities, centavo allocation, remaining refundable balance, role/shift authorization and linked immutable reversals. Continue recording physical disposition separately. The current full financial refund must not be used to simulate a smaller cash refund.
6. **Broader operational reports and maintenance.** Add approved report requirements, storage/queue health review and repeatable maintenance/backup ownership. Preserve history rather than introducing automatic deletion to reduce size.

Until these are implemented, use the documented [daily routine](stock-control-operations.md) and explicit manual records for the gaps. Do not describe them as delivered features. Keep customer credit, electronic payment processing, full accounting and official tax-invoice issuance outside the initial pilot's agreed scope.
