---
name: Better Yield POS (AgriStore)
description: A cooperative stock book for practical cash checkout and traceable inventory.
colors:
  forest: "#173e32"
  green: "#31604c"
  lime: "#dfebce"
  paper: "#f6f7f2"
  white: "#fff"
  ink: "#23352b"
  muted: "#667468"
  line: "#e3e7dd"
  control-line: "#7a8873"
  soft: "#edf1e7"
  amber: "#865b16"
  danger: "#a3312b"
  focus: "#507c39"
typography:
  headline:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "29px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "18px"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"DM Sans Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"DM Sans Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.5
rounded:
  tag: "4px"
  field: "7px"
  control: "8px"
  product: "10px"
  panel: "12px"
spacing:
  compact: "6px"
  control: "12px"
  form: "18px"
  receipt: "22px"
  panel: "25px"
  workspace: "36px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "43px"
  button-primary-hover:
    backgroundColor: "#285441"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.forest}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
    height: "43px"
  panel:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "25px"
---

# Design System: Better Yield POS (AgriStore)

## Overview

**Creative North Star: "The Cooperative Stock Book"**

The cooperative stock book pairs forest ink with warm paper, quiet rules, and precise figures. It feels practical and orderly for cashiers completing sales and owners tracing stock changes to their source.

Compact sans-serif typography and restrained tonal surfaces keep operational information close together. Flat category illustrations identify agricultural goods; borders and alignment organize the work rather than decorative effects.

Better Yield POS is the customer-facing identity for Better Yield Agri Trading and Services; AgriStore remains the internal product identity. The original business logo and product-display photograph from the supplied Facebook page extend this established world on sign-in and navigation. The public tagline, “Your partner in every harvest.”, and crop nutrition / crop care context identify the business; configured branches, stock and prices remain operational records. Asset provenance is recorded in [docs/brand-assets.md](docs/brand-assets.md).

**Key Characteristics:**

- Forest navigation and primary actions against warm paper.
- Ruled records, aligned figures, and explicit operational states.
- Compact controls with rounded corners and clear focus outlines.
- Original Better Yield business artwork on sign-in and navigation, with photography limited to desktop sign-in.

## Colors

The palette carries agricultural familiarity through forest and pale leaf greens, with warm, near-white operational surfaces.

### Primary

- **Forest:** navigation rail, primary actions, selected category filters, totals, and price emphasis.
- **Working Green:** icons and supporting action emphasis.
- **Pale Leaf:** active navigation and completion feedback.

### Neutral

- **Warm Paper:** the application canvas.
- **White:** fields, catalog products, record panels, and the branch bar.
- **Stock Ink:** primary text and record values.
- **Muted Ledger:** secondary descriptions and supporting operational copy.
- **Fine Rule:** panel outlines and table or receipt separators.
- **Control Rule:** visible boundaries for fields, search, and quantity controls; keep these stronger than record separators.
- **Soft Leaf:** restrained control backgrounds and hover surfaces.

### Operational colors

- **Stock Amber:** low stock, offline connection, and attention states.
- **Correction Red:** destructive actions and error emphasis.
- **Focus Green:** keyboard focus outlines.

History tables use Stock Ink for column headers and Muted Ledger for supporting identifiers, preserving a clear hierarchy between scan labels, record values, and references.

Use Muted Ledger for placeholders and unselected category text. Working Green supplies text on tinted helper and code surfaces. These supporting roles retain their contrast without competing with primary values.

**The Forest Anchor Rule.** Use forest for navigation, selected category filters, primary actions, and financial emphasis; use pale green for selected navigation and supporting surfaces.

## Typography

**Display Font:** Manrope Variable, with sans-serif fallback. It supplies headings, the wordmark, and prominent financial figures.

**Body Font:** DM Sans Variable, with sans-serif fallback. It supplies controls, tables, product names, and supporting text.

**Character:** A compact, approachable sans-serif pairing. Manrope adds a firm heading structure without introducing an editorial display style; DM Sans keeps repeated operational labels familiar.

### Hierarchy

- **Headline:** the frontmatter headline role is the desktop page heading; it reduces to (25px) at the mobile breakpoint.
- **Title:** the frontmatter title role is the ordinary section heading. Smaller subsection headings use Manrope at (15px), while receipt headings use (16px).
- **Body:** the frontmatter body role is the inherited application baseline. Product names use DM Sans at (14px), weight (700), with line-height (1.35).
- **Label:** the frontmatter label role represents form labels. Checkout metadata commonly uses (11px); category filters use (12px) on desktop and (11px) on mobile.
- **Figures:** totals use Manrope at (26px) and summary metrics at (28px) on wide screens. These are local financial emphasis roles rather than a large display scale.

