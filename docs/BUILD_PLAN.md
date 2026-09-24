# Calanthe (calanthe.ae) — Build Plan v2

**For:** Claude Code, working in `C:\dev\calanthe`
**Owner:** Natinael
**Version:** v2 — 2026-09-25. Replaces any reconstructed version. This file is the source of truth; `docs/OVERNIGHT.md` holds tonight's run rules.

---

## Status on 2026-09-25

- **A0 — GREEN.** Admin matrix: works 10 · partial 4 · missing 17 · n/a 2. Performance baseline in `docs/PERFORMANCE.md`.
- **Infrastructure moved to Singapore** (measured from Abu Dhabi: Singapore ~84–89 ms, Frankfurt ~107–119 ms, Ohio ~196–202 ms): Vercel functions `sin1` (via `vercel.json`) + new Neon project in `aws-ap-southeast-1`. Production cutover = owner's `git push origin main`.
- **Preview isolated:** Production → production branch; Preview + Development → separate preview branch.
- **Neon password rotated**; ID sequences fixed and proven; order counter reset to CAL-000001; enquiry counter stays at 18.
- **Ohio project:** untouched, 7-day hold after cutover, then the owner confirms deletion.
- **Still missing in production:** Upstash (to be created in `ap-southeast-1`) and Sentry DSN — owner creates both.
- Customer-facing registration is still broken until email (A2 + Resend key) lands.

---

## The 5 owner priorities — these win every trade-off

1. **Fast, zero-error ordering and payment.**
2. **Admin controls everything** the storefront shows or does.
3. **Security, data and auth** — treated as serious, not optional.
4. **Email + invoices** — owner sees every order by email; customer and florist get emails; invoice system with manual invoices from admin, download and share.
5. **Customer accounts with full history** — who bought, what, when, how often, everything.

---

## Rules for Claude Code (read before every phase)

### Definition of Done — nothing is "done" without ALL of this

1. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass — paste the last lines of each output.
2. New automated tests for everything built in the phase (unit + integration).
3. Any UI touched: Playwright at **390px and 1440px**, golden path + main error path, screenshots saved.
4. Zero browser console errors and zero new Sentry errors during the test run.
5. DB changes: migration run on the **preview branch of the Singapore Neon project** first, verified, with written rollback steps. Never run a new migration on production first.
6. README + the relevant `docs/*.md` updated.
7. Phase report in `docs/reports/<phase>.md` (template below).

**Forbidden without evidence:** "done", "works", "should work", "fixed".
If something cannot be tested yet (missing key), write **UNTESTED — needs &lt;X&gt;**. Never "done".

### Phase report template

- **Built:**
- **Tests run + results** (command + output tail):
- **Screenshots:**
- **Not done / known issues:**
- **Needs owner:**

### Working rules

- Track A needs nothing from the owner. Never sit idle waiting for keys.
- A1 onward is built on branch `build/track-a`. You may push that branch (preview deploys only). Never push to `main`, never deploy to production — production changes are the owner's push.
- After each phase: write the report. All green → next phase. Red after real attempts → mark BLOCKED with the reason, continue only with phases that don't depend on it.
- Test mode only. No live keys and no production DB writes until the Launch checklist.
- Money in fils (integers) everywhere. Server always recomputes totals — never trust the browser.
- **Only a signature-verified webhook changes payment state** (PAYMENTS.md). No exceptions.
- No scope creep: anything outside this plan goes under "Not done" — don't build it.
- Never guess owner information. Use a clearly marked placeholder and add it to `docs/OWNER_TODO.md`.
- Blocked by permissions → don't route around it; log it in `docs/OWNER_TODO.md` and continue with independent work.
- Never delete data, drop tables, force-push, or touch the Ohio project.
- PowerShell: chain commands with `;` not `&&`.

### Owner defaults for open decisions (build these, with a switch in admin Settings)

