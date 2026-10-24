# AgriStore overall review and improvement plan

Scope: the five-branch staging test business, cashier checkout, inventory operations, owner controls, synchronization/recovery, accessibility and operating performance. Preserve the established visual system and cash-only pilot boundary.

## Work order

1. Review the implementation and exercise real staging workflows using labelled test data. Record reproducible failures and expected results.
2. Fix access/data correctness and recovery problems first. Add regression coverage at the layer where each failure occurs.
3. Improve feedback, update handling, history navigation and avoid unnecessary data downloads. Inspect desktop, mobile and the user's browser width together.
4. Run type checks, lint, unit, browser, database and restore checks. Deploy the verified staging build, repeat affected workflows, and document remaining pilot requirements.

## Findings and repairs

| Priority | Finding | Intended result | Status |
|---|---|---|---|
| P1 | Prior account catalog and cloud records survive an account change | Clear account caches on login/logout, discard late responses, preserve immutable local records | Implemented; cache preservation unit tests and full account-switch scenario passed |
| P1 | Refund, recovery and PC-retirement actions use unsupported browser prompts | Inline consequence/reason forms with explicit confirm/cancel, retained input and visible failure | Implemented; actual staging sale refunded and stock restored |
| P1 | Receipt history silently stops at the most recent 1,000 organization records | Branch-filtered keyset pagination with stable UUID ordering and exact timestamp precision | Implemented; real database test passed for 1,005 equal-microsecond sales |
| P1 | A cashier's recovery download may include another account's retained records | Scope UI exports to current organization, branch and cashier permissions without deleting retained records | Implemented; scoped export/preservation unit test passed |
| P2 | Stock can remain stale after owner operations without an open shift | Download the selected branch snapshot after online inventory operations | Implemented; receiving and approved-count UI assertions passed in the first integration run |
| P2 | Generic password helper trims spaces | Preserve the exact password typed | Implemented; real Auth login uses a password with leading/trailing spaces |
| P2 | Update checking reports success before installation finishes | Await installation; show downloading, ready and failed states; recheck all pending records and cart before activation | Implemented; five worker-state unit tests and browser pending-sale guard |
| P2 | Retired browser retains a dead device UUID | Forget only the retired identity and lease; retain transaction and recovery storage | Implemented; unit test and owner device re-registration scenario |
| P2 | Unrelated work says “Saving sale…” | Separate checkout-saving state from general activity | Implemented |
| P2 | Overview downloads unrelated records and reverses an already descending stock ledger | Load only tables required by the current screen; show newest movements first | Implemented |
| P2 | Pending online commands can disappear from view after a refresh error | Refresh local recovery state even if the following cloud snapshot fails; isolate records by current context | Implemented |
| P2 | Narrow receipt tables clip the approval field's focus outline | Size forms to the actual scroll container and reserve outline clearance | Implemented; final visual verdict **ship** for the scored containment fix at desktop, 390px and 418px |

No P0 issue was reproduced in the reviewed scope. This does not certify untested hardware or every possible workflow.

## Workflow checks

- Cash checkout: insufficient cash, correct change, sack/kilo conversion, seed batch selection, synchronization and online refund.
- Owner operations: separate transfer dispatch/receipt, count/approval after closed shifts, device retirement and re-registration.
- Failure cases: failed branch download, changed authorization, failed local write, interrupted upload and interrupted app update.
- History: more than 1,000 records, branch isolation and clear older-record navigation.
- Accessibility: labels, keyboard operation, status announcements, contrast and responsive overflow. Audit scores apply only to measured surfaces and do not imply full WCAG certification.

## Release requirements that need the owner or chosen hardware

The cashier PC is not selected. Actual Windows reboot recovery and timed 60-minute/eight-hour outage tests remain required on that PC. Production backup retention/restoration, verified real opening stock, cash reconciliation and branch pilot sign-off remain separate from this staging review. Review the existing Auth password-protection advisory before production. No production deployment or paid plan change is part of this pass.

## Next improvements, in order

The counter review now includes the owner's confirmed loose-weight **and** peso-budget requests. The original quantity field rejected intermediate keystrokes such as `0.`; direct test filling had missed it. The replacement accepts editable drafts, fractions and grams, selects the explicit kilo price for quick weights, and blocks incomplete or unconfirmed estimates. See [weighed sales](weighed-sales.md) for the realistic counter flow and remaining scale/product decisions. This is a core checkout correction; the earlier direct-fill fractional test was insufficient evidence of usable typing.

The same review found that two-decimal sack equivalents could conceal a quarter-kilo deduction. Product tiles now show exact base kg/liters for bulk stock and sum all batches with decimal arithmetic. The mixed-sale integration scenario checks the same **9,947.82 kg** before upload and after authoritative synchronization, covering accidental double deductions as well as display rounding.

Hosted testing also exposed a browser retaining a previously retired PC identity. Owners can now release only the matching retired local setup after an online recheck, with baskets and unresolved records blocking the action. Saved receipts are preserved. The branch's one-active-PC restriction remains enforced; replacing another active registration uses the existing audited owner retirement flow. See [operations and recovery](operations.md).

