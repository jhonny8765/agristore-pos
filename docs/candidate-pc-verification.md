# Candidate cashier PC and offline recovery verification

October 28, 2026. This is the currently accessible Windows PC, chosen for testing at the user's request. The user subsequently requested the installed Brave browser instead of installing Edge. This record is a test observation, not permission to begin real sales or certification of a future branch PC.

## Observations on this PC

| Check | Observed result | Acceptance consequence |
|---|---|---|
| Windows | Windows 10 Pro, version 10.0.19045; ASUS All Series | Verify security-update coverage before commercial use |
| Memory and system disk | 7.87 GiB memory; 118.7 GiB system volume; 11.66 GiB free at inspection | Maintain disk headroom without deleting POS records; browser quota is a different measurement |
| Edge and Docker | Not found in the usual application locations, registered Edge app paths or targeted uninstall entries | No local Edge acceptance or real local Docker/Supabase run is claimed |
| Printing | Print Spooler stopped; printer enumeration could not reach it | No physical receipt or printer-model acceptance; no service settings changed |
| Browser access | Initially disabled; accessible again during this follow-up | Earlier blocked-browser notes are historical; current interactive checks are recorded below |
| In-app browser storage | Check storage protection did not grant persistence | This browser/profile fails the protection prerequisite for a real-sales pilot |
| Brave Work profile storage | After the guarded update and explicit Check storage protection, persistence still not granted | Brave is a candidate test browser only; it has not passed the browser-storage gate |

The installed Brave executable reports product/file version **156.1.98.60**. This is an observed version, not a claim that the browser, PWA installation or system security coverage has passed acceptance.

