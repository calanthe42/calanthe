# Calanthe — Production Architecture

Status: **specification**. Nothing here is implemented except where
marked ✅. `brand/backend-architecture.md` remains the original brief;
this is its production-grade expansion and, where the two disagree,
this document wins (differences are called out explicitly).

Related: [DATABASE](./DATABASE.md) · [ORDERS](./ORDERS.md) ·
[PAYMENTS](./PAYMENTS.md) · [EMAILS](./EMAILS.md) ·
[SECURITY](./SECURITY.md) · [ADMIN](./ADMIN.md) ·
[DEPLOYMENT](./DEPLOYMENT.md)

---

## 1. What exists today (verified, not assumed)

| Area | State |
| --- | --- |
| Next.js | 15.5.24, App Router, two root layouts: `(frontend)` / `(payload)` ✅ |
| Payload | 3.88.0, Postgres adapter, `push: false`, migrations-only ✅ |
| Collections | **`users` only** — role `admin`/`staff`/`customer`, deny-by-default ✅ |
| Migrations | **`src/migrations/` does not exist.** Zero migrations have run. |
| Env validation | Zod, fail-fast, build-phase exemption — `src/lib/env.ts` ✅ |
| Money | Integer fils + 5 unit tests — `src/lib/money.ts` ✅ |
| Redis | Upstash client + sliding-window limiter — `src/lib/redis.ts` ✅ |
| Sentry | Env-gated init in `instrumentation.ts` ✅ |
| Storefront data | **100% hardcoded** in `src/lib/data.ts` (~700 lines) |
| Cart / checkout / account / login | Pages render; **no logic, nothing persists** |
| Payments | None |
| Email | None |
| Security headers | **Absent from `next.config.ts`** |
| Media storage | Vercel Blob adapter, production-enforced — `src/backend/payload/storage.ts` ✅ |
| Tests | 1 file (`money.test.ts`); Vitest configured |

The storefront is a complete, high-quality front end sitting on a
constant file. The backend foundation is real but empty.

---

## 2. System shape

```
                      ┌───────────────────────────────┐
   Browser  ────────► │  Next.js (frontend) route grp │
   (public)           │  RSC reads via Payload Local  │
                      │  API — no HTTP hop, no token  │
                      └──────────────┬────────────────┘
                                     │
   Browser  ────────► ┌──────────────▼────────────────┐
   (admin)            │  Payload (payload) route grp  │
   owner + staff      │  /admin · /api · /api/graphql │
                      └──────────────┬────────────────┘
                                     │
                      ┌──────────────▼────────────────┐
                      │  Neon Postgres (Drizzle)      │
                      │  single source of truth       │
                      └───────────────────────────────┘
        ▲                            ▲              ▲
        │                            │              │
   ┌────┴─────┐             ┌────────┴───────┐  ┌───┴──────┐
   │ Upstash  │             │ Stripe         │  │ Resend   │
   │ Redis    │             │ webhook (in)   │  │ webhook  │
   │ rate lim │             │ API (out)      │  │ (in/out) │
   │ OTP,idem │             └────────────────┘  └──────────┘
   └──────────┘
```

**Trust boundary.** Everything left of Postgres is untrusted input. The
browser is never a source of price, total, discount, stock, delivery
fee, or payment truth. See [ORDERS §3](./ORDERS.md).

---

## 3. Layering rules

```
src/
  collections/     Payload schema + access control. No business logic.
  lib/
    money.ts       ✅ integer fils primitives
    pricing.ts     THE only place a total is computed. Pure. Unit-tested.
    orders/        creation, numbering, status transitions
    payments/      Stripe client, webhook handling, reconciliation
    email/         provider interface + templates + outbox
    access/        shared Payload access functions, one definition each
  app/(frontend)/  storefront — Local API only, never fetch() our own API
  app/(payload)/   admin + REST + GraphQL (Payload-owned)
  app/api/         our route handlers (webhooks, checkout)
```

Non-negotiables:

1. **`lib/pricing.ts` is pure.** Fils in, fils out. No DB, no network,
   no `Date.now()` — time is passed in. Pricing is where money is lost,
   so pricing must be trivially testable.
