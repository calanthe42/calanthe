# Calanthe — Deployment, Environment & Testing

Related: [ARCHITECTURE](./ARCHITECTURE.md) · [SECURITY](./SECURITY.md) ·
[PAYMENTS](./PAYMENTS.md) · `docs/RUNBOOK.md` (operations)

---

## 1. Environment variables

`M` mandatory · `O` optional · `P` production-only value ·
`PUB` public (shipped to the browser)

### Already in the schema (`src/lib/env.ts`) ✅

| Variable | | Notes |
| --- | --- | --- |
| `DATABASE_URL` | M | Neon Postgres. Must start `postgres`. Separate branch per environment. |
| `PAYLOAD_SECRET` | M | ≥ 32 chars. Rotating it invalidates every session. |
| `NEXT_PUBLIC_SERVER_URL` | M, PUB | Absolute origin. Wrong value breaks emails and Stripe returns. |
| `SENTRY_DSN` | M in prod | Optional in dev; production **boot** fails without it. |
| `UPSTASH_REDIS_REST_URL` | M in prod | Rate limits, OTP, webhook idempotency. |
| `UPSTASH_REDIS_REST_TOKEN` | M in prod | |
| `NODE_ENV` | auto | |

### To be added

| Variable | | Phase | Notes |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | M in prod, P | B5 | `sk_test_` in dev, `sk_live_` in prod |
| `STRIPE_WEBHOOK_SECRET` | M in prod, P | B5 | **Different per environment.** From `stripe listen` in dev. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | M in prod, PUB | B5 | `pk_…`, safe to expose |
| `RESEND_API_KEY` | M in prod, P | B3 | Falls back to `ConsoleProvider` in dev |
| `RESEND_WEBHOOK_SECRET` | O | B3 | Delivery/bounce tracking |
| `EMAIL_FROM_TRANSACTIONAL` | M in prod | B3 | `Calanthe <orders@calanthe.ae>` |
| `EMAIL_FROM_MARKETING` | M in prod | B7 | `Calanthe <hello@calanthe.ae>` |
| `EMAIL_ADMIN_RECIPIENTS` | M in prod | B3 | Comma-separated |
| `BLOB_READ_WRITE_TOKEN` | M in prod | ✅ done | Vercel Blob for `media` — implemented, see §4 |
| `CRON_SECRET` | M in prod | B5 | Authorises the reconciliation job |

**No fake or placeholder secret is ever committed.** `.env.example`
carries names and comments only. Every real value is entered by the
client or by us directly in the Vercel dashboard, marked Sensitive.

The existing build-phase exemption stays: `next build` runs with
`NODE_ENV=production` but makes no network calls, so it skips the
production-only requirement while the server still refuses to boot
without it. That distinction is already implemented and is what made
the earlier deployment failures diagnosable.

---

## 2. Two Vercel projects — unresolved

Two Vercel projects are connected to the same GitHub repository:

- **`calanthe`** — the one that has been configured
- **`calanthe42/calanthe.ae.a`** — **zero environment variables**, no
  access from this account

Every push builds both. The second fails, and its failures are noise
that will eventually be mistaken for a real one.

**Action required by the client (not by us):** delete or disconnect the
unused project in the Vercel dashboard. This is a blocker for B9 and is
tracked here so it is not forgotten.

---

## 3. Environments

| | Local | Preview | Production |
| --- | --- | --- | --- |
| Database | Neon dev branch | Neon preview branch | Neon main branch |
| Stripe | test keys + `stripe listen` | test keys | live keys |
| Email | `ConsoleProvider` | `ResendProvider`, internal addresses only | `ResendProvider` |
| Redis | optional (dev only) | required | required |
| Migrations | `pnpm migrate` manually | on deploy | on deploy |

**Preview deployments must never touch the production database.** A
seed script run against the wrong branch is unrecoverable, and Neon
branching exists precisely to make this impossible.

---

## 4. Media storage — RESOLVED (Vercel Blob)

Payload's default adapter writes to local disk, and **Vercel's filesystem
is ephemeral**: uploads survive until the next deployment, then vanish
silently. This section records how that is now prevented.

### Provider

**Vercel Blob** — `@payloadcms/storage-vercel-blob`, wired in
`src/backend/payload/storage.ts` and registered as a plugin in
`src/payload.config.ts`.

