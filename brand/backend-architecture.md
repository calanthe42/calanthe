# Calanthe — Backend Architecture & Build Plan (senior spec)

Written to a 15-year full-stack standard. Goal: a deep, correct, secure
backend — not a demo. The admin is Payload's built-in panel (production-
grade, free); we invest effort in data integrity, money correctness,
auth, and security, NOT in hand-rolling an admin UI.

═══════════════════════════════════════════════
## 0. PRINCIPLES (the senior mindset — non-negotiable)
═══════════════════════════════════════════════
1. The client NEVER computes money. Every price, total, discount, VAT,
   and delivery fee is recomputed server-side from the DB at each step.
   The browser sends intent (product id, qty, options), never prices.
2. Money is integer fils (AED×100). No floats touch money, ever.
3. State transitions go through ONE guarded path. Orders don't get
   "paid" by a redirect — only a verified payment webhook does that,
   idempotently, inside a DB transaction.
4. Validate at the boundary. Every input (API, server action, webhook)
   is parsed with Zod before use. Unparsed input never reaches logic.
5. Fail closed. Auth/permission checks default to deny. If unsure, 403.
6. Every mutation is auditable. Orders carry a timeline; sensitive
   admin actions are logged.
7. Secrets in env only, never in code, never in the repo. Separate
   test/live. Rotate on exposure.
8. The DB is the source of truth; the frontend is a view. Nothing
   critical lives only in the client (no trusting localStorage carts).

