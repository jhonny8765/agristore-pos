---
name: "Better Yield POS (AgriStore)"
description: "The user-pinned Roboto, forest-rail and warm-paper operational workspace."
colors:
  forest: "#043c28"
  forest-dark: "#033326"
  green: "#176333"
  lime: "#e6f3d5"
  paper: "#f8f5ef"
  white: "#fff"
  ink: "#080b09"
  muted: "#535653"
  line: "#deded8"
  control-line: "#7a8873"
  soft: "#edf5e4"
  amber: "#865b16"
  danger: "#a3312b"
  focus: "#507c39"
  primary-hover: "#285441"
  good-bg: "#e8f5d9"
  good-text: "#073b14"
  warning-bg: "#fff0c7"
  warning-text: "#664100"
  info-bg: "#dfedff"
  info-text: "#064176"
  local-bg: "#eef2e9"
  local-text: "#3e5545"
typography:
  headline:
    fontFamily: "\"Roboto Variable\", sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.16
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "\"Roboto Variable\", sans-serif"
    fontSize: "28px"
    fontWeight: 760
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  subheading:
    fontFamily: "\"Roboto Variable\", sans-serif"
    fontSize: "22px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "\"Roboto Variable\", sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.4
  control:
    fontFamily: "\"Roboto Variable\", sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.3
  ledger-label:
    fontFamily: "\"Roboto Variable\", sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  metric:
    fontFamily: "\"Roboto Variable\", sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.2
  metadata:
    fontFamily: "\"Roboto Variable\", sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  category: "6px"
  badge: "8px"
  control: "9px"
  tab: "10px"
  phone-panel: "13px"
  inventory: "14px"
  strip: "15px"
  panel: "16px"
spacing:
  tight: "8px"
  small: "12px"
  record-gap: "14px"
  form-gap: "16px"
  product-row: "18px"
  panel: "22px"
  checkout-gap: "24px"
  workspace: "26px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.forest}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline-hover:
    backgroundColor: "{colors.soft}"
  button-ghost-hover:
    backgroundColor: "{colors.soft}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
    height: "44px"
  panel:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  status-good:
    backgroundColor: "{colors.good-bg}"
    textColor: "{colors.good-text}"
    rounded: "{rounded.badge}"
    padding: "6px 12px"
  nav-active:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.forest}"
    rounded: "{rounded.tab}"
    padding: "11px 16px"
    height: "51px"
---

# Design System: Better Yield POS (AgriStore)

## Overview

**Creative North Star: "The Supplied Better Yield POS Screens"**

The supplied November 3, 2026 screenshots are the visual authority: reproduce their heavy Roboto hierarchy, forest navigation, warm paper, pale green selections, strong figures and specific register/detail compositions. The eight distinct supplied compositions replace the former Manrope/DM Sans operational interpretation; they do not invite a new concept or generic dashboard treatment.

This is a readable working counter: product identity and prices, original cash receipts, stock ledgers and actual workflow stages remain visible in a stable shell. Actual Better Yield artwork and verified photographs occupy the reference media slots. Unverified-photo fallbacks, unavailable information, Practice and TEST labels remain explicit.

Better Yield POS is the customer-facing identity; AgriStore remains the repository identity. Original logo, business photograph and tagline provenance remain in [docs/brand-assets.md](docs/brand-assets.md). Sign-in retains its existing Manrope Variable headings and DM Sans Variable body; those font imports are intentional.

**Key Characteristics:**

- Fixed forest rail and white branch bar on warm paper.
- Heavy Roboto headings, dark figures and quiet metadata.
- Reference-specific registers, selected details, photo cards and shallow summary strips.
- Pale green selections, restrained gradients and soft structural depth.
- Truthful states, inspectable original IDs and contained phone ledgers.

**The Pinned Composition Rule.** Follow the supplied arrangement and hierarchy. Adapt actual data and permissions within its slots; do not substitute a new visual world.

## Colors

