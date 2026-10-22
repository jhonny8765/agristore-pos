---
name: AgriStore POS
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

# Design System: AgriStore POS

## Overview

**Creative North Star: "The Cooperative Stock Book"**

The cooperative stock book pairs forest ink with warm paper, quiet rules, and precise figures. It feels practical and orderly for cashiers completing sales and owners tracing stock changes to their source.

Compact sans-serif typography and restrained tonal surfaces keep operational information close together. Flat category illustrations identify agricultural goods; borders and alignment organize the work rather than decorative effects.

**Key Characteristics:**

- Forest navigation and primary actions against warm paper.
- Ruled records, aligned figures, and explicit operational states.
- Compact controls with rounded corners and clear focus outlines.

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
- **Soft Leaf:** restrained control backgrounds and hover surfaces.

### Operational colors

- **Stock Amber:** low stock, offline connection, and attention states.
- **Correction Red:** destructive actions and error emphasis.
- **Focus Green:** keyboard focus outlines.

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

**The Precise Figures Rule.** Keep tabular numerals throughout the interface and right-align numerical table columns so quantities and money can be scanned vertically.

## Layout

The desktop shell uses a fixed forest rail (220px) and a white branch and connection bar (73px tall). The workspace has horizontal gutters (36px) and a maximum content width (1900px). The rail narrows at (1250px), becomes an icon rail at (950px), and reaches (61px) at the mobile breakpoint.

Checkout pairs a flexible searchable catalog with a persistent receipt column (335px), separated by a gap (27px). The receipt is sticky with a top offset (22px). The product grid has three columns by default, two below (1250px), and four from (1600px); receipt width and spacing adapt at the same breakpoints.

At (730px) and below, checkout stacks into one column, retains a two-column product grid, and places the receipt below the catalog. A fixed forest basket summary near the bottom edge exposes the current total and a Review sale anchor. Checkout reserves bottom space (88px) for it. The icon rail remains present. General form grids and paired panels collapse to one column.

Spacing is compact and contextual, using the repeated frontmatter steps rather than a uniform large-card rhythm. Tables remain horizontally scrollable; numeric columns align right. Panel supporting prose is bounded to (72ch).

## Elevation & Depth

The application is flat at rest: thin borders, pale fills, and forest navigation establish hierarchy. Product hover receives a faint lift; the fixed mobile basket uses a stronger ambient shadow to remain distinguishable over scrolled content. Other record panels have no resting shadow.

### Shadow Vocabulary

- **Product hover** (`0 6px 16px #23352b0b`): subtle response on available product buttons.
- **Mobile basket** (`0 8px 24px #173e3233`): separates the fixed checkout summary from content behind it.

**The Ruled Record Rule.** Separate record rows, receipt sections, and workspace regions with fine rules; retain tonal surfaces as the primary means of grouping.

## Shapes

Corners are softly rounded, with the frontmatter field and control radii for interactions, product radius for catalog items, and panel radius for records and receipts. Small tags have the tighter tag radius. Outlines are generally (1px); the receipt total uses a dashed separator as a paper-record cue. Circular avatars and completion marks are specific identity and feedback shapes.

## Components

### Buttons

Compact and decisive. The primary, outline, ghost, and destructive variants share the same rounded control shape, weight (650), gap (9px), and minimum height (43px). Their padding is defined in frontmatter. Small buttons reduce to (34px) minimum height and (7px 11px) padding; icon buttons are (40px) wide.

Primary hover darkens the forest fill. Outline and ghost hover use Soft Leaf. Disabled buttons reduce opacity to (0.5) and use a not-allowed cursor. Button color transitions last (0.16s) with ease timing. All interactive controls receive a Focus Green outline (3px), offset (3px), on keyboard focus.

### Chips

Category filters use compact rounded rectangular buttons, with transparent default surfaces and forest selected fill. Status tags are quiet, compact labels with Soft Leaf default, amber warning, and pale green success variants. Status text carries the meaning alongside color.

### Cards / Containers

White record panels use the panel radius, a Fine Rule outline, and panel spacing. On mobile the panel padding reduces to (18px). Product buttons use the product radius and a flat tinted category strip with a line SVG icon; their name, unit, price, and available stock remain in the content area. Product hover changes the outline and adds the subtle elevation above.

### Inputs / Fields

White fields have a thin muted green border, the field radius, and the padding defined in frontmatter. Labels sit above their fields with a gap (6px). Search is a bordered container with an inline icon and a borderless text input. Cash received is right-aligned and enlarged to (17px). Disabled fields use a subdued pale surface.

### Navigation

The rail uses Forest with muted pale text and line SVG icons. Active entries use Pale Leaf, forest text, and stronger weight. Hover uses a darker green tonal surface. Narrow layouts retain the icon rail and hide visible labels; accessible button names remain supplied by the application.

### Current Sale

The receipt groups heading, items, and payment into ruled sections. Quantities use a compact three-part stepper. Amount due is larger, forest-colored, and aligned opposite its label. The completion button spans the payment area. A completed sale replaces the editable receipt with explicit saved-state feedback; printed output isolates the receipt in an (80mm) column.

### Settings / Branches

The owner’s branch panel extends the existing ruled record surface. Rename fields retain branch-code labels and outline Save buttons; Add branch sits beneath that grid with a labeled name field and the shared forest primary action. Branch codes are assigned automatically. Names allow up to (120 characters). The rename grid collapses to one column on narrower layouts, and the addition form follows the shared responsive form layout.

Creation requires an online connection and is disabled during practice or another pending operation. Keep feedback beside the form: the button reads “Adding branch…” while pending, errors use the existing error notice and preserve the name, and confirmed success clears the field before refreshing the branch list. If confirmation is uncertain, feedback directs the owner to the Sync center, where the original request can be recovered; if only the list refresh fails, retain the success message and offer Refresh. Use explicit local text and the existing status colors so the outcome stays visible within the branch panel.

The Current branch picker in the top bar changes the displayed branch and its stock together after the selected branch’s data finishes loading. A failed download retains the previously loaded branch selection. Disable live branch switching while offline, during an active cashier lease, or while another operation is pending, and confirm a successful change with “Branch stock loaded.”

## Do's and Don'ts

### Do:

- **Do** use the shared forest, paper, ink, muted, and rule tokens for new operational surfaces.
- **Do** keep currency and quantities aligned and retain tabular numerals.
- **Do** provide a visible focus outline and explicit text for connection, stock, and save states.
- **Do** preserve the responsive receipt access and fixed mobile basket summary on checkout.

### Don't:

- **Don't** substitute emoji or text glyphs for the existing line SVG icon vocabulary.
- **Don't** turn operational surfaces into decorative illustrations or marketing panels.
- **Don't** introduce heavy resting shadows on record panels.
- **Don't** reduce essential product and payment copy to the smallest incidental text sizes present in older supporting UI.

