# Browser storage protection for Magpet

Use the Cloudflare website: <https://better-yield-magpet-pos.pages.dev/>. Protection belongs to this exact website and browser profile. An installation or grant for the old Vercel website does not carry over.

## What the update changes

- Sign-in/catalog startup no longer requests storage permission. A rejected request cannot incorrectly turn successful membership verification into a sign-in failure.
- Settings requests protection only when the user selects **Check storage protection**, then independently reads the browser's permission. An accepted request alone is not reported as a verified grant.
- Permission checks and quota estimates fail independently. Unknown permission is distinct from a confirmed refusal, and an unavailable quota estimate does not hide a real grant. The PC guide uses the same probe.
- An installation offer is captured before Settings opens. If the browser supplies it, Settings shows **Install Better Yield on this PC**. Cancelled/failed installation leaves recovery instructions available.
- No sales, payments, stock movements, device registrations, database versions or stored receipts are changed by these checks. The checks never clear site data or override browser permission.

## Steps on the chosen cashier PC

1. Save any pending records on the previous website: synchronize, export the recovery file, close the shift online and have the maintainer verify the original transaction IDs. Keep the old profile and its site data.
2. Open the Cloudflare address in a normal dedicated browser profile. Avoid private/guest mode. Sign in online with the cashier's individual account; ask the owner to approve any necessary device replacement through the normal audited workflow.
3. Open **Settings → Application & recovery**. Select **Install Better Yield on this PC** if offered. Otherwise use the install icon beside the address or the browser's app menu. Confirm the browser's installation dialog. Check that this is the Cloudflare website, not the old shortcut.
4. Open the installed app. In Settings, select **Check storage protection**. The required result is **Persistent storage granted.** Installation by itself is not that result. Refresh PC checks afterward so its displayed snapshot also updates.
5. If the result says **not granted** or **could not be verified**, keep the records and stop before real checkout. Export/synchronize unresolved records and contact the maintainer. Do not clear browsing data, change permission flags or disable security features to make the check pass. If the chosen PC cannot pass the browser-storage gate, the planned Windows/SQLite alternative is required before a pilot.
6. Run labelled TEST purchases through the actual elapsed one-hour outage and eight-hour endurance test, including an agreed normal Windows restart. Verify original IDs, cash, stock, exactly-once upload and recovery-file replay. Keep the completed evidence sheet. A short automated test does not replace this step.

Even persistent storage can be deleted manually and does not protect against a failed/stolen drive. Keep the profile, avoid cleanup tools that erase POS site data, synchronize regularly and maintain separately stored recovery files plus encrypted database backups.

The browser decides whether to grant persistence. Chromium considers signals including app installation and site use; a grant is not guaranteed. Requests should follow a user action instead of page load. Sources: [Google's persistent-storage guidance](https://web.dev/articles/persistent-storage/), [Storage Standard](https://storage.spec.whatwg.org/).

See [the full before-live checklist](magpet-before-live.md) for staff, opening stock, accounts, backups, equipment and pilot sign-off.
