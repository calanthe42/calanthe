# Calanthe — Build Plan

> **Reconstructed 2026-09-25.** The owner's build plan was given in
> conversation and never committed, so this file rebuilds Track A from that
> plan, from `PLAN-B5-payments-email-auth.md` (which holds the detailed phase
> content), and from the architecture already fixed in `PAYMENTS.md`,
> `EMAILS.md`, `ORDERS.md`, `SECURITY.md` and `DATABASE.md`.
> **The owner should correct anything misremembered here.** Where this file
> and an architecture document disagree, the architecture document wins.

## Standing constraints

These are not negotiable and apply to every phase.

- **Forbidden without evidence:** "done", "works", "should work", "fixed".
- **Test mode only.** No live keys and no production database writes until
  the Launch checklist.
- **Money in fils (integers) everywhere.** The server always recomputes
  totals — never trust the browser.
- **Only a signature-verified webhook changes payment state**
  (`PAYMENTS.md`). No exceptions: not the browser, not the redirect, not an
  admin button, not `?success=true`.
- **Never guess owner information** — business details, emails, delivery
  areas. Use a clearly marked placeholder in Settings and list it under
  "Needs owner" in `OWNER_TODO.md`.
- **DB changes:** the migration runs on a **Neon dev/preview branch first**,
  verified, with written rollback steps. Never run a new migration on
  production first.
- **Secrets:** none in the repo or the client bundle — scan the build output.
- **PowerShell:** chain commands with `;`, never `&&`.

## Definition of Done — every phase

A phase is done when all of these produce output, and the output is recorded
in that phase's report:

```
npx tsc --noEmit                                  # clean
npx vitest run                                    # all green, new tests included
npx next build                                    # compiles
node scripts/storefront-check.mts http://localhost:3000
node scripts/device-check.mts     http://localhost:3000
```

Money-specific gates, where the phase touches money:

- replaying a webhook twice changes the database **once**
- a tampered signature is rejected **400**
- a client-sent total is ignored; the server's `priceOrder` wins
- customer A cannot read customer B's order

**No test output = not done.**

---

## Track A

### A1 — Foundations: environment and the money model

No credentials needed.

- `lib/env.ts`: add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `TABBY_SECRET_KEY`, `TABBY_PUBLIC_KEY`,
  `TABBY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`. Enforcement keys
  off `VERCEL_ENV === "production"`. A missing payment or email key turns
  that feature **off**; it never crashes the app. `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN` and `SENTRY_DSN` are **required** in production.
- Keep the degraded in-memory rate-limit fallback for a runtime Redis
  outage, and raise a **Sentry alert when it triggers**.
- `collections/Payments.ts` — one row per **attempt**, not per order:
  provider, providerRef, status, amountFils, currency, refundedFils,
  declineCode, order (nullable on purpose — reconciliation must be able to
  find a payment with no order).
- `collections/WebhookEvents.ts` — source, eventId, type, status, receivedAt,
  processedAt, payload snapshot. **Unique index on `(source, eventId)`** —
  this is the real idempotency guarantee.
- `collections/Invoices.ts` and `collections/EmailLog.ts` — created here so
  A2 and A6 have somewhere to write.
- **Register `globals/Settings.ts`** in `payload.config.ts`. It is written
  but has never been registered.
- **Every price constant in `lib/data.ts` moves to Settings**, seeded with
  today's values — vase = **150**. Settings are passed *into* a pure
  `priceOrder()`; it never reads them itself. Settings are cached, and the
  cache is invalidated when an admin saves.
- **Every order stores a snapshot** of the prices and rules used at that
  moment, so repricing tomorrow cannot change what a customer paid today.
- One migration, additive only, run on the **preview** branch.

**Done when:** the migration applies clean on preview, `tsc` passes, both new
collections are visible in the admin and refuse writes from a customer, and
the pricing tests cover the snapshot.

### A2 — Email

The first phase that pays for itself: `customerRegister` sends a verification
email and there is no transport, so **customers can register and can never
verify**. Payments and auth both depend on this.

- `backend/email/` — provider interface plus a Resend adapter
  (`EMAILS.md` §4), so the provider is swappable and tests never hit the
  network.
- Payload email adapter wired in `payload.config.ts`, so `verify` and
  `forgotPassword` finally deliver.
