# AgriStore POS

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-approved: Next.js, TypeScript, Supabase, Vercel, Tailwind, shadcn/ui, Dexie, Workbox, Zustand, Vitest, Playwright, pgTAP.

## Users
Cashiers at a growing network of agricultural supply stores in the Philippines; branch managers, stock staff, and the owner. The user now operates five branches and may add more.

## Product Purpose
Replace handwritten records with cash checkout that survives brief network outages and an auditable stock movement journal across all branches.

## Operating Context
One Windows cashier PC per branch. PHP currency, Asia/Manila business time. Online login and shift opening; the same cashier may resume offline for up to 12 hours. Opening stock is imported and verified before live use.

## Capabilities and Constraints
Cash-only checkout; product-specific sack/kilo conversions; batches and expiration; purchasing; transfers; owner-approved count discrepancies; cash reconciliation; owner-managed branch expansion. No customer credit, payment processing, AI, marketing, full accounting, or official tax invoices in the pilot. Illustrative fixtures belong in the separate practice database unless the user explicitly authorizes labelled synthetic data in their staging test business.

Customers request loose products by weight and by peso budget. The cashier enters fractional kg or grams using configured retail kilo prices; peso estimates require confirmation of actual scale weight. Whole-piece products remain indivisible. The owner's Better Yield public profile supplies crop nutrition/crop care context; it does not establish actual prices, stock, or branch changes.

## Brand Commitments
Customer-facing identity: Better Yield POS, for Better Yield Agri Trading and Services. AgriStore remains the internal product/repository identity. Practical, clear, non-technical language. At the user’s request, use the actual logo, product-display photograph and public tagline from the supplied Better Yield Facebook page; source details are in docs/brand-assets.md. Extend the established forest/paper operational design and retain the cashier composition. This request applies to the existing POS only. It does not authorize replacing configured branches with public marketing locations or assigning photographed goods to synthetic catalog records.

## Product Principles
Completed sales survive interruption. History is append-only. Each checkout is distinct. Failed sync stays visible. Permissions are enforced in the database.