Windows 10 Home/Pro ordinary support ended October 14, 2025. Extended security-update enrollment/coverage was not verified. Installed KB5126256 is an ESU preparation package and does not by itself prove enrollment. No security settings, software licensing or paid plans were changed. See [Microsoft lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-10-home-and-pro) and [the preparation-package documentation](https://support.microsoft.com/en-us/servicing/os/windows-10/2026/09/kb5126256-windows-10-21h2-22h2-standalone-cbs).

## Interactive findings

The in-app browser retained the owner's existing sign-in. Before updating: no shift, empty basket, clear queue, four synced receipts. The guarded Settings update reopened the current Better Yield app and exposed PC checks & store guide. All four receipt references and amounts survived:

| Receipt | Amount |
|---|---:|
| B01-D1B4A824B132 | ₱89.50 |
| B01-851E7BCBDBF7 | ₱76.30 |
| B01-EBE680995C3A | ₱65.00 |
| B01-A5ACCC76AE7A | ₱1,580.00 |

Switching to Test Branch 4 downloaded its existing 250 kg TEST feed balance. Opening a zero-cash shift there was refused because this profile's device already belongs to Magpet. The registration was preserved; no reassignment, retirement, sale or stock adjustment was used to bypass that restriction. Switching back restored Magpet's existing 500 kg feed, 400 kg fertilizer and 50 seed-packet snapshot.

A tab-scoped network simulation and reload exposed a genuine closed-shift defect: the cached member and branch list returned, but the selected branch ID did not. The selector visually defaulted to Magpet, the footer said Select a branch, and Sync center incorrectly showed no local transactions. Reconnecting restored the existing receipts. This was a missing display scope, not observed deletion; no saved payload was edited. Connectivity was restored immediately after the check. This short simulation does not count as the required physical sixty-minute outage, eight-hour endurance test or Windows restart.

The user's Brave Work profile initially opened an older cached AgriStore shell. Sign-in to the authorized test account succeeded; its basket and local queue were empty. Its guarded update then reopened Better Yield with the current catalog and readiness guide. No browser data was cleared and no extensions or software were installed. The local Brave profile and the in-app profile have separate saved records; a blank new profile is not evidence that the other profile's records were lost.

The user subsequently reported **no installation option** in Brave and **neither Better Yield nor AgriStore listed** on their apps page. Automated access to that internal page is prohibited by the browser URL policy, so the installation-list observation is the user's report. Native Windows control also refused to bind the Brave window because it could not reliably determine its current URL. Neither restriction was bypassed. Normal HTTPS POS page control remains available.

A direct navigation to the POS manifest in that same Brave profile returned the expected Better Yield manifest, standalone display mode, root start URL and 192/512 PNG icon definitions. The page's manifest link already includes `crossorigin="use-credentials"`. An unauthenticated external HTTP request redirects to Vercel sign-in because staging is protected; that response alone does not establish a manifest failure in the signed-in browser. No deployment protection was disabled. Additional browser installability diagnostics were unavailable through the controller, so the missing menu item's cause and successful app installation remain unverified. See [Brave's official installation instructions](https://support.brave.app/hc/en-us/articles/39077114659597-How-do-I-install-and-use-Web-Apps-in-Brave).

## Correction and verification

The stock download now carries browser-only organization/branch metadata. Applying a snapshot saves that scope in the same IndexedDB transaction as the catalog, stock, acknowledgments and snapshot timestamp. A closed-shift restart selects that downloaded branch only if it matches the cached membership's organization, allowed branch and cached branch list. An active authorized shift still takes priority. Account cache clearing removes the metadata while retaining immutable saved transactions and unresolved requests. This adds no server permission or offline checkout authorization.

For an older cache with no scope, the app does not guess which branch's stock it holds. The branch selector, Sync center and PC checks require reconnecting rather than giving a false empty-queue assurance. An online reload also retains a valid downloaded second branch instead of automatically resetting an owner to the first branch.

Local type checks, lint, production build and **322 unit tests in 25 files** passed after the correction. Before that correction, the candidate-PC local database preflight passed **811 assertions in 17 files**, and the local count snapshot/restore passed sealed evidence, unfinished recount, original retry, independent approval, stale-count rejection, a single adjustment and immutable observations. Those two local database checks use PGlite/Auth doubles; they are not a real Supabase Auth test or production cloud-backup restore.

The new genuine Supabase/Auth browser regression covers a saved and synchronized sale, exact cash closure, closed-shift offline restart, second-branch selection across online/offline reloads, legacy missing-scope warnings and retained original cash/stock/receipt identity. Final evidence follows below.

The first full run, [40573034792](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40573034792), passed all 50 pre-existing genuine browser cases but timed out in the new scenario before its first offline navigation. The new test incorrectly expected the initial service worker to claim an already-open page, although `clientsClaim: false` intentionally protects an active checkout from replacement. Its setup now waits for the worker to be ready and reopens online before asserting control and disconnecting. No service-worker update safeguard or cash/stock assertion was relaxed. The complete rerun is required before release.

## Final release and repeated interactive check

The complete rerun [40580476173](https://github.com/jhonny8765/agristore-pos-open-source/actions/runs/40580476173), public source `f115b8bcfd99e7564c216b8cf475db0e48e1cb3b`, passed both jobs: **322 unit tests in 25 files, 22 practice-browser scenarios, 51 genuine Supabase/Auth scenarios (73 browser scenarios total), 811 pgTAP assertions in 17 files**, strict database lint, type/lint/build and the **40-table disposable dump/restore**. The new closed-shift scenario passed in **2.4 seconds**, preserving its original one-peso sale/payment, 99 kg stock and exact one-peso counted/expected closed drawer. These are software simulations, not physical-duration or production-backup sign-offs.

Private application source `913af3f9a7b881f75e1ef56d767546196efcb79a` is in Preview/Ready deployment `dpl_8YX6khBU4AA47ohexYoSutBEFNBi` at `agristore-7m2bccsur-team-payaman2.vercel.app`. The subsequent private commit `beabfe8` changes only the test's first-installation setup and matches the corrected public test. Eight complete generic source/test files match after normalizing line endings; the API/StoreApp changes match while preserving each edition's branding and connection defaults. No schema, dependency or recovery-export format changed.

After the complete gate passed, the [stable staging address](https://agristore-pos-staging-team-payaman2.vercel.app/) was assigned to that deployment. Independent deployment readback confirmed the exact Ready deployment, source and intended project. No production promotion or paid setting changed.

The original in-app profile was then updated through Settings with an empty basket, no shift and no unresolved records. A new tab-scoped offline simulation and reload retained **Magpet / B01**, correctly disabled opening a new shift, and displayed **all four original synced receipts and amounts while disconnected**. The screenshot is retained privately as `.impeccable/review/closed-shift-offline-receipts.png`. This directly repeated and resolved the originally reproduced defect without modifying any sale.

A second interactive check selected Test Branch 4 online, then reloaded offline. It retained **Test Branch 4 / B04** and its existing **250 kg** test-feed balance instead of reverting to Magpet's **500 kg**. Connectivity and Magpet were restored afterward; its original feed/fertilizer/seed balances returned. No OS network setting or PC clock was changed. These short tab simulations do not count as the required sixty real minutes, eight actual hours or Windows restart.

Read-only checks found all **40 hosted business-table row counts and content hashes unchanged** before release, with **zero open shifts, net cash zero centavos and zero ledger/projection differences**. No hosted test checkout, stock issue, count, employee access or purchase cost was added. The reported historic stock-loss cause/value remains unresolved.

## Gates still open

1. Persistent storage on the exact installed browser app/profile. Keep this PC out of real cashier service while persistence is not granted. Do not force a grant or clear site data to make a test appear to pass. If the selected browser pilot cannot pass storage durability, implement and verify the planned Windows Tauri/SQLite fallback before launch.
2. At least 200 labelled TEST purchases, a real 60-minute outage, eight actual hours and normal Windows restart, preserving every original ID and exact cash/stock totals. A tab simulation is supplementary evidence only. A shared-PC restart needs a safe handover with user work saved.
3. Actual scale/tare, length/liquid measures, printer and receipt output; independent physical inventory and documented purchase costs.
4. Separate real counters and a third approving owner; individual cashier access. Synthetic CI identities do not replace staff rehearsal.
5. Separate production setup, responsible maintainer, actual off-site backup restoration and signed one-branch pilot reconciliation. No production sign-off is inferred from staging or disposable restores.

Follow [the next test session](next-test-session.md), [owner handoff](owner-next-steps.md) and [pilot checklist](pilot-checklist.md). Preserve both existing browser profiles, original saved receipts and all unresolved records.