**The Precise Figures Rule.** Keep tabular numerals throughout the interface and right-align numerical table columns so quantities and money can be scanned vertically. Show bulk on-hand stock in exact base kg or liters across all batches; show piece-pack equivalents only when whole, otherwise retain base pieces, so small stock changes remain visible.

Align quantity column headers with their right-aligned values, including receiving line counts, transferred quantities, and physical-count figures.

## Layout

The desktop shell uses a fixed forest rail (220px) and a white branch and connection bar (73px tall). The workspace has horizontal gutters (36px) and a maximum content width (1900px). The rail narrows at (1250px), becomes an icon rail at (950px), and reaches (61px) at the mobile breakpoint.

Checkout pairs a flexible searchable catalog with a persistent receipt column (335px), separated by a gap (27px). The receipt is sticky with a top offset (22px). The product grid has three columns by default, two below (1250px), and four from (1600px); receipt width and spacing adapt at the same breakpoints.

At (730px) and below, checkout stacks into one column, retains a two-column product grid, and places the receipt below the catalog. A fixed forest basket summary near the bottom edge exposes the current total and a Review sale anchor. Checkout reserves bottom space (88px) for it. The icon rail remains present. General form grids and paired panels collapse to one column.

Sign-in uses two equal columns above (730px): a forest identity panel and a centered form bounded to (365px). At (730px) and below, the identity panel and its photograph are hidden; the form shows the compact Better Yield identity and remains the primary task. This brand treatment retains the existing operational checkout composition.

Spacing is compact and contextual, using the repeated frontmatter steps rather than a uniform large-card rhythm. Tables remain horizontally scrollable; numeric columns align right. Panel supporting prose is bounded to (72ch).

Inline forms inside tables size to the available table viewport, wrap their copy and actions, and retain clearance for the shared focus outline. Expanding a row action keeps horizontal overflow inside the record panel.

History registers retain the branch bar, connection state, navigation, and main operational task within the existing shell. Date filters, footer copy, and action groups wrap at narrow widths. Keep wide records scrolling inside their panel; each history table viewport is a named, keyboard-focusable region with the shared visible focus outline.

All record table viewports share named, keyboard-focusable scrolling regions. Narrow page headings wrap their actions beneath the heading instead of widening the workspace.

## Elevation & Depth

The application is flat at rest: thin borders, pale fills, and forest navigation establish hierarchy. Product hover receives a faint lift; the fixed mobile basket uses a stronger ambient shadow to remain distinguishable over scrolled content. Other record panels have no resting shadow.

### Shadow Vocabulary

- **Product hover** (`0 6px 16px #23352b0b`): subtle response on available product records.
- **Mobile basket** (`0 8px 24px #173e3233`): separates the fixed checkout summary from content behind it.

**The Ruled Record Rule.** Separate record rows, receipt sections, and workspace regions with fine rules; retain tonal surfaces as the primary means of grouping.

## Shapes

Corners are softly rounded, with the frontmatter field and control radii for interactions, product radius for catalog items, and panel radius for records and receipts. Small tags have the tighter tag radius. Outlines are generally (1px); the receipt total uses a dashed separator as a paper-record cue. Circular avatars and completion marks are specific identity and feedback shapes.

## Components

### Business Identity

Use the original local raster logo from `apps/web/public/brand/better-yield-logo.jpg` beside the Better Yield name and POINT OF SALE descriptor. The image preserves its full artwork with contain sizing, a white backing, and a (4px) corner radius. Its displayed size is (72px square) in desktop sign-in, (64px square) in mobile sign-in, and (42px square) in navigation. At the icon-rail breakpoint, the adjacent wordmark text hides while the logo and accessible home name remain.

The local business photograph at `apps/web/public/brand/better-yield-display.jpg` appears only in the desktop sign-in identity panel. It spans the panel's available content width with height `clamp(180px, 24vh, 260px)`, cover cropping centered at (60%) vertically, and (8px) corners. Keep its descriptive alternative text and “From the Better Yield team” caption. The official Facebook link belongs beneath this sign-in identity content. These sourced images establish business identity; catalog tiles retain their existing category artwork.

### Buttons

Compact and decisive. The primary, outline, ghost, and destructive variants share the same rounded control shape, weight (650), gap (9px), and minimum height (43px). Their padding is defined in frontmatter. Small buttons reduce to (34px) minimum height and (7px 11px) padding; icon buttons are (40px) wide.