Deep agricultural forest anchors warm paper, white records and pale leaf selections. Frontmatter owns reused primitives; the sidecar preserves full gradients and depth that the compact schema cannot express. Primary and active-nav background tokens are portable solid fallbacks; their complete implemented gradients are in the sidecar snippets.

### Primary

- **Forest / Deep Forest:** navigation, primary actions, financial and price emphasis.
- **Working Green:** supporting action emphasis.
- **Pale Leaf / Soft Leaf:** navigation selection, helper surfaces and secondary-action hover.

### Neutral

- **Warm Paper:** workspace ground; **White:** branch bar, fields and record/product panels.
- **Stock Ink:** headings, identity and strong figures; **Muted Ledger:** supporting descriptions and scope.
- **Fine Rule:** panels and record separators; **Control Rule:** stronger field boundaries.

### State colors

- **Good Leaf:** actual approved/success states with meaningful words/icons.
- **Stock Amber / Warning:** low stock, offline or attention context.
- **Correction Red:** errors, rejected quantities and guarded destructive commands.
- **Information Blue:** informational badges; **Local Neutral:** local/practice records.
- **Focus Green:** visible keyboard outline; pale leaf supplies focus contrast on the rail.

**The State Has Meaning Rule.** Color, icon and words describe the actual recorded state. Pale green alone does not certify synchronization, approval or reconciliation.

## Typography

**Display and Body Font:** self-hosted Roboto Variable (installed package version 5.3.0), with sans-serif fallback, across the operational workspace. Heavy plain sans headings and generous figures reproduce the supplied references.

### Hierarchy

- **Headline:** frontmatter page-heading role; reduces to (30px) on phones.
- **Heading / Subheading:** frontmatter panel/section roles. Contextual panel headings use (23–28px). Selected receipt identity uses (36px), reducing to (29px).
- **Body / Control:** frontmatter operational baseline and default command type. Phone baseline/fields use (16px).
- **Ledger label:** frontmatter header role; receipt register headings use (20px), reducing to (17px). General cells use (17px); compact inventory/queue rows use (16px).
- **Metric:** frontmatter reusable summary role. Overview figures use (32px), receipt metrics (28px), sync counts (40px), change (28px). Wide monetary values use (26px), reducing to (25px) on phones.
- **Metadata:** frontmatter supporting scope role; important state labels remain (15–18px).
- **Product identity:** catalog names use (20px, weight 750, line-height 1.2), reducing to (18px); prices use (25px, weight 800), reducing to (23px).

**The Intact Figure Rule.** Use tabular numerals and right-aligned numeric columns. Keep monetary values on one line; labels may wrap, digits may not.

**Thermal-print exception:** dedicated sale receipts use black Arial, Helvetica, sans-serif on white, with (12px) body type, (20px) Better Yield identity and (15px) total. This intentional print-specific typography is outside the Roboto workspace identity; print measurement and output share the same styles.

## Layout

At the (1536px) reference width the fixed forest rail is (256px), white branch bar (72px), and main padding (26px 20px 30px 26px), placing titles at x(282px). Main destinations sit above, Sync center / Settings below. Header retains branch identity, connection, direct close-shift access and account context. Magpet is the sole enabled business branch; practice context is labeled.

The rail narrows to (210px) at (1200px), an icon rail (76px) at (1000px), and (61px) at (650px). Phone main padding is (20px 14px); branch bar, headings and actions wrap. Accessible destination names remain when labels are visually hidden.