2. **Collections hold schema and access only.** Hooks delegate to
   `lib/`. A 900-line collection file is a design failure.
3. **Access functions are defined once** in `lib/access/` and imported.
   Copy-pasted access rules drift, and drift is how data leaks.
4. **The storefront never calls our own REST API.** Server Components
   use the Local API — no HTTP hop, no token to leak, no public read
   endpoint to secure.

---

## 4. Entity decisions

The brief listed 21 entities. Seventeen become collections; eleven
proposed entities deliberately do **not**. Field-level detail and the
reasoning for every rejection is in [DATABASE](./DATABASE.md).

**Collections (17)** — `users` · `media` · `products` · `occasions` ·
`add_ons` · `delivery_zones` · `coupons` · `carts` · `orders` ·
`payments` · `webhook_events` · `custom_arrangements` · `enquiries` ·
`membership_plans` · `membership_subscriptions` · `email_events` ·
`audit_log`

**Globals (1)** — `site_settings`

**Infrastructure (1, hidden from admin)** — `counters`

**Redis, not Postgres (3)** — OTP codes · rate-limit windows ·
webhook idempotency fast path

**Rejected as collections (11)** — `customers`, `categories`,
`order_items`, `gift_recipients`, `invoices`/`receipts`,
`marketing_consent`, `addresses`, `delivery_slots`, `price_buckets`,
`coupon_redemptions`, `otp_codes`

The most important rejection: **`customers` is not a separate
collection.** Staff and customers are both `users`, discriminated by
`role`. Two identity tables means two auth paths, two access surfaces,
and a permanent "which row is the real person" bug.

---

## 5. Bilingual content (EN / AR)

Payload's `localization` makes chosen fields per-locale at the database
level — one document, two content versions, one admin toggle.

```ts
localization: {
  locales: [
    { label: "English", code: "en" },
    { label: "العربية", code: "ar", rtl: true },
  ],
  defaultLocale: "en",
  fallback: true,
}
```

Localized: product name/description, occasion name, add-on name,
membership plan name/blurb, FAQ, announcement, page copy.
**Not localized:** anything that is not prose — prices, SKUs, slugs,
status enums, emails, phone numbers, order snapshots.

`fallback: true` is what makes this shippable: launch in English, add
Arabic at the client's pace, never show an empty page.

This also gives the storefront's existing `EN | ع` toggle real content
to switch. Today it only flips `lang`/`dir` with nothing behind it
(`src/lib/locale.tsx`).

---

## 6. Snapshot principle

An order is an **immutable historical record**, not a set of pointers.

Editing a product's price tomorrow must not change what a customer paid
today, what the receipt says, or what the accounts show. Achieved by
copying — never referencing — every commercially significant value into
the order at creation. Exactly what is copied and why:
[ORDERS §4](./ORDERS.md).

Product relationships are kept **as well**, but only for reporting
("how many Amber Hour did we sell?"). No display, price, or receipt
path may read through them.

---

## 7. Implementation order

Each step ends with: migration + tests green + progress doc + commit.
No step starts before the one above it is verified.

| # | Step | Blocked by | Deliverable |
| --- | --- | --- | --- |
| B1 | Collections, access rules, `media`, first migration, seed | — | Admin can manage all content |
| B1.5 | Admin branding, light/dark, EN/AR, dashboard shell | B1 | The admin the client actually sees |
| B2 | Storefront reads Payload instead of `lib/data.ts` | B1 | Website driven by the database |
| B3 | `enquiries`, `custom_arrangements`, forms, Resend alerts | B1 | Every lead captured — **no payment needed** |
| B4 | `carts`, `lib/pricing.ts` + tests, coupons, stock check | B2 | Real cart, authoritative totals |
| B5 | Stripe checkout, `orders`, `payments`, webhook, receipts | B4 + Stripe account | Real money |
| B6 | Customer auth (WhatsApp OTP), order history, addresses | B5 | Customer accounts |
| B7 | Memberships + Stripe subscriptions | B5 | Recurring revenue |
| B8 | Security hardening: headers, rate limits, audit wiring | B5 | Production-ready |
| B9 | Ops: backups verified, staging branch, monitoring | B8 | Launch |

