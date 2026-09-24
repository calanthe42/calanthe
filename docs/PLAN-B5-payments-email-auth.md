# Tonight — Payments, Email, Auth, Delivery

Plan of record for the session starting 2026-09-25. Scope: backend only —
payments (Stripe + Tabby), email, checkout, security, delivery settings, and
auth for customer / staff / owner.

Architecture is **already decided** in [PAYMENTS.md](./PAYMENTS.md),
[EMAILS.md](./EMAILS.md), [ORDERS.md](./ORDERS.md) and
[SECURITY.md](./SECURITY.md). This plan implements those documents; where it
departs from them it says so and why. Tabby is the one area with no existing
spec, so §Phase 4 designs it.

---

## 0. Where the code actually is tonight

| Area | State | Evidence |
| --- | --- | --- |
| Checkout | **Cash on delivery only** — order created at `paymentStatus: PENDING` | `backend/actions/checkout.ts` `placeCodOrder` |
| Stripe | **Nothing** | no `stripe` import anywhere in `src/` |
| Tabby | **Nothing**, and no spec | — |
| `payments` table | **Does not exist** (specified in `DATABASE.md` §10) | `src/collections/` has 8 collections, none of them payments |
| `webhook_events` table | **Does not exist** | — |
| Email | **Nothing sends.** Payload logs "No email adapter provided" | dev server log |
| Customer auth | Built: login, register, verify, forgot / reset | `backend/actions/account.ts` |
| Staff / owner auth | Built: `/admin/login`, role gate, 5-attempt lockout, Team screen | `backend/actions/admin-auth.ts`, `team.ts` |
| Rate limiting | Built (Upstash sliding window) | `backend/security/throttle.ts` |
| Delivery rules | **Hardcoded constants**; `globals/Settings.ts` written but **not registered** | `lib/data.ts`, `payload.config.ts` has no `globals` |

### The bug that decides the running order

`customerRegister` sends a verification email, and there is no email
transport. **Customers can register and can never verify.** Email is
therefore not the last task, it is the first one that pays for itself — and
both payments and auth depend on it.

---

## 1. Working smart: the critical path

Two tracks run in parallel tonight. **Track B is yours and blocks Track A's
last mile**, so start it first.

```
TRACK A (me, no credentials needed)      TRACK B (you, ~30 min total)
─────────────────────────────────        ──────────────────────────────
Phase 1  env + payments + webhook_events  Stripe account → test keys
Phase 2  email: provider + templates      Resend account → API key
Phase 3  Stripe server + webhook          calanthe.ae DNS: SPF/DKIM/DMARC
Phase 4  Tabby server + webhook           Tabby merchant application
Phase 5  checkout UI (Elements)           Decisions in §7
Phase 6  auth + security pass
Phase 7  delivery settings
```

Everything in Phases 1–4 can be **written and unit-tested with no live
keys**. Keys are needed only to run a real transaction end to end. That is
the whole reason for this ordering: no idle waiting.

---

## 2. Phase 1 — Foundations `no keys needed`

**Goal:** the money model exists and is migrated, so every later phase has
somewhere to write.

- `lib/env.ts` — add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `TABBY_SECRET_KEY`,
  `TABBY_PUBLIC_KEY`, `TABBY_WEBHOOK_SECRET`, `RESEND_API_KEY`,
  `EMAIL_FROM`. Optional in development, **required in production** — same
  fail-fast pattern the file already uses for Sentry and Upstash.
- `collections/Payments.ts` — one row per **attempt**, not per order:
  provider, providerRef, status, amountFils, currency, refundedFils,
  declineCode, order (nullable). Nullable on purpose: reconciliation has to
  be able to find a payment with no order.
- `collections/WebhookEvents.ts` — `source`, `eventId`, `type`, `status`,
  `receivedAt`, `processedAt`, payload snapshot. **Unique index on
  `(source, eventId)`** — this is the real idempotency guarantee.
- One migration. Additive only, so the running deploy keeps working.

**Done when:** `pnpm migrate` applies clean, `tsc` passes, both collections
are visible in `/cms` and refuse writes from a customer.

## 3. Phase 2 — Email `needs key only to send`

**Goal:** the shop can talk to people. Fixes the broken registration flow.

- `backend/email/` — provider interface + Resend adapter (per `EMAILS.md`
  §4), so the provider is swappable and tests never hit the network.
- Payload email adapter wired in `payload.config.ts`, so `verify` and
  `forgotPassword` finally deliver.
- Templates: verify address · password reset · order confirmation · order
  status · enquiry received.
- **The gifting rule, enforced by types:** a recipient-facing email may never
  carry a price. `EMAILS.md` §3 requires the type system to make that
  impossible, not a reviewer to remember it.
- Send is **queued after commit**, never inside a transaction.

**Done when:** unit tests cover the gifting rule and template rendering; with
a real key, a registration email arrives; without one, nothing throws.

## 4. Phase 3 — Stripe `server side, no keys needed to write`

**Goal:** money can move, and only the webhook may say so.