Primary hover darkens the forest fill. Outline and ghost hover use Soft Leaf. Disabled buttons reduce opacity to (0.5) and use a not-allowed cursor. Button color transitions last (0.16s) with ease timing. All interactive controls receive a Focus Green outline (3px), offset (3px), on keyboard focus.

The forest sidebar uses Pale Leaf for its focus outline. A focused product Add action outlines its entire parent record. The skip-to-content link appears on focus and uses an inset outline offset (-5px), keeping the ring inside the viewport.

Respect reduced motion globally by removing animations and transitions and using automatic scrolling. In forced-colors mode, use system ButtonText for field boundaries and selected navigation/filter borders, and Highlight for focus outlines. Selection remains explicit through a border as well as state semantics.

### Chips

Category filters use compact rounded rectangular buttons, with transparent default surfaces and forest selected fill. Expose the active filter through its pressed state. Status tags are quiet, compact labels with Soft Leaf default, amber warning, and pale green success variants. Status text carries the meaning alongside color.

### Cards / Containers

White record panels use the panel radius, a Fine Rule outline, and panel spacing. On mobile the panel padding reduces to (18px). Product records are semantic articles with the product radius and a flat tinted category strip with a line SVG icon; their name, unit, price, and available stock remain in the content area. The primary product action explicitly names its selling unit, such as Add Sack or Add 1 kg. This full-width action has a minimum height (36px); keyboard focus also outlines the parent article. Product hover changes the outline and adds the subtle elevation above.

Configured loose-kilo products add a ruled group beneath the stock line with the independent retail price per kg, By weight, and By peso amount. These separate bordered actions wrap within the tile and retain a minimum height (36px). Keep each action's accessible name specific to its product and selling method; the article itself remains a record rather than a single overlapping click target.

When adding is unavailable before a shift opens or in the stock view, change only the Add control's surface and text. Keep product metadata fully legible; do not dim the whole article.

### Inputs / Fields

White fields have the stronger Control Rule border, the field radius, and the padding defined in frontmatter. Labels sit above their fields with a gap (6px). Search is a bordered container with an inline icon and a borderless text input. Quantity steppers share the stronger boundary and keep editable text wide enough for decimal and fraction entry. Each quantity has a visible label naming its selling unit; the kilo/gram choice remains beside the field. Quantity and customer-budget accessible names retain the displayed unit or peso currency and identify the product. Preserve incomplete input while the cashier types, associate blocking feedback with the affected field, and keep the receipt in view. Cash received is right-aligned and enlarged to (17px). Disabled fields use a subdued pale surface. Checkboxes use a (24px) square control.

### Product Setup

Use the shared two-column form, collapsing to one column on mobile. Begin with product identity and How customers buy this product, offering Sacks / bags, Loose kilos only, Sealed items / pieces, Measured liters, and Other pack size. Reveal the relevant selling-unit name, pack conversion, and explicitly labeled price and cost fields after the setup is selected. Currency belongs in the field labels.

Additional loose kilos, measured liters, or individual pieces are an explicit checkbox choice for packed goods. Place their separate retail price and cost fields beneath the opt-in, beside guidance that retail price is set independently rather than divided from the pack price. Summarize stock conversion and permitted quantity entry in a full-width block bounded by Fine Rules, using the muted helper type (12px) with line-height (1.6). Sealed individual items retain whole-piece guidance. Keep save errors beside the action as alert text and confirmed success beneath the form as status text; preserve entered values on failure.

### Navigation

The rail uses Forest with muted pale text and line SVG icons. Active entries use Pale Leaf, forest text, and stronger weight. Hover uses a darker green tonal surface. Narrow layouts retain the icon rail and hide visible labels; accessible button names remain supplied by the application.

Expose the current destination with the current-page state and change navigation colors immediately so intermediate transition colors cannot obscure the label. Move keyboard focus to the main page heading only when the view changes; routine data updates retain the user's current focus. The skip link leads directly to the focusable main content.

### Current Sale

The receipt groups heading, items, and payment into ruled sections. Each line exposes its configured price and selling unit above an editable three-part quantity stepper. Loose kilo products additionally offer kilo/gram entry, a readable equivalent weight, and wrapping quarter-, half-, three-quarter-, and whole-kilo shortcuts. By weight and By peso amount remain explicit inline selling-method actions. Retain the selected retail kilo price when using these controls. Whole-piece goods keep their ordinary unit controls. Decreasing a quantity stops before zero; removal is a separately named action.