The completed three-line receipt exposed an older CSS selector applying the 53px success-icon dimensions to print details. That selector is now scoped to the icon. Detailed item lines stay hidden on screen and use the full 80mm receipt column in print; the integration test checks all quantities, containment and the footer position in print emulation. Table action focus outlines now sit inside their controls so scrolling the longer retired-setup action into view does not clip the ring.

1. **P1 — Pilot reliability gate:** select the Windows cashier PC, install Edge PWA, test actual one-hour/eight-hour outages and Windows restart recovery. Confirm backup recovery and daily cash/stock reconciliation before real sales.
2. **P2 — Report navigation, implemented:** purchasing, transfers, counts and audit registers now have selected-branch queries, 50-row keyset pages, Manila date ranges and CSV export of loaded rows. Incoming and outgoing transfers are included; audit includes branch and business-level events. Receipt history keeps its separate pagination and overview totals remain server-computed. See [the report guide](reports.md). The flag/reconciliation/movement previews remain bounded; extending those previews and measuring large-dataset query plans are later improvements.
3. **P2 — Accessibility coverage, expanded:** all nine owner screens now have a shared skip link, destination focus, selected-state semantics and named keyboard-scroll regions. Contrast, control targets and forced-color cues are strengthened. The new regression scenario checks desktop/narrow layouts and forced-color emulation. Real screen-reader use, browser zoom and Windows contrast themes still require the chosen cashier PC. See [the bounded accessibility review](accessibility.md).
4. **P2 — Maintainability:** split the large store component into screen modules and a shared session/synchronization controller without changing the transaction contracts. Preserve current regression coverage while doing so.
5. **P2 — Store operations:** rehearse verified stock imports, permissions, two-person transfer reconciliation and approved counts with staff at the first pilot branch. Confirm receipt and cash-drawer hardware expectations before buying peripherals.
6. **P3 — Delivery maintenance:** complete the owner's Git/Vercel login connection if automatic preview deployment is desired; monitor dependency advisories and diagnostic-artifact storage. A fresh npm registry audit on October 23 reports zero known findings for the pinned lockfile; earlier runs reported five development-tool findings, and no forced dependency change was applied. Current staging deployment remains protected.

## Measured review boundaries

The scoped Sales & receipts screen had no horizontal page overflow at desktop, 390px and the actual 418px user width; wide tables scroll inside their panels. The sampled lowest visible text contrast was 4.58:1, and no enabled control in that view was below 24px. The final review checks field/focus containment separately. Other screens, forced-colors mode and assistive technologies require their own measurements.

The optimized PWA shell is approximately 1.64 MB in this build. Screen-specific downloads replace the previous broad refresh; this is a source/build observation, not a measured field speedup or Core Web Vitals result.

Heuristic review scores use a 0–4 scale (4: no material finding within the measured scope); they are not certification or a whole-product score:

| Dimension | Score | Basis and remaining work |
|---|---|---|
| Accessibility | 3/4 | Labelled approvals, visible uncut focus, linked errors, sampled contrast and control sizes; wider assistive-technology/forced-colors coverage remains |
| Performance | 2/4 | Bounded receipt pages and screen-specific refresh, optimized build; field latency, long-lived memory and Core Web Vitals were not measured |
| Responsive behavior | 3/4 | Scoped desktop/390px/418px captures passed the containment review; other owner screens need full zoom/device coverage |
| Theming | 4/4 | Reviewed changes preserve existing forest/paper tokens, type and control styles; no alternate theme is shipped |
| Integrity and recovery | 3/4 | Exact IDs, scoped caches/exports, retained ambiguous operations, real database regression checks; physical-PC/timed outage gates remain |

Staging manual evidence: receipt `B01-A5ACCC76AE7A`, one TEST feed sack at ₱1,580, ₱2,000 tendered, ₱420 change. Insufficient cash was blocked. A linked full refund restored Magpet feeds to 500 kg. The shift then reconciled and closed at ₱0 expected / ₱0 counted, with no unconfirmed local sales. Original sale and reversal remain in the audit trail.

The second staging receipt `B01-EBE680995C3A` used one TEST Vegetable Seeds packet from lot TEST-LOT-001 (expiry 2027-12-31), ₱65 due, ₱100 tendered and ₱35 change. The new build's safe update flow downloaded and activated successfully before this test. Its linked refund restored the lot to 50 packets; the second shift also reconciled and closed at ₱0 expected / ₱0 counted.