- Templates: verify address · password reset · order confirmation · order
  status · enquiry received.
- **The gifting rule, enforced by types:** a recipient-facing email may never
  carry a price. `EMAILS.md` §3 requires the type system to make that
  impossible, not a reviewer to remember it.
- Send is **queued after commit**, never inside a transaction.
- Every send is written to `EmailLog`.

**Done when:** unit tests cover the gifting rule and template rendering; with
a real key a registration email arrives; without one, nothing throws.

### A3 — Security pass

- **Scan the FULL git history for secrets**, not just staged files. Anything
  found is listed in `NIGHT_REPORT.md` for rotation. **Do not rewrite
  history.**
- **The IDOR test that must exist** (`SECURITY.md` §4): customer A must not
  be able to read customer B's order by id. Written as a test, not a promise.
  (`scripts/cod-security-test.mts` already covers this — extend, don't
  duplicate.)
- Throttles on every auth and payment route: login, register, reset, intent
  creation, webhook.
- Session review: customer and admin cookies, expiry, the role gate.
- Webhook routes exempt from CSRF and auth **by construction**, and reachable.
- Scan the build output for secrets in the client bundle.

### A4 — Accounts

- Guest order → customer record link (guest checkout is **on**, and creates a
  customer record).
- Customer list and detail: spend, order count, recency, CSV export.
- Address book.

### A5 — Stripe

- `backend/payments/stripe.ts` — create PaymentIntent (AED, automatic
  capture), `metadata: { kind: "order", orderId }`. The server recomputes the
  total with `priceOrder`; the client's number is never trusted.
- `app/api/webhooks/stripe/route.ts` — `runtime = "nodejs"`,
  `dynamic = "force-dynamic"`, and the mandatory order:
  1. raw body via `req.text()` — never `req.json()`, which breaks the signature
  2. `stripe.webhooks.constructEvent` → failure is **400**, no fallback
  3. Redis `SETNX stripe:evt:<id>`, 7-day TTL (fast path)
  4. insert `webhook_events` — unique violation → **200**, stop (the guarantee)
  5. dispatch on `metadata.kind`, assert `currency === "aed"`
  6. apply in **one transaction**: payment row, order `paymentStatus`, stock, timeline
  7. mark `processedAt`, commit
  8. queue emails **after** commit
  9. **200**; any throw → **500** so Stripe retries
- Events: `succeeded`, `payment_failed`, `processing`, `charge.refunded`,
  `charge.dispute.created`.
- **Checkout idempotency key**, so a double-tap cannot create two orders or
  two charges.
- Refunds: **owner-only**.

**Done when:** replaying the same event twice changes the database once —
proven by a test, not by inspection.

### A6 — Invoices

- Numbering, PDF, and the business details from Settings (placeholders until
  the owner supplies them — an invoice is not a legal document without them).
- Refund and credit-note handling consistent with A5.

### A7 — Admin and delivery

- `/admin/delivery`: zones, fees, free-delivery threshold, same-day cut-off,
  time windows — so the owner changes them without a developer.
- Payment-method on/off switch (COD is currently hardcoded in
  `CheckoutForm`).
- Membership tiers and prices.
- `lib/store-settings.ts` already normalises the record and falls back to
  today's constants, so nothing changes on deploy.

---

## Out of scope tonight

**A8 (speed)** and **A9 (SEO)** need the owner's design and Arabic
decisions. Recorded so they are not lost:

- Locale via `cookies()` makes every page dynamic and hides other languages
  from Google. Plan **URL-based locale** (`/en`, `/ar`) with static/ISR pages.
- Hero headline visible without JS (LCP).
- Header height fixed in CSS (CLS).
- GSAP and Lenis loaded after first paint.
- `React.cache()` on `getActiveOccasions` — currently queried twice per home
  render.
- Neon scale-to-zero: the first visitor after idle waits for the database to
  wake. See `PERFORMANCE.md`.

## Not in scope, but real

1. **Reconciliation job** — payments with no order; orders stuck awaiting payment.
2. **Failed-webhook alerting** — three days of retries must page someone.
3. **Stripe Subscriptions** for memberships (B7).
4. **PCI posture** — Elements puts the site at SAQ A-EP, not SAQ A.
5. **Terms / refund page copy** must match the implemented policy.