Chosen over Cloudflare R2 and S3 because it adds no second vendor, no
second bill and no second credential to rotate: Vercel injects the token
itself. R2 is cheaper at high image bandwidth and remains the sensible
migration later — swapping the adapter is a config change, not a schema
change, so that door stays open.

### Environment variable

| Variable | | Notes |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | M in prod, P | **Server-side only — never `NEXT_PUBLIC_`.** Injected automatically by Vercel once a Blob store is connected to the project. |

Declared in `src/lib/env.ts`, listed in `.env.example`, and included in the
production-runtime required set. It is **not** required during `next build`
(the build makes no network calls), so a build never needs a runtime secret.

### Behaviour per environment

| | Storage | On a missing token |
| --- | --- | --- |
| **Local** | `./uploads` on disk | Expected. Logs an explicit warning naming the fallback. |
| **Preview** | Vercel Blob | Falls back to local disk. Acceptable — preview data is disposable. |
| **Production** | Vercel Blob | **Refuses to boot.** `resolveStorageMode()` throws rather than writing to an ephemeral disk. |

The fallback is deliberate and explicit, never silent: production cannot
reach it, and development says so out loud. `resolveStorageMode()` is a pure
function and is unit-tested for all six of these cases.

### Upload limits and accepted types

- **4 MB per file**, enforced by `upload.limits` in the Payload config.
  Vercel caps a serverless request body at 4.5 MB; without an explicit limit
  the platform returns an opaque 413 that looks like a bug. With it, Payload
  returns a readable validation error.
- **Raster images only** — `image/jpeg`, `image/png`, `image/webp`,
  `image/avif`. **SVG is deliberately excluded**: it is a script container,
  not a picture. Payload also sniffs the real type, so renaming a `.svg` to
  `.jpg` does not get through.
- Sharp still generates the four sizes (`thumbnail`, `card`, `hero`, `og`)
  and all metadata — filename, mime type, filesize, width, height, focal
  point — is preserved in Postgres. **No binaries are stored in the
  database**, only URLs and metadata.

> **Raising the 4 MB limit** requires client-side uploads
> (`clientUploads`), which upload straight from the browser to Blob and
> bypass the body limit. It is deliberately **off**: as shipped it defaults
> to `access: ({ req }) => !!req.user`, which would let any signed-in
> *customer* mint an upload token, and it hardcodes `allowOverwrite: true`
> on a caller-chosen pathname. The correct access rule is written down as
> `clientUploadAccess` in `storage.ts`; enabling it needs testing against a
> live Blob store.

### Existing `/uploads` files

**None exist.** The directory is empty and the `media` table has zero rows,
so there is nothing to migrate. `/uploads` is gitignored and remains the
local-development target only. If files ever do accumulate there before a
Blob store is connected, they are development artefacts and can be deleted.

### `next.config.ts`

`images.remotePatterns` now includes `*.public.blob.vercel-storage.com`.
Payload currently serves media through its own same-origin route
(`/api/media/file/...`), so this is not strictly required today — it is
there so that enabling `disablePayloadAccessControl` later, which switches
to direct CDN URLs, does not silently break every image on the site. The
Unsplash and Pexels entries are removed once the placeholder photography is
gone.

---

## 5. Deploy pipeline

```
git push
  │
  ├─ CI (GitHub Actions)          must be green to merge
  │    pnpm install --frozen-lockfile
  │    tsc --noEmit
  │    eslint
  │    vitest run
  │    pnpm audit --audit-level=high
  │
  └─ Vercel
       Build:  pnpm migrate && next build
       │       migrations run BEFORE the build so a schema mismatch
       │       fails the deploy instead of the running site
       └─ Deploy
```

Build notes:

- **Webpack, not Turbopack**, for production builds — Payload blocks
  Turbopack builds on Next 15. Dev still uses Turbopack. Already
  recorded in `docs/PROGRESS/B0.md`.
- Migrations run in the build command. A failed migration fails the
  deploy, which is the correct outcome.
- **Migrations must be backward-compatible for one deploy**: old code
  briefly runs against the new schema. Never drop a column in the same
  deploy that stops using it — drop it one deploy later.