Initial audit verification: [GitHub Actions 39923425067](https://github.com/jhonny8765/agristore-pos/actions/runs/39923425067), source `b6f2d2f`, passed type checks, lint, 48 unit tests, eight practice-browser scenarios, 98 pgTAP assertions, the restore drill and three database-connected browser workflows. The following report-navigation pass extends that baseline.

## Report navigation follow-up

The shared history surface adds explicit loading/empty/failure states, keeps loaded pages after failed next-page requests, rejects reversed or impossible dates, and discards late reads after scope changes. Its footer identifies the applied range rather than unsubmitted field edits. CSV downloads include only loaded records and neutralize formula-like text. Event cursors retain database timestamp precision and bigint identifiers as text.

Eight additional unit tests cover Manila midnight/end-day boundaries, leap dates, open ranges, rejected raw cursor syntax, large event identifiers, Unicode/quote escaping and spreadsheet-formula text. Disposable integration fixtures create 1,005 additional receipts and more than 1,000 audit events, plus 55 counts and 55 incoming/outgoing transfers.

Hosted checks found three Magpet receiving records, Kidapawan's separate record, and 13 branch/business audit events. Empty future ranges disabled export; reversed dates preserved the fields and showed validation. Transfer/count empty states worked, with no browser warnings or errors. No new staging stock, sales or shifts were created in this follow-up. The app download completed and the browser was explicitly reopened before these checks.

The scoped visual review required stronger history-table header/identifier contrast, named focusable horizontal-scroll regions (and visible Audit detail focus), and right-aligned count/quantity columns. Those corrections retain the incumbent colors and layout. The later owner accessibility review measures computed legacy-table styles, including the final CSS overrides, rather than treating superseded literals as visible failures.

Final follow-up verification: [GitHub Actions 39931037713](https://github.com/jhonny8765/agristore-pos/actions/runs/39931037713), implementation `2b6c809`, passed type checks, lint, 56 unit tests, eight practice-browser scenarios, 98 pgTAP assertions, the restore drill and four database-connected browser workflows. The additional workflow covers sustained network failure, retained/loaded pages, CSV contents, offline access, date validation, branch/organization isolation and actual keyboard scrolling.

The visual verdict is **ship for the three scored fixes** at desktop, 390px and 418px. Header contrast is approximately 12.18:1; record identifier text is 4.93:1. The hosted named table accepted keyboard focus and ArrowRight advanced its horizontal scroll by 40px. Matching numeric headers/cells align right. The stable protected staging address runs this same application source. These scoped results do not replace the Windows/real-outage and operational pilot requirements above.

## Owner accessibility follow-up

The broader review repaired low-contrast shift helper/category/CSV copy, weak field boundaries, missing skip/destination focus, unnamed legacy table scroll regions, small branch/checkbox/receipt targets, erased selected-state cues in forced colors and a reproduced Sync-center overflow at 320px. Automated label checks also exposed mismatched brand/Checkout/product names; semantic product articles now separate readable metadata from a named Add button while retaining the full-tile pointer target. Navigation changes colors immediately to avoid low-contrast transition frames.

[GitHub Actions 39971801627](https://github.com/jhonny8765/agristore-pos/actions/runs/39971801627), source `0581345`, passed 56 unit tests, eight practice-browser scenarios, 98 pgTAP assertions, restore verification and five database-connected browser scenarios, alongside type checks, lint and optimized builds. The added scenario completes 20 axe scans with no violations in its selected WCAG tags, tests keyboard/focus/target behavior, checks 640px and 320px reflow and emulates forced colors. No axe exclusions were used.

The fresh visual review returned **ship** for the bounded refinement. Actual staging checks confirmed all nine screen destinations/containment at 418px, Sync center containment at 320px, larger controls and named table regions. No hosted sales, stock or shifts were changed. The old in-app tab retained an older shell after update/reload; a fresh same-origin tab loaded the new app with its owner data intact. Automatic Edge restart, real zoom, Windows contrast themes and screen-reader task completion remain hardware acceptance work. See [accessibility.md](accessibility.md) for measurements, scores, evidence and limits.

## Guarded update and reopening follow-up

The next pass addresses the observed stuck restart: wait for worker activation, recheck current cart and actual local pending records before reopening, bound activation failures and remove listeners after failures/timeouts. A newer installer takes priority over an older waiting download. Only the requesting window navigates; other windows are not forced to reload, and checkout cannot start in the window while it installs an update. No-download feedback no longer claims the currently displayed app is necessarily up to date.

[GitHub Actions 40010789164](https://github.com/jhonny8765/agristore-pos/actions/runs/40010789164), source `22b22ed`, passed 64 unit tests, ten practice-browser scenarios, 98 pgTAP assertions, restore verification and five database-connected browser scenarios, plus type checks, lint and optimized builds. The new browser cases verify automatic reopening without a controller-change event, another window's preserved cart, a fresh queue guard after another window saves a sale, and exact sale ID/payload retention through an offline process restart into a downloaded version.

The visual verdict is **ship** for the inline update feedback. In protected staging, the older release first needed a fresh tab to load the new updater; its next hosted update then automatically reopened that same tab at Checkout. Both prior test receipts remained synchronized, with no new business mutations and no site-data clearing. The installed Edge PWA, real Windows restart and actual timed outages remain pilot requirements. See [app-updates.md](app-updates.md) for user instructions, lifecycle references and evidence.
