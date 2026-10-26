# Expiry and assigned-investigation verification

October 26, 2026, Asia/Manila. Released private application source `72a52d6`; generic public application source `8d35022`. Later documentation commits do not change this release.

## Complete software gate

Both jobs of [40299113349](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40299113349) passed: **182 unit checks, 22 practice-browser scenarios, 19 genuine Supabase/Auth browser scenarios, 273 pgTAP assertions, warning-failing database lint, type checks, application lint, optimized builds and the expanded 25-table dump/restore**. All 22 browser scenarios also passed locally against the private branded build after the recovery fix.

The new signed-in flow creates a disposable business, records expiring lots and a held-stock issue, assigns an overdue case to an active branch stock employee, signs that employee into a separate browser, records progress and retains the overdue/open case until owner resolution. Stock quantities remain unchanged by assignment, progress and resolution. The test exercises 30/90-day worklist behavior, separate expiry statuses and filters, desktop/390/320 px containment and accessibility, and a browser in another timezone.

A second genuine browser test deliberately discards a committed assignment response. The original owner exports its saved pending operation, imports the downloaded JSON in a fresh signed-in browser with all shifts closed, and retries the same request. Exactly one assignment event remains and the case version is one. Unit coverage additionally serializes scoped and unscoped owner files with optional undefined metadata and a saved sale; IDs, payloads and existing fingerprints are unchanged.

The 51 new database assertions cover current Manila dates, bounded look-ahead windows, missing expiry information, expiry today, held-only expired goods, bounded pages and continuation cursors, complete unresolved-case totals, valid and invalid assignees, organization/branch boundaries, cashier denial at the workspace RPC, manager assignment without resolution privileges, assigned-employee progress, stale versions, changed-content retries, direct-write denial and inactive access. Original table RLS and grants remain in place; no direct client write privilege was added.

The restore fixture now retains an assigned overdue case and progress note as part of the existing 25 content fingerprints. Replaying assignment/progress after restoration changes no retained evidence. Separate sealed counts, independent approval, original sale/payment/refund, held goods, partial transfers and the post-restore disposition still work; ledger/projection differences remain zero. This is a disposable restore, not evidence of a production backup schedule.

## Failures found and corrected before staging

- [40295855887](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40295855887) stopped on an unused dispatcher variable. It was removed; database lint still fails on warnings.
- [40296298390](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40296298390) exposed ambiguous select labels and overflow from the refresh control at 320 px. Explicit label references and wrapped controls corrected those failures; no test assertion was removed.
- [40297809917](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40297809917) passed all earlier workflows and the new owner/employee flow, but exposed an owner archive checksum mismatch after JSON serialization. Export now hashes the actual JSON representation; the importer still verifies checksums. Permanent sale/operation fingerprints and request IDs were not changed. The original saved records were retained. The final linked run passes the downloaded-file recovery scenario.

Manual component review used clearly labelled TEST data, mocked reads and the real UI/IndexedDB operation wrapper at desktop, 390 px and corrected 320 px widths. Native screenshots are retained under `.impeccable/review/followups-*`. This layout rehearsal is separate from the genuine Auth/database tests above. The mechanical interface scan returned no findings; the final automated gate additionally verified accessible labels, keyboard/narrow operation and existing forced-color behavior.

## Staging readback

After the final full gate passed, migration `20261026084440_stock_followups_expiry.sql` was applied only to project `vbmnnouwmxcuibywdkjw`. Its apply-time history version `20261026092856` was aligned to the canonical repository version `20261026084440` and read back. No earlier migration or business record was rewritten.

Ready preview `agristore-s3n6pn32m-team-payaman2.vercel.app`, deployment `dpl_8KiaC8EmfM9pU7jZ6skkkWsutBHA`, was assigned to the stable staging address and inspected as **Preview / Ready**. The signed-in window installed the guarded update, opened Inventory and exercised both worklist filters. It retained five branches, 500 kg TEST feeds, 400 kg TEST fertilizer and 50 TEST seed packets. The current labelled staging stock has no matching expiry reminders and no unresolved investigation; populated workflows were tested in the disposable business instead of inventing live shortages.

Independent hosted readback retained four sales/four linked reversals, zero open shifts, zero new assignment/progress events, zero open investigations and zero stock-ledger differences. RLS remains enabled, authenticated direct investigation updates remain denied, and the private expiry helper is not executable by browser roles.

Security advice is unchanged: two intentionally default-denied private count-table information notices and the existing disabled leaked-password-protection warning. Performance advice retains 47 uncovered-FK information findings; unused-index information findings changed from five to nine after adding the new indexes on low-traffic staging. No security setting, index or billing plan was weakened to clear advice. See [RLS/default-deny guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [foreign-key advice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) and [unused-index advice](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Follow [the store procedure](expiry-and-investigations.md). These are online Inventory worklists with visible snapshot times. Actual expiry labels, staff-account rehearsal, cashier-PC storage, timed outages/restarts/endurance, scale/printer checks, real backup restoration and a reconciled branch pilot remain operational gates.