By peso amount expands an inline form within the affected receipt line, separated by a fine rule. Place the labeled customer budget beside Estimate weight, then explain that the whole-gram estimate must be weighed and the actual scale weight entered. Keep Confirm weighed amount and Cancel together beneath that guidance. Focus returns to the quantity field after an estimate. Preserve drafts and confirmation feedback when the operator changes application views. If the recorded weight exceeds the budget, state the resulting price and the next action locally.

Unfinished or invalid quantities and unconfirmed peso estimates show Correction Red field feedback and a receipt-level message, and disable cash completion. A newly opened weight or budget entry starts with a blank quantity; its unfinished line contributes no provisional kilo to Amount due. Amount due remains larger, forest-colored, and aligned opposite its label. The completion button spans the payment area. A completed sale replaces the editable receipt with explicit saved-state feedback; printed output isolates the receipt in an (80mm) column.

Receipt removal controls and unit selectors have a minimum target height (32px); removal controls also have a minimum width (32px). Quantity and peso controls wrap inside the receipt width, and the receipt item area expands with its content on narrow screens.

### Inline Approvals

Refund, recovery approval, and PC retirement expand into a reason form beside the affected record. Explain the consequence before the labeled reason field, then provide an explicit confirmation action and Cancel. Reuse the existing fields, buttons, and error notice. Opening brings the form into view and focuses its reason field; closing returns focus to the triggering action.

Keep the entered reason visible when validation or submission fails, associate the inline error with the field, and disable duplicate confirmation while pending. Clear the reason after confirmed success. Preserve these contextual forms instead of moving operational approvals into browser-native prompts.

### Receipt History

Keep confirmed receipts in the ruled table, with the loaded count and branch beside an explicit older-receipts action. Distinguish more available records from the end of history in text. Loading older records extends the existing list; offline and pending states disable the action.

### History Registers

Receiving, transfers, physical counts, and audit history share a ruled record panel. Place the branch scope and Asia/Manila date context beneath its heading; identify transfer dates as dispatch dates and other register dates as recorded dates. The audit scope also identifies business-level events.

Use labeled From date and Through date fields with explicit Apply dates and Clear dates actions. Keep draft field values separate from the applied range. The footer reports the applied range, loaded row count, and whether older records remain or matching history has ended. Loading older records appends to the visible list; a failed next-page request preserves the loaded pages and provides Retry history alongside its error.

The export action reads “Export loaded rows (CSV)” and nearby copy explains that it includes only rows loaded in the current register. Include branch scope in the export and retain the instruction to load older records before exporting more. Empty results offer another range or Clear dates; offline feedback explains that refreshing and loading older records require reconnection.

**The Traceable Stock Record Rule.** In transfer and count history, keep the lot and known expiry beside the product, name the base unit with every quantity, and keep the count reason beside its discrepancy and approval action. Resolve this context from the current product catalog; when batch details are unavailable, retain the recorded batch ID rather than borrowing another product's lot or implying that no batch was recorded.

Product, lot, expiry, and count reason wrap inside the first column while the named, keyboard-focusable table region retains horizontal scrolling. Lot, expiry, and reason inherit the register's readable type size (12px) and use Muted Ledger beneath the stronger product name. Keep numerical columns aligned independently of this wrapping context.

Transfer and count CSV exports retain product and batch IDs alongside the resolved product name, lot, known expiry, and base unit. Export quantities and signed count differences as numeric values in explicitly numeric columns; retain formula protection for free text, including product names, lot labels, and reasons.

Audit details expand through a native View details summary with the shared keyboard focus outline. Wrap the expanded detail content within its column instead of widening the page.

### Operational Feedback

Separate confirmation of a submitted action from the follow-up refresh of its records. Once a write is confirmed, retain its completion message even if refreshing fails. Use the existing error notice for a distinct warning that the action completed and the latest records could not be refreshed; direct the operator to reconnect and select Refresh, with an explicit instruction not to submit again.

Clear receiving, supplier, transfer, physical-count, and product forms only after confirmed submission; clear the opening-stock confirmation after its import is confirmed. Preserve entered values when validation or submission fails. Recovery approval likewise confirms the approved sale before requesting an updated stock snapshot. Opening-stock CSV preflight reports invalid files through the existing error notice and reveals the confirmation form only after validation succeeds.

