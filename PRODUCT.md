# AgriStore POS

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User-approved: Next.js, TypeScript, Supabase, Vercel, Tailwind, shadcn/ui, Dexie, Workbox, Zustand, Vitest, Playwright, pgTAP.

## Users
Cashiers at three agricultural supply stores in the Philippines; branch managers, stock staff, and the owner.

## Product Purpose
Replace handwritten records with cash checkout that survives brief network outages and an auditable stock movement journal across three branches.

## Operating Context
One Windows cashier PC per branch. PHP currency, Asia/Manila business time. Online login and shift opening; the same cashier may resume offline for up to 12 hours. Opening stock is imported and verified before live use.

## Capabilities and Constraints
Cash-only checkout; product-specific sack/kilo conversions; batches and expiration; purchasing; transfers; owner-approved count discrepancies; cash reconciliation. No customer credit, payment processing, AI, marketing, full accounting, or official tax invoices in the pilot. All illustrative fixtures must be clearly labelled and confined to a separate practice database.

## Brand Commitments
Name: AgriStore POS. Practical, clear, non-technical language. No supplied logo or visual reference.

## Product Principles
Completed sales survive interruption. History is append-only. Each checkout is distinct. Failed sync stays visible. Permissions are enforced in the database.