**B1 → B3 ships without Stripe, without a verified email domain, and
without any legal paperwork.** That is the fastest path to an admin the
client can genuinely use.

---

## 8. Design review findings

The design was audited against its own brief after it was written.
Eleven defects were found and fixed in place; each is marked in the
document it affects.

| # | Category | Finding | Fix |
| --- | --- | --- | --- |
| 1 | **Permission escalation** | `users.stripeCustomerId` was writable by a customer editing their own record — they could paste another person's Stripe id and inherit their saved cards | Field-level `update: () => false`, server-only ([DATABASE §2](./DATABASE.md)) |
| 2 | **Lockout** | Nothing stopped the last admin being demoted or deleted, permanently locking the client out | `beforeChange`/`beforeDelete` last-admin guard ([DATABASE §2](./DATABASE.md)) |
| 3 | **Inconsistent permissions** | The matrix gave staff read on `users` "for order contacts only" — not expressible as a clean Payload constraint, and unnecessary since the order snapshot already carries every contact field | Staff have **no** access to `users` ([SECURITY §3](./SECURITY.md)) |
| 4 | **Deadlock** | The paid transaction takes four locks with no defined acquisition order; two concurrent orders would eventually deadlock | Fixed order: counters → variants (ascending id) → slot → coupon ([ORDERS §8](./ORDERS.md)) |
| 5 | **Silent data loss** | `email_events` rows are written inside the transaction and sent after commit, but nothing swept rows orphaned by a crash in between — a customer would silently never get their receipt | Reconciliation sweeps `queued` older than 15 min ([ORDERS §9](./ORDERS.md)) |
| 6 | **Payment misrouting** | Dispatching on Stripe event type alone would push a membership invoice's `payment_intent.succeeded` into the order handler, where it looks like an orphan payment | Route on `metadata.kind`, set on every intent ([PAYMENTS §4](./PAYMENTS.md)) |
| 7 | **Payment edge case** | No currency assertion — a non-AED intent would be compared against a fils total | Assert `currency === "aed"`, flag otherwise ([PAYMENTS §4](./PAYMENTS.md)) |
| 8 | **Data exposure** | `media` is a public bucket, and "cache the receipt PDF in media" is the obvious wrong shortcut | Explicit prohibition; receipts stream through an authenticated route ([DATABASE §3](./DATABASE.md)) |
| 9 | **Leak by default** | `site_settings` had blanket public read, so any operational field added later would leak | Explicit public field allow-list ([DATABASE §16](./DATABASE.md)) |
| 10 | **Referential integrity** | Zone deletion checked products and orders but not `users.addresses[].zone` | Added to the `beforeDelete` check ([DATABASE §18](./DATABASE.md)) |
| 11 | **Production risk** | `pnpm migrate` runs on preview deployments too; a misconfigured preview would migrate production from a feature branch | Three-part mitigation, including a guard that refuses to migrate a production host from a preview ([DEPLOYMENT §5](./DEPLOYMENT.md)) |

Also clarified: `custom_arrangements` converts to **one line inside a
normal order**, not an order of its own — the original wording left the
cardinality ambiguous ([DATABASE §12](./DATABASE.md)).

Reviewed and found sound, no change needed: the snapshot contract, the
two-axis status model, the coupon atomic-counter approach, the
webhook's two-layer idempotency, the decision to keep refunds in
Stripe's dashboard, and the eleven entity rejections.

---

## 9. Deliberately out of scope

- **No multi-currency.** AED only. Adding one later is a settings field
  and a display layer, not a schema change.
- **No multi-vendor / marketplace.** One atelier.
- **No inventory below variant level.** Stems are not tracked.
- **No CMS page builder.** Marketing pages stay in code where they are
  version-controlled and fast; only their copy is localized.
- **No customer-facing GraphQL.** The endpoint stays admin-authenticated.
