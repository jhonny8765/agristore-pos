# Financial correctness and capacity audit — November 3, 2026

The live Magpet database was inspected through read-only queries. Destructive cases, sale/payment creation, concurrency, refunds and restore exercises run only in disposable test environments. Passing these checks reduces known risks; it does not certify that software or physical source records contain no mistakes.

## Confirmed defects addressed

- Credit inputs previously multiplied a JavaScript peso number by 100. At the supported upper boundary, `90071992547409.85` became 9007199254740984 centavos instead of 9007199254740985. Inputs now parse decimal text directly into integer centavos; display and prefilled inputs preserve the last centavo too.
- Large account-wide credit and dashboard totals can exceed the limit for one document. New responses provide exact decimal-string totals alongside the original numeric fields for compatibility. Client balances, aging, overview, drawer expected cash and CSV money formatting use exact values.
- Baskets now reject totals beyond the supported exact range and more than 100 lines before changing the basket. Previously the server rejected these after the browser could display an invalid total. Existing invalid held baskets block checkout and request review.
- Unit conversion now uses sufficient decimal precision to reject unsupported quantities. For example, `999999999999.999999 × 0.999999` has twelve fractional digits; the old browser calculation could silently round it to six while PostgreSQL rejected it.
- Price history previously read only the latest 1,000 versions. Live history already contains 2,235 versions. Owner search now runs against the complete history, including archived products, with 50-row server pages and a stable cursor for tied timestamps.
- Stored numeric columns independently reject NaN and infinity, protecting against future validation omissions. Existing authorization, price-version checks, payment limits, immutable journals and retry identifiers remain in force.

## Live evidence

Read at approximately 17:35–18:04 Manila time, before release:

| Check | Result |
| --- | --- |
| Database size | 24,016,563 bytes, approximately 24 MB |
| Application tables and indexes | 9,756,672 bytes |
| Connections at the observation | 15 of a configured maximum 60 |
| Authenticated database statement timeout | 8 seconds |
| Business tables without row security | 0 |
| Anonymous executable private security-definer functions | 0 |
| Invalid indexes | 0 |
| Sale total versus line totals | 0 mismatches |
| Stored discount calculation versus independent SQL calculation | 0 mismatches |
| Missing or mismatched historical sale prices/costs | 0 |
| Closed-shift expected cash versus opening cash plus payment ledger | 0 mismatches |
| Stock projection versus movement ledger | 0 mismatches |
| Negative stock or customer/supplier balances | 0 |
| Fractional piece stock | 0 |
| One live customer-credit calculation | 71 ms server execution, inside the 8-second statement limit |
| Customer opening receivables | 855 invoices; outstanding ₱45,882,590.60 |
| Active products | 1,246 |

The live financial sample contains only one recorded sale and one payment. The extensive boundary, duplicate-request, role and reversal cases use synthetic data. The connection maximum is a server setting, not a promise that 60 cashier PCs can operate concurrently. One measured query is not a sustained-load or future-growth guarantee.

## Free-plan limits and operating implications

The owner confirmed the live Supabase project is on Free. The account currently signed into the browser belongs to a different organization; monthly billing usage was not verified against that other account.