> **The rule, from `PAYMENTS.md` §2:** only a signature-verified webhook may
> change payment state. Not the browser, not the redirect, not an admin
> button, not `?success=true`.

- `backend/payments/stripe.ts` — create PaymentIntent (AED, automatic
  capture) with `metadata: { kind: "order", orderId }`. The server recomputes
  the total with `priceOrder`; the client's number is never trusted.
- `app/api/webhooks/stripe/route.ts` — `runtime = "nodejs"`,
  `dynamic = "force-dynamic"`, and the mandatory order:
  1. raw body via `req.text()` (never `req.json()` — parsing breaks the signature)
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
- **Checkout idempotency key** so a double-tap cannot create two orders or
  two charges.

**Done when:** replaying the same event twice changes the database once —
proven by a test, not by inspection.

## 5. Phase 4 — Tabby `new design`

No existing spec, so the decisions are recorded here.

| Decision | Choice |
| --- | --- |
| Flow | Hosted redirect (Tabby does not offer embedded fields) |
| Capture | **Explicit capture after authorisation** — Tabby does not auto-capture |
| Eligibility | Tabby **pre-scores and rejects** some carts. A rejection is a normal outcome and is shown as "not available for this order", never as an error |
| Limits | Basket min/max enforced **server-side** before the option is offered |
| State | Same rule as Stripe: webhook only |
| Refunds | Tabby refund API, same webhook-driven state |

- `backend/payments/tabby.ts` — create session, capture, refund.
- `app/api/webhooks/tabby/route.ts` — signature verify, same two-layer
  idempotency into the same `webhook_events` table.

**Done when:** an ineligible basket hides Tabby cleanly, and an authorised
payment is captured exactly once.

## 6. Phase 5 — Checkout UI

- Payment method step: Card (Elements) · Tabby · Cash on delivery (if kept).
- Stripe Elements on our own page, brand type and colours.
- **Express Checkout / Apple Pay constraint already learned on this project:**
  `onClick` must call `resolve()` within one second with **no awaits before
  it**; all server preparation belongs in `onConfirm`. Violating this breaks
  Apple Pay silently.
- CSP must allow Stripe.js or Elements fails with no visible error.
- Arabic + RTL, and the 44px tap floor, same as the rest of the site.

## 7. Phase 6 — Auth & security pass

- **IDOR test that must exist** (`SECURITY.md` §4): customer A must not be
  able to read customer B's order by id. Written as a test, not a promise.
- Throttles on every auth and payment route (login, register, reset, intent
  creation, webhook).
- Guest vs account checkout — see §9 decisions.
- Session review: customer and admin cookies, expiry, and the role gate.
- Secrets: per-environment in Vercel, never in the repo.
- Webhook routes exempt from CSRF and auth by construction, and reachable.

## 8. Phase 7 — Delivery settings

Register `globals/Settings.ts`, migrate, and build `/admin/delivery` so the
owner sets zones, fees, free-delivery threshold, same-day cut-off and time
windows without a developer. `lib/store-settings.ts` already normalises the
record and falls back to today's constants, so nothing changes on deploy.

---

## 9. Decisions needed from the owner

| Question | Why it blocks |
| --- | --- |
| **Guest checkout allowed?** | Changes the whole checkout flow and the order/customer link |
| **Keep cash on delivery?** | Changes the payment-method step |
| **Refund policy** (window, who approves) | Refund code and the policy page must agree |
| **Tabby: which basket range?** | Server-side eligibility rule |

## 10. Credentials needed

| Credential | Blocks |
| --- | --- |
| Stripe **test** publishable + secret + webhook secret | Running a real card transaction |
| Tabby merchant public + secret | All of Phase 4 |
| Resend API key | Sending anything |
| `calanthe.ae` DNS (SPF, DKIM, DMARC) | Deliverability — without it mail lands in spam |
| Apple Pay domain verification file | Apple Pay only |

---

## 11. Not in tonight's scope — but real

1. **Reconciliation job** — payments with no order; orders stuck awaiting payment.
2. **Failed-webhook alerting** — three days of retries must page someone.
3. **Stripe Subscriptions** for memberships (B7).
4. **PCI posture** — Elements puts the site at SAQ A-EP, not SAQ A.
5. **Terms / refund page copy** must match the implemented policy.

---

## 12. Verification gate — every phase

Nothing is "done" on inspection. Each phase ends with:

```
npx tsc --noEmit          # clean
npx vitest run            # all green, including the new money tests
npx next build            # compiles
node scripts/storefront-check.mts http://localhost:3000
node scripts/device-check.mts     http://localhost:3000
```

Money-specific gates:

- replaying a webhook twice changes the database **once**
- a tampered signature is rejected **400**
- a client-sent total is ignored; the server's `priceOrder` wins
- customer A cannot read customer B's order

## 13. Honest estimate

Payments are where a bug costs real money, so this is several sessions, not
one night. Tonight's realistic target is **Phases 1–3** (foundations, email,
Stripe server + webhook) with tests. Phases 4–7 follow.