> **Risk caught in design review.** `pnpm migrate` in the build command
> runs on **every** deployment, including previews, against whatever
> `DATABASE_URL` that environment holds. A preview environment
> misconfigured with the production URL would migrate production from a
> feature branch. Mitigations, all three required:
> 1. Preview environments use Neon **branch** URLs, never the main
>    branch — verified in the Vercel dashboard, not assumed.
> 2. The migrate step refuses to run when `VERCEL_ENV=preview` and
>    `DATABASE_URL` matches the production host.
> 3. Neon point-in-time restore is rehearsed before launch (§6).

---

## 6. Rollback

| Broken | Action |
| --- | --- |
| Code | Vercel → promote the previous deployment. Seconds. |
| Migration | **Not automatic.** Write a forward migration that reverses it. This is why migrations are reviewed like code. |
| Data | Neon point-in-time restore. **Must be tested before launch, not during an incident.** |
| Secret leaked | Rotate at the provider, update Vercel, redeploy. `PAYLOAD_SECRET` rotation logs everyone out. |

---

## 7. Switching VAT on later

The client is **not** VAT-registered today ([DATABASE §16](./DATABASE.md)).
When she registers:

1. Set `vatEnabled: true`, `vatRatePercent: 5`, `vatTrn: <TRN>` in
   Shop Settings.
2. Nothing else changes. No migration, no deploy.

Every order already snapshots the VAT state at purchase time, so past
orders stay VAT-free and past receipts stay correct. Receipts issued
after the switch print the TRN and a separate VAT line.

**No legal requirement is invented here.** The design records what the
business tells us and keeps the evidence; the client's accountant
decides when to register and what the receipt must say.

---

## 8. Testing

Required green before production. Nothing below is optional.

### Always (CI, every push)

| | Command |
| --- | --- |
| Types | `tsc --noEmit` |
| Lint | `eslint` |
| Unit + integration | `vitest run` |
| Production build | `next build` |
| Dependency audit | `pnpm audit --audit-level=high` |

### Pricing — pure functions, no database

Empty cart · single item · quantity clamping · add-ons ·
variant delta including a **negative** delta · percent coupon ·
fixed coupon · coupon larger than subtotal (**never negative**) ·
`minOrderFils` not met · expired · exhausted · free-delivery threshold
exactly at, one fils under, one fils over · threshold measured on the
**discounted** subtotal · VAT off (default) · VAT on · rounding
half-up · a total that exceeds `Number.MAX_SAFE_INTEGER` throws.

### Snapshot immutability

Create order → change the product's price, name and image, then archive
it → re-render the receipt → **assert every value byte-identical**.
The single most important test in the suite.

### Access control — one per collection

For each of `orders`, `carts`, `enquiries`, `custom_arrangements`,
`membership_subscriptions`: customer A creates, customer B attempts read
and update by id → **404, not 403**.

Plus: staff cannot read `coupons` · staff cannot write
`products.basePriceFils` · staff cannot read `payments` · customer
cannot read `orders.floristNotes` · nobody can update `orders.amounts` ·
nobody can delete an order · nobody can update or delete `audit_log` ·
a customer cannot change their own `role` (escalation) · an
unauthenticated request to every collection returns nothing.

### Orders

Illegal transition throws (`delivered` → `preparing`) ·
`fulfilmentStatus` cannot leave `awaiting_payment` while unpaid ·
order numbers are gap-free under 50 concurrent creations ·
timeline is append-only · cancelled orders are not deleted.

### Stripe webhook

Every row of [PAYMENTS §9](./PAYMENTS.md): valid signature · tampered
body → 400 · missing header → 400 · duplicate event is a no-op ·
duplicate **with Redis flushed** is still a no-op · out-of-order refund ·
amount mismatch flagged not fulfilled · handler throws → 500 ·
two concurrent successes decrement stock exactly once · two concurrent
coupon redemptions grant exactly one · unknown event type → 200.

### Email

Gift notification contains **no price** (rendered from a real order) ·
`GiftContext` has no amount field (compile-time) · the runtime price
scan actually fires on an injected amount · marketing without consent
throws · **transactional without consent still sends** · unsubscribed
address still receives a receipt · provider failure marks `failed`
after 3 attempts without touching the order · duplicate Resend webhook
is idempotent.

### Manual, before launch

Real card in Stripe test mode, end to end · a real refund from the
Stripe dashboard · Neon point-in-time restore rehearsed · admin on a
phone · keyboard-only navigation of the order screen · light and dark
themes · Arabic admin language · an upload larger than 10 MB rejected ·
a `.svg` renamed to `.jpg` rejected.
