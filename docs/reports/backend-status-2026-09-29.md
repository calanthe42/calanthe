# Calanthe — backend report

**Date:** 29 September 2026 · **Branch:** `feat/roles` (everything is here; `main` is 3 commits behind) · **Plan it measures against:** `docs/BUILD_PLAN.md` v2

Every line below was checked in the code on this date, not copied from older notes. Where an older note was wrong, this report says so.

---

## 1. The short version

**What works today.** A customer can order and pay **cash on delivery**. The price is always recomputed on the server. The order lands in `/admin/orders`, and emails go out: confirmation to the customer, "new order" to the owner, a job sheet to the florist, and status updates as the order moves. The owner runs products, photos, occasions, orders, customers, enquiries, events, the team (owner / staff roles), an email log with resend, and an activity log. Accounts, sign-in, verification and password reset work, and login and forms are rate-limited.

**What is missing to finish.** In order of importance:

1. **Card payments (Stripe)** — not started. No Stripe code, no webhook, no payments table.
2. **Store settings** — delivery fees, zones, cut-off, time windows, Build Your Own prices and membership prices are all still fixed in code. The owner cannot change them.
3. **Invoices** — nothing exists yet.
4. **Customer history** — guest orders are not linked to a customer. The admin customer page has no spend, order count or export.
5. **Admin gaps** — delivery screen, Build Your Own options, membership tiers, payment on/off switches, refunds.
6. **Security finishing** — no security headers / CSP yet, and no tests that prove customer A cannot read customer B's data through the API.
7. **Tabby** — not started (needs the merchant account).
8. **Speed and Google** — language lives in a cookie, which makes every page dynamic and invisible to Google in Arabic. Wrong URLs answer 200 instead of 404.

---

## 2. Phase by phase

| Phase | Status | Done | Left |
| --- | --- | --- | --- |
| **A0** Truth audit | ✅ Done | Audit, admin matrix, speed baseline | — |
| **A1** Foundations (settings, payments, invoices tables) | 🟥 Not started | `email_log` and `activity_log` tables exist (they came with A2/A3) | `settings` global is **written but not registered** — nothing reads it. No `payments`, `webhook_events` or `invoices` tables. Prices and delivery rules still live in `src/lib/data.ts`. No order price snapshot of the rules. |
| **A2** Email | ✅ Built | Resend through Payload's adapter; branded templates; customer confirmation, owner new-order, florist job sheet (no prices), status emails sent after the database commit; every email logged; resend button in `/admin/emails`; preview allow-list | Owner and florist mail both go to `EMAIL_REPLY_TO` until Settings holds real addresses. **Real-inbox check (Gmail, Outlook, spam folder, phone view) is not recorded** — do it once, then tick it. |
| **A3** Security, data, auth | 🟨 Partial | Owner / staff roles with a test per permission; append-only activity log; `/cms` owner-only; account pages fixed to show only your own orders; rate limits on login, register, reset, checkout, enquiries; Upstash keys present | **No security headers or CSP.** No IDOR tests through Payload REST/GraphQL. GraphQL playground off in production not proven. Git-history secret scan not done. Neon backup restore not tested. |
| **A4** Customer accounts & history | 🟥 Not started | Customers can register, sign in, see their own orders; admin customer list and detail (owner-only) | Guest order → customer record link. Saved recipients, reorder, account deletion request. Admin: total spent, order count, first/last order, CSV export. Attach old guest orders after email verification. |
| **A5** Stripe, server side | 🟥 Not started | Test keys are in `.env.local` (checked: both are `test` keys) | Everything: PaymentIntent, signed webhook, idempotency, paid-order transaction, stock, double-tap protection, refunds, reconciliation. |
| **A6** Invoices | 🟥 Not started | — | Invoice table, gap-free numbering, PDF, manual invoices, share link, credit notes. |
| **A7** Admin completeness + delivery | 🟨 Partial | 10 of 33 matrix rows worked at A0; email log and roles have landed since | `/admin/delivery`, Build Your Own options, membership tiers, payment switches, refunds, invoice link on orders, occasion names in Arabic, page copy. |
| **A8** Speed + zero-error checkout | 🟥 Not started | Baseline measured (home 39, shop 61, product 62, checkout 68 — mobile, localhost) | Language into the URL, header height fix, delay GSAP/Lenis, error messages for every checkout failure, Playwright checkout suite. |
| **A9** SEO | 🟨 Partial | `sitemap`, `robots`, business JSON-LD, per-page titles | Soft 404 (wrong product URLs answer 200), `/ar` URLs + hreflang, SEO fields in admin, slug redirects. |
| **C1–C5** after keys | 🟥 | — | Real email check, Stripe test matrix, checkout Payment Element, Tabby, deployed test. |