- **Checkout:** searchable catalog and top-aligned sale (454px), gap (24px); three product columns with gaps (18px vertically, 14px horizontally). At (1001–1350px), sale is (390px) and catalog two columns; at (1000px), sale is (340px). At (650px), catalog is one column and sale follows it. Cards are at least (277px) desktop / (230px) phone; contain-fit media (166px) / (145px). Ordinary pack lines stay compact; configured weight/peso options expand when needed. Preserve fixed phone Review sale access.
- **Sales & receipts:** register/detail columns (minmax(0, 1.48fr) / minmax(380px, 1fr)), gap (14px). Detail is top-aligned and sticky at (20px). At (1200px), columns become (1.4fr / minmax(330px, 1fr)); at (1000px) they stack. Preserve selected-receipt access, original-ID disclosure, media rows, cash/change and Print.
- **Inventory:** shallow four-part strip, wrapping tabs, filters, then one media/product ledger with separate selling-unit and price columns. Phone summary stays two-by-two; ledger scrolls inside its region. Follow-ups stack: icon/title first row, full-width description second, View details third.
- **Overview / analytics:** four KPIs, chart/attention pair (1.45fr / 1fr), gap (20px), then lower panels (1.25fr / .87fr / 1fr). At (1350px), lower row uses two columns with first spanning; at (1000px), chart/lower panels stack and KPIs use two columns; phone KPIs stack. Preserve real trend dates, product/media rows and scope caption; unavailable reconciliation stays explicit.
- **Purchasing / orders:** tabs and three KPIs before separate list/detail panels (1.25fr / 1fr), gap (16px), stacking at (1000px). Each product retains its own accepted, held, rejected and unreceived quantities. Four quantity tiles become two columns on phones; actual required decisions may lengthen the detail beyond the sample.
- **Physical counts:** warning, three numbered stages/arrows, tabs, entry/checklist pair (1.35fr / 1fr), gap (16px), then open-count ledger. Pair stacks at (1000px), stages at (650px). Product photo, notes, true stage badges and original IDs stay readable; blind expected stock remains private.
- **Sync center:** truthful summary plus three KPIs, tabbed/searchable queue, paired recovery cards with icon/copy/adjacent action. Desktop cards have (125px) minimum height; selected-file/download feedback expands beneath. At (1000px), summary stacks and recovery actions move below copy; phone recovery cards stack with full-width action. Queue rows retain inspectable/copyable full original IDs.
- **Settings:** main/support columns (1.9fr / 1fr), gap (18px). Left branch/shift pair above staff; right recovery/registered-PC stack. At (1350px), main regions stack and support panels pair; on phones all panels stack. Unavailable cash, staff and PC details stay explicit.
- **Clients & credit:** client register beside the selected account (minmax(280px, .8fr) / minmax(0, 1.4fr)), gap (18px), with four scoped totals above. At (1200px), account panels stack and totals use two columns; at (650px), totals stack. Client, invoice and Payments ledgers remain named focusable scroll regions; phone tables retain a (520px) minimum width inside the panel. Long booklet, original-sale and payment references wrap within their record.

Records use ten-row pages. Footers show matching loaded count and page state for zero to ten records; larger lists expose controls above and below. Paging changes presentation only, preserving loaded search scope, totals, exports and pending-work checks. Type-to-search filters update immediately and product selectors support keyboard choices.

Wide ledgers remain named keyboard-focusable scroll regions with native table semantics and right-aligned quantities; phone hints explicitly announce sideways scrolling. Minimum widths at (1000px) and below: receipts/orders (700px), queue (980px), counts (1050px), inventory (1180px). The page itself must not overflow. Inherited stock-control approval records stack at (720px); inherited mobile basket access begins at (730px).

Sign-in keeps its established two-column identity/form layout above (730px), form bounded to (365px), and compact form-led mobile identity below. Do not migrate this separate surface implicitly.

Dedicated sale receipts use a (58mm) roll with (48mm) content and (5mm) paper margins. Page height follows measured content rather than a fixed blank roll length. Names and full transaction IDs wrap; monetary amounts stay intact. Line groups, totals and footer avoid internal breaks. This paper layout does not add a second screen layout.

## Elevation & Depth

White surfaces, paper and rules carry most depth. Tiny resting shadows and restrained forest gradients reproduce the supplied material; stronger depth belongs to transient feedback and popovers.

### Shadow Vocabulary