- Supabase lists a **500 MB database quota**, 5 GB uncached egress, 5 GB cached egress, 1 GB file storage and 50,000 monthly active users on Free. Database size is currently about 4.8% of the listed 500 MB quota. [Official pricing](https://supabase.com/pricing).
- The quota and physical disk are different measurements. Current documentation describes a fixed 2 GB Free disk and read-only protection at 95% physical disk usage; 500 MB should not be described as that immediate read-only threshold. WAL, temporary files and other disk use matter too. [Database and disk size](https://supabase.com/docs/guides/platform/database-size).
- A Free project may pause after a week of inactivity. It has no included automatic daily backups. For this money-sensitive store, Pro is recommended for increased capacity, daily backups and avoiding inactivity pauses; pricing starts at $25/month. No billing change was made. [Pricing](https://supabase.com/pricing), [backup guidance](https://supabase.com/docs/guides/platform/backups), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- Current open-shift stock synchronization runs every 15 seconds. The measured stock JSON contains 1,036 rows and is 145,218 bytes compact, or 27,293 bytes in an illustrative local gzip. At 8 hours/day for 26 days, this stock field alone represents about **7.25 GB uncompressed or 1.36 GB locally compressed per PC/month**. These are payload scenarios, not measured billed egress. Actual compression, other requests, photos, number of PCs and account usage change the result. Monitor the actual live project's egress dashboard; do not assume Free is unlimited. Poll frequency was retained to preserve current stock freshness. [Egress accounting](https://supabase.com/docs/guides/platform/manage-your-usage/egress).
- The normal 1,000-row API response default does not truncate the product catalog: the catalog uses the existing snapshot RPC. Price history now uses explicit pagination rather than relying on that default. [API select reference](https://supabase.com/docs/reference/javascript/select).
- Cloudflare Pages static asset requests are free and unlimited; Pages Functions requests use Workers quotas. The Free Workers request allowance is 100,000/day, not a 100,000/day allowance for every static POS asset combined. The deployed routing sends the health endpoint to a function; business requests go directly to Supabase. [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Supported transaction boundaries

- One money input, price, payment or sale total: at most 9,007,199,254,740,991 centavos (₱90,071,992,547,409.91). Values outside that range fail rather than round.
- One receipt: at most 100 lines. Quantity and conversion factors accept up to six decimal places and twelve whole-number digits; converted quantities must also fit their supported range and precision.
- Credit checkout and collections require internet, approved client policy and the appropriate open shift. Each invoice has one agreed 30-, 60- or 90-calendar-day due date, using Manila dates. Unknown historical due dates remain unconfirmed rather than being invented.
- Cash checkout can use the existing 12-hour offline authorization. Its unresolved local records are absent from a server backup until synchronized. Keep the cashier PC's local data intact and reconcile Sync center daily.

## Outstanding source and recovery requirements

The dependency scan found **zero production advisories** and no high/critical advisories across the full dependency tree. It still reports **22 development/build-tool advisories (2 low, 20 moderate)**, primarily through linting and service-worker build dependencies. The suggested automatic fixes include breaking downgrades; they were not applied blindly. These remain maintenance work, and the scan result is not a guarantee that dependencies are vulnerability-free.

1. **45 imported starting stock balances still require unit confirmation.** Another 284 active products have unconfirmed selling units and 28 need prices, with four overlapping; 308 products remain blocked for checkout. The imported October 22 quantities are being used as current stock at the owner's instruction. These checks cannot establish today's physical quantity: complete an actual stock count.
2. **Supplier debt history is incomplete.** Only 73 supplier names were imported. No historical supplier bill balance was posted because the source contained original amounts and some bills already had payments. Obtain the remaining balances/payment evidence before treating the supplier dashboard as the complete amount owed.
3. **Recovery needs an off-site owner-held backup and a complete production restore drill.** This release retains an encrypted, authenticated snapshot of all 49 application tables/functions and a separate key file on this PC, plus the previous deployment package. A local encryption round trip and a synthetic complete database restore are different from proving recovery of this production project's Auth, settings and any storage objects after the PC fails. Local snapshots and receipt recovery exports do not establish an automatic off-site backup schedule. Follow the [backup procedure](backup-and-availability.md).

## Release verification

- Application source: `8c97908`. A subsequent test-only navigation correction, `b56adde`, changes no deployed application or migration files.
- [Application gate](https://github.com/jhonny8765/agristore-pos/actions/runs/41616853480): type checking, strict lint, production dependency scan, **566 unit tests and all 63 browser tests passed**. The unit tests include an independent integer-arithmetic oracle across 2,000 price/quantity/discount vectors, large money inputs, fractional refund allocation, unsafe basket rejection and due-date tests.
- [Final database gate](https://github.com/jhonny8765/agristore-pos/actions/runs/41618125169): strict PostgreSQL lint, **1,408 assertions across 29 files**, encrypted full-dump restore with **49 table fingerprints**, and **4 signed-in workflows under each of the two branch configurations passed**. The focused signed-in cases cover credit sale/racing retries/collections/roles, cash checkout with offline reconciliation, supplier debts/payments and product review with real price-history navigation. This is a focused integration selection, not a claim that every legacy integration test was rerun.
- Migration `20261103080000_exact_credit_totals` was applied to the verified live project with an all-table before/after guard and an in-place dispatcher check. No function was renamed. All **10,116 existing rows across 49 application tables** retained their fingerprints; device heartbeat timestamps are excluded from those fingerprints. All 52 unrelated functions are unchanged. Exactly three private helpers were added and the command dispatcher was updated as expected.
- Post-release read-only financial, stock, historical-price, cash, row-security and index checks passed again. Customer receivables remain **₱45,882,590.60**. No production test sale, collection, supplier payment, shift or stock posting was created.
- Cloudflare confirmed successful production deployment. Release **`cf-mw0izyoe`**, **189 files**, package SHA-256 **`526d1299cda4d854b07fffa2e61dbd96df138b8f6711e1688551d483fe533532`**.
- The live health endpoint returned HTTP 200 and the matching release at **18:24:57 Manila time**. The served home-page bytes matched the tested local deployment package (SHA-256 `bbd16ce1859f1c0af3dfe9a80fc6f674ec6db98cab529a8e1ce60e4579917e11`). Health proves current endpoint availability, not physical inventory or backup readiness.

On an already-open cashier PC, finish the current sale and confirm saved sales in Sync center before using the offered website update. Keep unresolved local records and the browser's site data intact.