---

## 3. Wrong or risky right now

1. **The preview admin can delete live photographs.** Preview and Production share one Blob store, so deleting a photo in the preview admin deletes the real file. Until a separate preview store exists (steps in `OWNER_TODO.md`), **never delete or re-upload media in preview.**
2. **The website says cards and Tabby are accepted; checkout offers cash on delivery only.** That is correct while payments are being built, but the site must not launch like this.
3. **Owner and florist emails go to one address** (`EMAIL_REPLY_TO`), because there is no Settings screen to hold them.
4. **Guest orders have no customer record.** The owner cannot see a guest's history.
5. **No security headers / CSP.** Card payments should not go live without them.
6. **`src/globals/Settings.ts` is an orphan file.** It is written but not registered in `payload.config.ts`, and the file it mentions (`backend/data/store-settings.ts`) does not exist.
7. **`OWNER_TODO.md` said the Stripe code was "written and unit-tested".** It was not; the line is corrected today.
8. **Product names and descriptions are English only.** The Arabic site shows them in English until the database has Arabic fields.
9. **Soft 404s** — `/product/<wrong>` answers 200, which Google indexes as a real empty page.

---

## 4. Build order to finish

Each step is one working session or more, ends with the Definition of Done in `BUILD_PLAN.md`, and runs on the preview database first.

| # | Step | Why this order | Needs from you |
| --- | --- | --- | --- |
| 1 | **A1 Settings + tables** — register Settings, seed it with today's exact values, add `payments`, `webhook_events`, `invoices`; one migration; price snapshot on every order | Everything below reads from it | Nothing (placeholders for business facts) |
| 2 | **A5 + C2 + C3 Stripe** — server, signed webhook, checkout Payment Element in brand style, test-card matrix | Owner priority 1; test keys already in place | Stripe CLI logged in on your machine for local webhooks |
| 3 | **A6 Invoices** | Needs paid orders from step 2 | Legal name, address, VAT yes/no + TRN, logo |
| 4 | **A4 Customer history** | Needs orders + invoices to report on | — |
| 5 | **A7 Admin completeness** — delivery screen, Build Your Own options, membership tiers, payment switches, refunds | Settings from step 1 makes these screens | Confirm delivery zones and fees |
| 6 | **A3 Security finishing** — headers + CSP (Stripe allowed), IDOR tests through REST/GraphQL, secret scan, backup restore test | Must be done before live cards | — |
| 7 | **C4 Tabby** | Needs the merchant account | Tabby merchant approval + keys, basket min/max |
| 8 | **A8 Speed + A9 SEO** — language in the URL (`/ar`), soft 404, header height, lazy GSAP | Biggest change to routing; do it when checkout is stable | — |
| 9 | **Launch checklist** (`docs/LAUNCH_CHECKLIST.md`) | Clean test data, live keys, one real payment + refund | Go-ahead for production |

---

## 5. What only you can do

| # | Item | Blocks |
| --- | --- | --- |
| 1 | **Apply to Tabby now** — approval is not instant | Step 7 |
| 2 | Legal business name, address, VAT/TRN, invoice logo | Step 3 |
| 3 | Real owner + florist email addresses | Correct order emails |
| 4 | Confirm delivery emirates, fees, free-delivery threshold, cut-off hour, time windows | Step 5 |
| 5 | Refund policy — window and who approves | Steps 2 and 3 |
| 6 | Create a separate **Preview** Blob store (steps in `OWNER_TODO.md`) | Safe photo work in preview |
| 7 | Real product photos, and mark real products available | Anything to sell |
| 8 | Confirm the GitHub repo is private | — |
| 9 | Send test emails to your own Gmail and Outlook once, and check spam | Ticks A2 |

---

## 6. Numbers checked today

- Unit tests: **281 passing** in 25 files (`pnpm test`).
- Typecheck and lint clean; production build passes.
- Payload collections: Users, Media, Occasions, Products, Orders, Events, Enquiries, Memberships, EmailLog, ActivityLog. **No globals registered.**
- Admin screens: dashboard, orders, products, media, occasions, customers, enquiries, events, emails, activity, team.
- Keys present locally (values not read): database, Payload secret, Sentry, Upstash, Resend, email from/reply-to/allow-list, Stripe **test** publishable + secret. **Missing: Stripe webhook secret, Tabby keys.**