| Decision | Default built |
|---|---|
| Guest checkout | **On.** Every guest order still creates a customer record by normalized email (+ phone). "Save your details" offered after the order. |
| Cash on delivery | **On**, with an on/off switch. |
| Refunds | Owner-only approval. Refund window = placeholder in Settings. |
| Tabby min/max basket | Placeholders in Settings. |

---

## TRACK A — Claude Code alone

### A0 — Truth audit — ✅ GREEN (2026-09-25)

### A1 — Foundations (one migration)

- **Env schema:** enforce on `VERCEL_ENV === "production"` — not `NODE_ENV` (preview builds also run as `NODE_ENV=production`).
  - Stripe / Tabby / Resend key missing → that feature is **off** (payment method hidden, email goes to the log only). Never a crashed site. Boot fails only if a feature is switched on without its keys.
  - Upstash + Sentry **required** in production. Merge this only after the owner's keys are in Vercel.
  - Runtime Redis outage → degraded in-memory fallback stays, and sends a Sentry alert when it triggers.
- **Collections:** `payments` (one row per attempt, DATABASE §10), `webhook_events` (unique source + eventId), `invoices`, `email_log`.
- Customer profile fields needed by A4.
- **Settings global — every price rule moves out of `lib/data.ts`, seeded with today's exact values so no customer sees a change:**
  - Build-your-own vase price **AED 150** (not 60), minimum budget AED 150, budget steps 250 / 350 / 500 / 750 / 1000
  - Free-delivery threshold AED 350, same-day cut-off 17:00, the 3 time windows, delivery zones (7 emirates) + fees
  - Add-ons and size uplifts, membership tier prices
  - COD on/off, Tabby min/max, refund window
  - Owner notification emails, florist emails, business/invoice details (name, address, phone, logo, VAT on/off, TRN) — placeholders until the owner provides them
- Product prices stay in the products collection.
- **Pricing:** pass a resolved settings object into a pure `priceOrder()` (keep it synchronous and unit-testable). Settings are cached and invalidated when admin saves.
- **Every order stores a snapshot** of the line prices and rules used at that moment. Later settings changes never alter old orders or invoices.
- One reviewed, backward-compatible migration, run on the preview branch.
- **Done when:** migration works on the preview branch, app boots, existing COD order flow still passes E2E, and a test proves changing a setting does not change an existing order's total.

### A2 — Email (priority 4) — fully testable with no key

- Resend through Payload's email adapter, so Payload auth emails (verify, reset) use the same transport. This fixes broken registration the moment the key arrives.
- Dev/test transport: every email captured to `email_log` + preview screen in admin (`/admin/emails`).
- Emails:
  - **Customer:** verify address, password reset, order confirmation, status updates (preparing, out for delivery, delivered), refund.
  - **Owner:** new-order notification — every order, every payment method.
  - **Florist:** job sheet — items, card message, delivery date + time window, address, special notes. No payment details.
  - **Gift recipient:** never shows a price, anywhere (HTML or plain text).
- Every email logged: to, type, order, status (queued / sent / failed), time. Visible in admin, with a "resend" button.
- Emails send only after the DB commit. A failed email never fails the order — it retries and shows as failed in the log.
- **Done when:** tests prove each email fires on the right event to the right recipient; gift emails contain no price; templates render correctly at mobile width; preview screenshots saved. Real delivery = UNTESTED until C1.

### A3 — Security, data, auth (priority 3)