- **Working surface:** `0 2px 3px rgb(24 43 21 / 3%)`, ordinary panels/products.
- **Product hover:** `0 6px 16px #23352b0b`, with stronger border.
- **Period popover:** `0 6px 20px rgb(3 44 22 / 15%)`.
- **Product selector:** `0 8px 24px rgb(23 62 50 / 14%)`.
- **Operational notice:** `0 4px 18px rgb(3 44 22 / 15%)`.

**The Quiet Depth Rule.** Use small soft shadows and tonal boundaries for working surfaces. Reserve stronger depth for notices and popovers.

Buttons transition background/color (160ms, ease); product borders/shadows (180ms, ease). Do not add entrance choreography. Reduced-motion preference disables animation, transitions and smooth scrolling. Selection, caret and thin scrollbars stay themed; forced-colors mode uses system control boundaries and focus colors.

## Shapes

Soft rectangular surfaces dominate. Frontmatter distinguishes category chips, badges, controls, tabs and larger panels. Panels/products use the panel radius; phone panels use the smaller phone-panel radius. Inventory retains its rounded ledger and shallow divided strip. Count-stage and sync circles convey workflow/status. Contain-fit media preserves package silhouettes.

Fine rules separate records; fields and outlined commands use stronger boundaries. Selected ledger cells form one pale green band with rounded end cells. Selected destinations use broad pale leaf rectangles.

## Components

### Buttons

Firm, legible commands use the frontmatter geometry. Heading commands use (17px) type and (42px) minimum height; small commands (16px) / (34px). Primary uses the exact forest gradient in the sidecar and inherited solid hover. Outline uses white/forest and muted green stroke; outline/ghost hover uses soft leaf. Destructive commands retain original permission/confirmation guards. Complete sale spans the panel at (54px); Print at (52px). Disabled commands retain their label with reduced opacity.

### Inputs / Fields

White bounded fields use the control radius and (44px) minimum default height. Checkout search is (50px), with icon and a clear/reset control when populated. Real labels remain accessible. Product combobox/listbox supports Arrow Up/Down, Enter and Escape. Focus uses (3px) outline, offset (3px), with inward clearance for table actions. Retain skip-link and heading/main focus behavior.

### Navigation / Tabs

Desktop destinations use (20px) labels, (27px) line icons, (51px) rows. Active nav has pale green gradient, dark text and stronger weight. Responsive icon-only destinations retain accessible names. Workspace tabs wrap, active forest/white, and support Arrow Left/Right plus Home/End; category filters retain compact horizontal scrolling.

### Status Chips

State words and meaningful line icons distinguish local, confirmed, warning, refund and information states. Title-level Cash sales only / Shift open badges stay prominent; current-sale cash badge is smaller. Practice/local state remains explicit; text may wrap while monetary figures stay intact.

### Cards / Containers

White outlined surfaces use panel padding/radius and the tiny working shadow; phone padding is (17px). Summary tiles pair pale icon blocks and strong figures; inventory joins its cells into one shallow strip. Empty, loading/error, stale-snapshot and unavailable states preserve their intended slots and real next actions.

### Product / Receipt Identity

Use verified existing photography with contain fit, otherwise clear Photo not verified fallback in the same media slot. Preserve name, selling unit, stock, intact price and configured weight/peso options. Existing catalog raster provenance remains adjacent to shipping assets, including the 62 catalog-photo sidecars; no generated or changed catalog raster belongs to this rebuild. Receipt/order/overview slots reuse truthful identity. Concise display IDs may lead, but full original IDs remain inspectable and wrap safely when opened.

### Thermal sale receipts

Use the dedicated receipt surface for completed-sale printing and history copies. The header retains **Better Yield / Agri Trading and Services** and the original branch context independently of a legacy organization label. **PRACTICE ONLY · NO REAL SALE** appears only for practice; history reprints carry **COPY** and the original sale status.

Retain original item identity, quantity/unit/price, line discounts, net line amounts and full transaction ID. Show gross subtotal and discount reduction when present, then total, cash tender and change; credit records use cash paid and balance on credit. The footer includes the internal sale-record wording and one authorized manual VAT booklet note, without invented fiscal identity. Print contains no till controls or product photos. Its body-level portal mounts at `beforeprint` and is removed after `afterprint`, leaving ordinary screen composition intact.

