# Easier shift closing

Choose **Close shift** at the top of Checkout or any other workspace while your shift is open. Settings also has **Count cash & close shift**.

1. Finish the basket. If a sale or request still needs confirmation, choose **Open Sync center** and confirm the original record. Reconnect first if offline.
2. Count the actual money in the drawer, including opening cash. Enter that amount in pesos. The field starts empty; it does not copy the sales total or expected cash.
3. Choose **Close shift**. The confirmation shows expected and counted cash. **Keep shift open** returns to checkout without submitting a closing request.

The draft amount stays while moving between screens within the same shift. It does not carry into another shift. A blank field cannot be submitted; a genuine zero count can be entered as0. An interrupted close still retains the original shift ID and counted centavos in Sync center. Retry that request instead of entering another count.

The separate screen replaces the old closing form buried in Settings. It keeps the existing durable `close_shift` command, branch pending-work checks and cash calculation. No sales, stock, database schema or recovery-file format is changed. The new readiness count includes unresolved branch requests from another local employee, even when the signed-in employee cannot inspect those requests; the existing atomic command remains the final authority.

Verification: type checks, lint and all473 existing unit tests passed in an isolated checkout, including13 shift-closing safety tests. Two new browser cases passed in both the Next.js build and the configured Cloudflare build. They verify the shortcut, basket preservation, draft retention, offline blocking, Settings access, accessible desktop/mobile layout and no horizontal overflow at1440px/390px. Axe reported no violations within the closing panel. The existing full cash/stock recovery proof remains in `magpet-endurance-20261102-results.md`; this UI change does not repeat or expand that endurance verdict.

Authenticated local Supabase integration cases were updated to use the new entry point, including lost-response recovery and rejected pending requests. They were not rerun locally because the Docker executable is unavailable on this PC; their existing business-rule counterparts passed. No real cash count is certified by the automated UI checks.

## Website release

Published to the existing Magpet Cloudflare Pages site as **cf-mvzq5c2m** on November3,2026. Its uncached health response reports `status: ok` and that release. All26 published Practice regression cases passed on the `easier-shift-close` preview, then both closing cases passed again against `https://better-yield-magpet-pos.pages.dev`. These cases use disposable browser profiles and local Practice records; they create no live business sales or stock changes.

The same archive was used for preview and production: SHA-256 `9b054044d2ec5e1c72ca9bb42accd28f159aca84d818a2b3a226496abbb39928`. The previous release `cf-mvzjynum` and its archive remain available for rollback. Existing catalog/photo work already present on the website was retained; the closing feature was separately committed as `b53addc`. No catalog migration or business write was submitted for this UI release.

For an already-open installed POS, finish the basket and confirm pending records, then use **Settings → Check for app update** and reopen when prompted. Do not clear site data. The Close shift shortcut appears while a cashier shift is open.