Use local status text to describe the actual stage of an operation. Place accessible status feedback beside Check for app update in the Application & recovery panel. Distinguish checking and downloading, installation, no new download, pending work, failure, and reopening. No new download does not establish that the currently open window is running the latest installation. Keep the existing paired Settings panels and their narrow-screen stack; update feedback stays inline within its panel.

Disable starting or completing checkout while installation is in progress. Recheck that the cart and pending sales and operations are clear before reopening the requesting window. If work appears while an update becomes ready, direct the operator to finish checkout and confirm every pending record before manually reopening. Recovery guidance preserves saved local records and browser site data, gives a specific next step for the actual failure or delay, and never forces other windows to reload.

Expose owner-only PC setup recovery as an explicit outline action beside the retired registration in the existing Registered cashier PCs table. Require connectivity and a cleared basket and resolved pending records; explain that saved sales are retained and guide the owner to register a replacement. Keep recovery inside the shared table overflow and focus behavior, without clearing browser site data.

### Settings / Branches

The owner’s branch panel extends the existing ruled record surface. Rename fields retain branch-code labels and outline Save buttons; Add branch sits beneath that grid with a labeled name field and the shared forest primary action. Branch codes are assigned automatically. Names allow up to (120 characters). The rename grid collapses to one column on narrower layouts, and the addition form follows the shared responsive form layout.

Creation requires an online connection and is disabled during practice or another pending operation. Keep feedback beside the form: the button reads “Adding branch…” while pending, errors use the existing error notice and preserve the name, and confirmed success clears the field before refreshing the branch list. If confirmation is uncertain, feedback directs the owner to the Sync center, where the original request can be recovered; if only the list refresh fails, retain the success message and offer Refresh. Use explicit local text and the existing status colors so the outcome stays visible within the branch panel.

The Current branch picker in the top bar changes the displayed branch and its stock together after the selected branch’s data finishes loading. A failed download retains the previously loaded branch selection. Disable live branch switching while offline, during an active cashier lease, or while another operation is pending, and confirm a successful change with “Branch stock loaded.”

Keep the top-bar branch picker at a minimum height (40px) across viewport sizes.

## Do's and Don'ts

### Do:

- **Do** retain the original Better Yield logo artwork and use the sourced business photograph only on desktop sign-in.
- **Do** use the shared forest, paper, ink, muted, and rule tokens for new operational surfaces.
- **Do** keep currency and quantities aligned and retain tabular numerals.
- **Do** label selling units explicitly, preserve quantity drafts, and keep peso estimates blocked until actual weighed amounts are confirmed.
- **Do** expose configured loose selling methods in catalog records and retain displayed units and currency in field accessible names.
- **Do** keep additional retail units opt-in, price them independently, and show stock conversion beside product setup.
- **Do** provide a visible focus outline and explicit text for connection, stock, and save states.
- **Do** preserve the responsive receipt access and fixed mobile basket summary on checkout.
- **Do** keep approval reasons, errors, and keyboard focus within the affected record, with forms contained inside horizontally scrolling tables.
- **Do** give history table scrolling regions accessible names, keyboard access, and the shared visible focus outline.
- **Do** keep transfer and count context readable beside its record, with explicit base units and traceable identifiers in CSV exports.
- **Do** retain stronger control boundaries, surface-appropriate focus outlines, and explicit current or pressed states.
- **Do** keep catalog metadata legible when adding is disabled, with only the Add control changing appearance.
- **Do** keep applied dates, loaded counts, end-of-history feedback, and CSV scope explicit beside the records they describe.
- **Do** keep app update status beside its action, protect pending work before reopening, and preserve local records and browser site data in recovery guidance.
- **Do** retain confirmed completion feedback alongside a distinct Refresh warning, clear confirmed forms, and preserve entered values on validation or submission failure.

### Don't:

- **Don't** infer catalog stock, prices or configured branches from public brand photography or marketing information.
- **Don't** substitute emoji or text glyphs for the existing line SVG icon vocabulary.
- **Don't** turn operational surfaces into decorative illustrations or marketing panels.
- **Don't** introduce heavy resting shadows on record panels.
- **Don't** reduce essential product and payment copy to the smallest incidental text sizes present in older supporting UI.
- **Don't** shrink transfer and count lot, expiry, or reason text to incidental metadata sizes, or let long context widen the first column without wrapping.
- **Don't** imply that a loaded-row CSV includes matching records that have not been loaded.
- **Don't** describe the open app window as current solely because no new download is available, or force other windows to reload.
- **Don't** invite resubmission of a confirmed action after a refresh failure, or show opening-stock confirmation before CSV validation succeeds.