### Product discounts

Owner/cashier sale lines place a compact **Discount %** field at the upper right beside product identity. Keep the decimal entry right-aligned (80px wide), with a visible label and product-specific accessible name. It accepts (0–100%) with at most two decimal places. Fields retain (40px) minimum height, increasing to (44px) on phones; product names wrap alongside them without widening the sale panel.

For a discounted line, retain **Before discount**, the percentage and reduction, and the net line total. Cash checkout separates **Subtotal**, **Product discounts** and **Amount due**; credit checkout identifies **Product discounts included** before its net sale total. Invalid percentages retain the entered draft, expose an associated inline error and invalid field boundary, and block cash and credit completion until corrected. Preserve the forest/paper hierarchy and intact monetary figures.

### Ledgers / Recovery / States

General headers are pale green; receipt register headers are white with stronger amounts. Footer count/page state describes loaded scope. Recovery retains icon/copy/action hierarchy, accessible file chooser, selected-file/download feedback, privacy disclosure and guarded logic. Saved-local is not synchronized; unavailable reconciliation is not a balanced drawer. Preserve original financial commands and authorization.

### Clients & credit

Extend the same forest/paper register and detail language. Invoices, Payments and Statement use wrapping command groups; selected records retain pale leaf emphasis. Checkout keeps the existing catalog/current-sale composition and exposes the client, approved calendar-day term, exact due date, cash paid now and remaining balance before completion.

Keep Outstanding, Overdue, Original credit sales and Net cash collected distinct, with the account scope and Asia/Manila snapshot alongside them. Aging labels describe days past the due date separately from the payment term. Loaded-invoice counts and export/statement wording must preserve their actual scope.

Historical opening records keep **Opening unpaid amount** and imported-balance context separate from original credit sales. Unknown dates remain **Unconfirmed**, with a separate **Due date unconfirmed** aging bucket; missing original terms remain **Term not supplied**. Disabled clients show **Not enabled / Terms not approved**, without suggesting an approved term. Owner date confirmation stays in an inline **Confirm historical due date** disclosure with the actual agreement date, evidence reference, reason and acknowledgement. Imported records without original goods expose no goods-return command.

Credit records, payment acknowledgements and statements retain the linked authorized manual booklet number and explicit internal-document wording. Each payment has its own print command and permanent reference; payment printing isolates that event. Statement printing removes interactive chrome and renders all loaded invoices and events. Preserve long-reference wrapping in screen and print views. The local extension's current operating and release limits remain in [docs/customer-credit.md](docs/customer-credit.md).

## Do's and Don'ts

### Do:

- **Do** follow each supplied composition within the shared Roboto, forest and warm-paper shell.
- **Do** use verified media or a clear Photo not verified fallback in the intended slot.
- **Do** keep monetary values intact, numerical columns aligned and product units explicit.
- **Do** retain full original transaction, receipt, count and order IDs through concise disclosures.
- **Do** retain loaded scope, sync context and ten-row page summaries without changing totals or exports.
- **Do** retain keyboard search, named table regions, visible focus and mobile sale/receipt access.
- **Do** retain truthful empty, unavailable, Practice and TEST states and guarded commands.

### Don't:

- **Don't** revert the operational workspace to the former Manrope/DM Sans world or invent a new concept.
- **Don't** replace reference register/detail arrangements with generic stacked dashboard cards.
- **Don't** copy sample products, prices, stock, balances, staff or branch names into real records.
- **Don't** hide original IDs, unit differences or weight/peso options to achieve visual similarity.
- **Don't** imply local records are synchronized, drawer cash is reconciled or a receipt is a tax invoice.
- **Don't** widen the phone page for a ledger or compress monetary digits to fit.
- **Don't** migrate sign-in fonts and brand treatment implicitly.