- **IDOR tests:** customer A cannot read or edit customer B's orders, invoices, addresses or profile — through our routes AND Payload REST/GraphQL. Staff cannot do owner-only actions.
- Roles: owner / staff — write exactly what each can do in `docs/SECURITY.md`, with a test per permission.
- Rate limits (Upstash) on every auth, order, payment and invoice route. Document the fallback behaviour.
- Session cookies: HttpOnly, Secure, SameSite, sensible expiry; logout invalidates the session.
- Prove deny-by-default with tests. Confirm GraphQL playground is off in production.
- Security headers + CSP (allow Stripe.js now so Elements doesn't silently fail later).
- Admin audit log: who changed what (orders, refunds, prices, settings, invoices).
- **Secrets:** none in the repo or client bundle — scan the build output AND the **full git history**. Anything found goes in `docs/NIGHT_REPORT.md` for rotation. Don't rewrite history.
- Backups: confirm Neon's restore window on the current plan, test a restore to a branch, write the steps down.
- Privacy: list what customer data is stored and why (feeds the privacy policy).
- **Done when:** security test suite passes and `docs/SECURITY.md` lists every threat with the test that covers it.

### A4 — Customer accounts & history (priority 5)

- Every order links to a customer record — including guest orders (matched by normalized email + phone). No order without a customer.
- Customer can: see all orders, reorder, saved addresses, saved recipients, edit profile, request account deletion.
- **Admin customer page:** total orders, total spent, average order, first + last order, everything they bought, payment methods used, addresses, recipients, notes, marketing consent, full order timeline.
- **Admin customer list:** search, sort by spend / last order / order count, CSV export (owner only).
- A guest who later registers with the same email gets past orders attached — **only after email verification**, never before.
- **Done when:** E2E: guest order → register → verify → old order appears in account. Admin stats match seeded test data exactly.

### A5 — Stripe, server side (priorities 1 + 3)

- PaymentIntent create: server-computed total, idempotency key, order `awaiting_payment`, payment row.
- Webhook: raw body → verify signature → Redis fast idempotency → Postgres durable idempotency → dispatch on `metadata.kind` → **one transaction** (order paid + stock decrement + invoice number) → emails after commit.
- Stock decrements inside the paid transaction — no overselling.
- Double-submit protection: two taps on "Place order" = one order, one charge.
- Refunds: owner action in admin → Stripe refund → webhook → order + payment + invoice (credit note) updated.
- Reconciliation job: payments with no order; orders stuck in awaiting payment.
- Failed-webhook alert via Sentry.
- Tests using Stripe's test signature header helper (no real key needed): same webhook twice → DB changes once; tampered signature → rejected; client-sent total ignored; stock runs out during payment → handled.
- **Done when:** every §12 verification gate in PAYMENTS.md passes as an automated test. Real transaction = UNTESTED until C2.

### A6 — Invoices (priority 4)

- Auto invoice for every paid order. For COD: define in docs when the invoice is issued.
- **Manual invoice from admin, no order needed:** pick or create customer, line items, discount, delivery fee, VAT (if on in Settings), notes.
- Invoice numbering is its own series, separate from order numbers. Sequential and gap-free, created inside a DB transaction (e.g. `CAL-INV-2026-00001`). Issued invoices are never edited — corrections by credit note.
- PDF download (server-side), branded with Calanthe's design tokens.
- **Share:** email to customer from admin + secure link (unguessable, expiring, rate-limited).
- Admin invoice list: filter by date, status (paid / unpaid / refunded), customer; CSV export.
- Business details, VAT and TRN come from Settings — placeholders until the owner provides them.
- **Done when:** tests prove no duplicate or skipped numbers under concurrent creation; PDF totals correct; share link can't be guessed or used after expiry; customer A can't open customer B's invoice.

### A7 — Admin completeness + delivery (priority 2)

- Close every "missing" and "partial" row in `docs/ADMIN_MATRIX.md`.
- `/admin/delivery`: zones, fees, free-delivery threshold, cut-off, time windows. Storefront reads from Settings; hardcoded constants removed.
- Order screen: full detail, status change (triggers emails), print florist sheet, resend any email, refund, invoice link.
- Dashboard: today's orders, pending, out for delivery, revenue today / week / month.
- **Done when:** every matrix row = works, with a test. E2E: change a fee in admin → storefront shows it without a redeploy.

**Overnight run 2026-09-25: A1 → A7, then stop.** A8 and A9 need owner decisions (design, Arabic).

### A8 — Speed + zero-error checkout (priority 1) — needs owner review before starting

**A0 baseline (mobile, localhost):**

| Page | Perf | LCP | CLS | TBT |
|---|---|---|---|---|
| Home | 39 | 7.9 s | 0.123 | 970 ms |
| Shop | 61 | 5.9 s | 0.002 | 420 ms |
| Product | 62 | 5.5 s | 0.002 | 420 ms |
| Checkout | 68 | 4.3 s | 0.006 | 430 ms |

- Mobile targets on home, shop, PDP, checkout: **LCP < 2.5s, INP < 200ms, CLS < 0.1** — measured on the Vercel preview (`sin1`), not localhost.
- Known causes from A0, fix these first:
  - Locale read with `cookies()` makes every page dynamic → move to **URL-based locale** (`/en`, `/ar`) so pages can be static/ISR. Also required for SEO (A9).
  - Hero headline (`span.splitline-rise`) only appears after JS at 6.4 s → render it visible in the HTML; animate after.
  - CLS 0.12 on `div#main` from the header height set after hydration → fix the header height in CSS.
  - GSAP + Lenis dominate main-thread time → load after first paint; keep the look.
  - `getActiveOccasions()` queried twice per render → React `cache()`.
  - Neon scale-to-zero: the first visitor after idle waits for the database to wake → decide keep-warm vs. accept.
- Stripe.js loads only on checkout. Images via `next/image`, correct sizes, AVIF/WebP. Fonts subset + preloaded. No layout shift on checkout.
- Every checkout error has a clear human message and a way forward: declined card, network drop, out of stock, delivery slot gone, session expired. Never a blank screen or raw error.
- Error boundaries on every route; Sentry on client + server.
- Playwright checkout suite at 390 + 1440: COD, card (after C2), declined, 3DS, double tap, back button mid-payment, slow network.
- **Done when:** targets met with before/after numbers in PERFORMANCE.md; full suite green 3 runs in a row (no flaky tests).

### A9 — SEO, technical → see "Google SEO plan" below

---

## TRACK B — Needs Natinael (tracked in `docs/OWNER_TODO.md`)

### Right away

- [ ] `git push origin main` → production cutover to Singapore (Claude Code then runs the live checks)
- [ ] Sentry project (Next.js) → DSN to Claude Code
- [ ] Upstash Redis in **ap-southeast-1 (Singapore)**, no read regions → REST URL + token to Claude Code
- [ ] Confirm the GitHub repo is private
- [ ] The 10 products (Amber Hour, Quiet Devotion, The First Letter, Bordeaux Whisper, Sage & Cinder, Dawn Procession, Velvet Hour, A Soft Reply, The Long Stem, Meadow at Dusk): which are real? Real photos needed before they go live.

### Keys & accounts

| Item | Why |
|---|---|
| **Tabby merchant application — apply first**, approval isn't instant | C4 |
| Stripe test keys (publishable + secret) | C2 |
| Stripe CLI installed + logged in on your machine | forwards webhooks locally for testing |
| Resend API key | C1 — real emails |
| Resend DNS records + DMARC on calanthe.ae (Claude Code gives exact records) | emails land in inbox, not spam |
| Google Search Console — calanthe.ae as domain property (DNS TXT) | SEO |
| Google Business Profile — category Florist | local SEO |

### Decisions — defaults are built, confirm or change

- [ ] Guest checkout on (with customer record)?
- [ ] Keep cash on delivery?
- [ ] Refund window
- [ ] Tabby min/max basket (from the Tabby contract)

### Information only you have — Claude Code must not guess these

- [ ] Business legal name, address, phone, logo (for invoices)
- [ ] VAT registered? If yes → TRN, and invoices must follow UAE FTA tax-invoice rules
- [ ] Owner notification email(s)
- [ ] Florist email(s) — one florist or several?
- [ ] Delivery areas — the code has all 7 emirates; confirm that's real
- [ ] Arabic version planned? — decides A8 locale routes and A9 hreflang
- [ ] Refund, terms and privacy wording — must match how you really work (required for card processing)
- [ ] Is calanthe.ae already pointing to Vercel?

---

## TRACK C — After keys arrive

- **C1 Email live:** Resend key in env → send every email type to real inboxes (Gmail + Outlook), check spam folder and mobile view. Registration → verify works end to end.
- **C2 Stripe test mode end to end:** `stripe listen` → full test-card matrix, each checked for order state, email, invoice, stock:
  - `4242 4242 4242 4242` success
  - `4000 0000 0000 0002` declined
  - `4000 0025 0000 3155` 3D Secure
  - `4000 0000 0000 9995` insufficient funds
- **C3 Checkout UI:** Payment Element on our own page, styled with Stripe's Appearance API to match the brand. Apple Pay: register calanthe.ae as a payment method domain in Stripe (needs the domain live).
- **C4 Tabby:** session → hosted redirect → webhook → explicit capture. Pre-score rejection shown as "not available for this order", not an error. Basket min/max from Settings. Follow Tabby's official docs; list every assumption made.
- **C5 Deployed test:** repeat the C2 matrix on the Vercel preview with the real webhook endpoint.

---

## Launch checklist (merge into `docs/LAUNCH_CHECKLIST.md`)

- [ ] All Track A and C phases green, with reports
- [ ] **Pre-open cleanup, before any real order exists:** remove test orders, test enquiries and test accounts; reset order + enquiry counters
- [ ] Refund / terms / privacy pages published
- [ ] Live Stripe keys + live webhook endpoint; one real small payment + refund done
- [ ] Tabby live (if approved)
- [ ] Resend DNS verified, DMARC in place
- [ ] Neon backup restore tested
- [ ] Sentry alerts reach the owner
- [ ] calanthe.vercel.app → 301 redirect to calanthe.ae
- [ ] Sitemap submitted in Search Console
- [ ] Owner + staff accounts with strong passwords; all test accounts removed
- [ ] Ohio Neon project deleted after its 7-day hold (owner confirms)

---

## Google SEO plan

### Claude Code (phase A9)

1. **One canonical domain:** calanthe.ae. 301 redirect calanthe.vercel.app and www ↔ apex to it. Canonical tag on every page.
2. **Unique title + meta description + Open Graph image** per page via `generateMetadata`; product and occasion pages generate from CMS data.
3. **SEO fields in admin** for products, occasions and pages (title, description, OG image, noindex) — Payload SEO plugin. Alt text required on every product image.
4. **`app/sitemap.ts`** (auto from products + occasions) and **`app/robots.ts`**. Block `/admin`, `/account`, `/checkout`, `/cart`, `/api`; noindex on those pages.
5. **Structured data (JSON-LD):** Florist/Organization (name, logo, address, phone, hours, areas served), WebSite, Product + Offer (price in AED, availability), BreadcrumbList.
6. **Speed** = ranking factor → same targets as A8.
7. **Clean URLs** (`/shop/<slug>`, `/occasions/<slug>`), proper 404, automatic redirect when a slug changes (store old slugs).
8. One H1 per page; real text, never text baked into images.
9. Area landing pages **only** for areas actually delivered to — no copy-paste pages.
10. **Language in the URL, never in a cookie** — Google doesn't keep cookies, so a cookie-based language is invisible to it. If Arabic is planned → `/ar` routes + hreflang (en, ar, x-default).

**Done when:** every indexable page has a unique title and description; sitemap validates; Google Rich Results Test passes for home + one product; Lighthouse SEO score 100 on key pages.

### Natinael

1. Search Console: verify calanthe.ae, submit sitemap after launch.
2. Google Business Profile: category Florist, same name / address / phone as the website, hours, real photos, link to calanthe.ae.
3. Ask real customers for Google reviews after delivery (optional: Claude adds a review link to the "delivered" email).
4. Instagram bio → calanthe.ae.
5. Occasion page text: write it yourself or give Claude notes to draft, then edit — human voice, not AI-sounding.
6. Check Search Console monthly: indexing errors, Core Web Vitals, search terms.

> No one can promise Google rankings. This plan makes the site fast and fully readable for Google; rankings then come from time, reviews, real content and links.
