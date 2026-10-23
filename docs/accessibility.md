# Owner accessibility review

This is a bounded review of sign-in, cash checkout and the nine owner screens. It combines automated checks with keyboard, responsive and visual inspection. It is not a whole-product WCAG certification. Actual screen-reader use, browser zoom and Windows contrast themes remain acceptance checks on the chosen cashier PC.

## Findings and repairs

| Finding | Repair |
|---|---|
| Shift-opening helper copy measured 4.19:1 on its tinted surface; unselected categories measured 4.49:1; purchasing CSV guidance measured 4.30:1 | Use existing working-green/muted tokens that meet normal-text contrast on those surfaces |
| Form boundaries and placeholder copy were difficult to distinguish | Shared control-line token for input, select, textarea, search and quantity controls; muted placeholder text |
| No direct keyboard path to the main task, and page changes did not announce a clear destination | Focus-visible skip link; focus the new page heading only after the selected screen changes; current-page navigation and pressed category state |
| Legacy wide tables lacked a named keyboard entry point | Every shared table wrapper is a labelled, focusable region; horizontal scrolling remains inside the panel |
| Branch picker and small receipt controls were difficult targets | Branch picker has a 40px minimum height; checkboxes are 24px square; receipt removal and unit selection have 32px minimum targets |
| Forest-sidebar focus blended into its background | Lime sidebar outline; inset skip-link outline on its white surface |
| Color changes could erase selected navigation/category cues | Forced-color mode adds explicit selected-state borders and uses system control/focus colors |
| The new 320px regression check found Sync center's page action extending beyond the screen | Narrow page headings wrap their actions; no global clipping hides content |
| Automated label checks found the brand, Checkout badge and product card's visible metadata missing from their spoken names | Brand/Checkout names include their visible wording; product metadata sits in a semantic article with a separate named Add button whose pointer target still covers the tile |
| Simultaneous navigation text/background transitions produced intermediate low-contrast colors | Navigation selection changes colors immediately; its settled colors already meet contrast |

Earlier base CSS contains superseded table colors. The final computed table header/secondary-cell rules, rather than those earlier declarations, determine actual contrast. This pass did not report every historical literal as a visible defect.

The replacement color pairs calculate to 6.15:1 for shift helper copy, 6.31:1 for CSV guidance, 4.58:1 for category text, 3.75:1 for control boundaries against white, and 9.55:1 for sidebar focus against forest. These are source-color calculations; final hosted inspection must also check actual backgrounds, clipping and rendered states.

## Automated scope

The database-connected owner scenario runs against a disposable loopback Supabase fixture, never the hosted test account. It checks:

- axe WCAG 2 A/AA, 2.1 A/AA and 2.2 AA rules on sign-in, an active checkout cart, and all nine owner screens at desktop and 320 CSS pixels.
- Skip-link destination, sidebar focus contrast, form boundary contrast, current navigation/category state and focus after screen changes.
- Named table scroll regions and minimum target sizes for cart controls.
- Product-tile pointer activation and visible keyboard focus after separating the product information from its Add button. Catalog information retains full contrast even before a shift opens.
- Page containment at 640 and 320 CSS pixels, plus forced-color/reduced-motion emulation on each owner screen.

The 640px width exercises the reflow width of a 1280px window at 200% zoom. It does not prove that the in-app browser changed its actual zoom level. Its zoom shortcut left reported viewport/device scale unchanged. Forced-color emulation is similarly distinct from testing a physical Windows contrast theme.

Final verification: [GitHub Actions 39971801627](https://github.com/jhonny8765/agristore-pos/actions/runs/39971801627), source `0581345`, passed type checks, lint, 56 unit tests, eight practice-browser scenarios, 98 pgTAP assertions, the restore drill and five database-connected browser scenarios. All 20 scoped axe scans returned no violations for the selected rule tags. Within that scoped ruleset, no rules were disabled and no elements were excluded.

Automation cannot prove accessible task completion with every assistive technology. Method references: [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing), [browser emulation](https://playwright.dev/docs/emulation), and [WCAG non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Scoped manual evidence

The final preview's separate practice database accepted a click on the product tile's upper corner and added exactly one item. Removing it returned the cart to empty; no practice sale was completed or uploaded. The focus outline remained outside the complete tile at desktop, 390px and 418px widths, with no horizontal page overflow. A keyboard-only skip-link check showed its 47px-high visible target at the top of the viewport; Enter focused the main landmark. Selecting Sync center focused its heading, exposed the current-page state and kept its 320px layout contained.

A fresh visual reviewer returned **ship** with no material fixes for these captured checkout refinements. That verdict covers the supplied desktop/mobile/user-width evidence and preserved design, not untested assistive-technology task completion.

The stable protected staging account then passed all nine screen-navigation checks at 418px: each new heading received focus, page width stayed contained and present table wrappers had names/keyboard entry points. Sync center also remained contained at 320px. Hosted measurements confirmed a 40px branch picker, 24px square checkbox and the new `rgb(122,136,115)` field boundaries. The Checkout control's visible and accessible text both read “Checkout POS.” No browser warnings/errors were recorded during this pass. No hosted sales, stock changes or shifts were created.

The downloaded update required opening a fresh tab at the same origin because the existing in-app tab kept its older shell after a normal reload. The owner account and both earlier test receipts remained available and synchronized, with the local queue clear; no site data was cleared. This is recorded as a browser-update limitation, not a passed automatic-restart test.

Heuristic scores use 0–4 (4 means no material finding in the stated scope), not a conformance certificate:

| Dimension | Score | Evidence and limit |
|---|---|---|
| Accessibility | 3/4 | Keyboard paths, stronger contrast, semantics and automated-rule coverage; actual screen-reader completion remains |
| Performance | 2/4 | Optimized shell/build and bounded reads; no new field latency or memory measurement |
| Responsive behavior | 3/4 | Narrow reflow and captured desktop/phone layouts; real browser zoom and chosen hardware remain |
| Theming | 3/4 | Incumbent palette preserved, explicit system-color cues; physical Windows contrast theme remains |
| Integrity and recovery | 3/4 | Existing transaction/recovery regression gates retained; timed outage/reboot/pilot gates remain |

## Remaining acceptance work

On the selected Windows cashier PC, use the installed Edge PWA to complete checkout, correction and owner workflows with keyboard and a screen reader. Check real 200% zoom and a Windows contrast theme, including focus visibility, announcements, table scrolling, error recovery and cash reconciliation. Repeat with real staff terminology and actual branch data. The existing outage, reboot, backup and pilot gates remain required.