═══════════════════════════════════════════════
## 1. STACK (locked, matches the frontend already built)
═══════════════════════════════════════════════
- Next.js 15 App Router (same app hosts storefront + API + Payload admin)
- Payload CMS 3 — collections, access control, admin panel, auth
- PostgreSQL on Neon (branches: prod / staging / dev)
- Drizzle (via Payload's adapter) — migrations, no push-to-prod
- Stripe (payments) → PaymentProvider interface (Tap/Tabby later)
- BSP for WhatsApp OTP → OtpProvider interface (SMS fallback)
- Resend (transactional email) · React Email templates
- Upstash Redis (rate limiting, OTP store, idempotency keys)
- Sentry (errors) · Zod (validation) · Vercel (host)

═══════════════════════════════════════════════
## 2. DATA MODEL (Payload collections — the real depth)
═══════════════════════════════════════════════
Design orders as IMMUTABLE snapshots. A product edit must never change
a past order's price or contents.

users        — role (admin|staff|customer), phone (E.164, unique),
               name, addresses[], marketingConsent (bool + timestamp),
               createdAt. Passwordless for customers (OTP).
products     — slug, name, description, gallery[], basePrice(fils),
               variants[] {label, priceFils, sku, stock}, addOnsAllowed[],
               occasions[], status(draft|active|archived), featured,
               seo{}. Hooks: revalidate storefront on change.
add_ons      — name, image, priceFils, maxQty, active.
occasions    — slug, name, image, seo.
delivery_zones — name, feeFils, sameDayCutoff (time), active.
delivery_slots — zone, label, capacityPerDay, active.
coupons      — code, type(pct|fixed), valueFils/pct, minOrderFils,
               maxRedemptions, redeemedCount, expiresAt, active.
carts        — owner (user|guestToken), items[] {productId, variantId,
               qty, addOns[], giftMessage, snapshot at add-time},
               updatedAt. Server-owned; localStorage only mirrors it.
orders       — orderNumber (CAL-YYYY-NNNN, gap-free, assigned at PAID),
               customer, items[] (FULL SNAPSHOT: name, priceFils,
               variant, addOns, image), amounts {subtotal, deliveryFee,
               discount, vat, total} all fils,
               recipient {name, phone, address} (gift ≠ buyer),
               delivery {zone, date, slot}, giftMessage, floristNotes,
               status (pending|paid|preparing|out_for_delivery|
               delivered|cancelled|refunded),
               payment {provider, ref, status},
               timeline[] {status, at, by}, vatEnabled snapshot.
custom_arrangements — the BYO submission: budgetFils, colours[], vase,
               occasion, cardMessage, notes → becomes an order line.
memberships  — tier, customer, deliveryDay, status, stripeSubId (later).
otp_codes    — phone, codeHash, expiresAt, attempts, channel.
audit_log    — actor, action, target, at (admin-sensitive actions).
site_settings (global) — vatEnabled, vatTrn, freeDeliveryThresholdFils,
               currency, whatsappNumber, announcement, storeOpen.

═══════════════════════════════════════════════
## 3. MONEY & ORDER PIPELINE (where seniors earn it)
═══════════════════════════════════════════════
- lib/pricing.ts — the ONLY place totals are computed. Pure functions,
  fils in / fils out, unit-tested with edge cases (empty cart, max qty,
  expired coupon, VAT on/off, free-delivery threshold).
- Checkout flow:
  1. Client posts cart id + delivery + recipient + coupon code.
  2. Server rebuilds cart from DB, revalidates stock, recomputes every
     amount via pricing.ts (ignores any client price).
  3. Creates order (status=pending) + PaymentProvider session.
  4. Returns session URL. Nothing is "paid" yet.
- Webhook (/api/webhooks/stripe):
  - Verify signature (raw body). Reject if invalid → 400.
  - Idempotency: store event.id in Redis; if seen, 200 and skip.
  - In a DB transaction: mark order paid, decrement stock
    (SELECT…FOR UPDATE), assign orderNumber, append timeline, fire
    email + FCM. Any failure → rollback, return 500 so Stripe retries.
- Stock: soft check at add-to-cart; authoritative decrement only in the
  paid webhook transaction. Overselling the last bouquet is impossible.
- Refunds: Stripe dashboard → webhook charge.refunded → status update.

═══════════════════════════════════════════════
## 4. AUTH & SECURITY (the "no weakness" requirement)
═══════════════════════════════════════════════
Customer auth (passwordless, WhatsApp OTP):
- OTP: 6 digits, store ONLY SHA-256 hash + expiresAt(5m) + attempts(max5).
- Rate limit (Upstash): send 3/hr/phone + 10/hr/IP; verify 5/code;
  resend cooldown 30s. Fail closed.
- On verify → issue Payload session (httpOnly, Secure, SameSite=Lax).
- OtpProvider interface: swap BSP/SMS/mock without touching call sites.

Access control (Payload, deny-by-default):
- customer: reads own orders/cart/wishlist only. NEVER others'.
- staff: order read + status update; no settings, no user export.
- admin (owner): everything.
- Every collection has explicit access fns for read/create/update/delete.

Application security checklist (build these in, don't bolt on):
- All inputs Zod-validated at the boundary (API, actions, webhooks).
- Security headers: CSP, HSTS, X-Frame-Options DENY, X-Content-Type,
  Referrer-Policy, Permissions-Policy (in next.config).
- CSRF: SameSite cookies + origin check on mutations.
- No secrets client-side; NEXT_PUBLIC_ only for truly public values.
- Rate-limit all public endpoints (OTP, checkout, coupon, search).
- SQL injection: Payload/Drizzle parameterize — never raw string SQL.
- XSS: React escapes by default; sanitize any rich text (gift message,
  florist notes) before render; never dangerouslySetInnerHTML on user
  input.
- PII: store minimum; card data NEVER touches our server (Stripe holds
  it). Recipient data treated as PII. Delete-my-data = anonymize user,
  retain order records for accounting.
- Webhooks: signature-verified, idempotent, raw-body parsed.
- Audit log on sensitive admin actions.
- Dependency hygiene: pnpm audit in CI; no unpinned critical deps.
- Error handling: never leak stack traces / internals to the client;
  Sentry gets the detail, user gets a clean message.

═══════════════════════════════════════════════
## 5. GIFTING RULE (sacred — enforce in code)
═══════════════════════════════════════════════
The recipient must NEVER receive price information. Enforce structurally:
order emails/notifications to the recipient use a price-free template
that has no access to amount fields. Buyer gets money; recipient gets
the gesture. Add a test that fails if a recipient-bound message includes
any amount field.

═══════════════════════════════════════════════
## 6. BUILD PHASES (each ends with a progress doc + commit + tests)
═══════════════════════════════════════════════
Phase B0 — Foundation: install Payload into the app, connect Neon,
  configure the adapter, migrations workflow, Sentry, Upstash, env
  schema (validate env at boot with Zod). Deploy admin shell.
Phase B1 — Collections & access: build every collection/global from §2
  with deny-by-default access fns + seed script (idempotent).
Phase B2 — Storefront reads from DB: swap lib/data.ts mock → Payload
  local API. One-import change per the frontend's swap contract.
Phase B3 — Cart & pricing: server-owned cart, pricing.ts + unit tests,
  stock soft-check, coupon validation.
Phase B4 — Checkout & payment: order creation, Stripe session,
  the webhook (signature + idempotent + transactional), emails.
Phase B5 — Auth: WhatsApp OTP (OtpProvider), sessions, wishlist/account
  wired to real user, guest→user cart merge.
Phase B6 — BYO + membership submission → real orders/records.
Phase B7 — Admin polish: dashboard view (today's orders, revenue, low
  stock), order status buttons, invoice/receipt PDF + WhatsApp share,
  FCM new-order push, roles.
Phase B8 — Security & hardening pass: headers, rate limits everywhere,
  the gifting-rule test, pnpm audit, penetration self-review against
  §4 checklist, load-test the webhook.
Phase B9 — Backups & ops: Neon PITR verified, staging branch, runbook.

═══════════════════════════════════════════════
## 7. PROGRESS-DOC SYSTEM (your "how to run it" docs)
═══════════════════════════════════════════════
Maintain these .md files in the repo, updated at the END of every phase:
- README.md — what the project is, prerequisites, install, run dev,
  build, deploy, env vars needed, common commands. The front door.
- PROJECT-BRAIN.md — single source of truth: how the whole system works,
  what's real vs pending, key decisions (VAT, Tabby, gifting rule).
- docs/RUNBOOK.md — how to RUN and operate: local setup step-by-step,
  migrations, seeding, deploying, rotating keys, restoring a backup,
  what to check when X breaks (the debugging table).
- docs/PROGRESS/B0.md, B1.md … — ONE per phase: what was built, files
  added/changed, decisions, how to test it, what's next. This is your
  "step doc for running the project" — a diary a new senior could read
  to understand the whole build.
- docs/SECURITY.md — the §4 checklist with ✓/pending status per item.
- CHANGELOG.md — conventional-commit-derived, per release.
Rule for Claude Code: at the end of every phase, update README +
PROJECT-BRAIN + the phase's PROGRESS doc + SECURITY status, THEN commit.
No phase is "done" until its progress doc exists.
