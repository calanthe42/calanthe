# CALANTHE

Luxury flower atelier e-commerce (UAE). Next.js storefront + Payload CMS
backend in one app. Staging: https://calanthe.vercel.app

## Stack

- **Next.js 15** (App Router, React 19) · **TypeScript strict**
- **Payload CMS 3** — admin panel, collections, auth (`/admin`)
- **PostgreSQL (Neon)** via Payload's Drizzle adapter — migrations only, never push
- **Tailwind CSS v4** — brand tokens in `src/styles/tokens.css` (only brand colors exist)
- **Upstash Redis** (rate limits, OTP, idempotency) · **Sentry** · **Zod** at every boundary
  — both Upstash and Sentry become **required in production** in A1; see Infrastructure below
- **pnpm** · Vitest · ESLint + Prettier

## Infrastructure

Verified 2026-09-25.

| | Where | Verified |
| --- | --- | --- |
| Neon (database) | `aws-ap-southeast-1` (Singapore) | project `calanthe-sg`, Postgres 18 |
| Vercel (functions) | **`sin1`** (Singapore) | live: `X-Vercel-Id: bom1::sin1::…` |
| Upstash Redis | `ap-southeast-1` (Singapore) | live: a failed sign-in on www.calanthe.ae wrote real rate-limit keys |
| Sentry | project live, **EU (Germany)** region | ingest accepted a test event; client + server |
| Resend | domain `calanthe.ae`, `eu-west-1` | SPF verified, DKIM verifying |
| Stripe | **test keys only**, Preview + Development | `livemode: false`, AED, UAE account. Never in Production |

The region move is complete: production runs in Singapore and reads the
Singapore database.

### Email (A2)

Registration on the live site sent nothing: Payload had no transport, so it
wrote the verification link to the server console and reported success. The
logs looked fine and the customer heard nothing.

`backend/email` is a provider seam, not Resend imported everywhere — tests
never touch the network and changing vendor is one file. Payload's own
verification and reset mail routes through the same path, so it obeys the
same rules and leaves the same evidence.

Four rules hold it together:

1. **The gifting rule is a compile error, not a review note.** A
   recipient-facing email may never carry a price (`EMAILS.md` §3), so the
   money never reaches those functions: `RecipientFacing` has no price
   fields and types them `never`. Passing a priced order into the florist's
   job sheet does not compile.
2. **A failed email never fails an order.** `sendEmail` has no throwing
   path — provider down, no API key, log write failed — every outcome
   resolves to a logged row.
3. **Nothing sends before the database commits.** A confirmation must not be
   able to arrive for an order that was rolled back.
4. **Preview cannot email a real customer.** Preview runs against a copy of
   real customer data. Outside production only `EMAIL_ALLOWLIST` addresses
   are sent to; anything else is *suppressed* — recorded with a reason,
   never silently dropped.

`email_log` is an audit trail: server-written, read-only in the admin, and
undeletable by anyone including the owner. A resend writes a new row rather
than mutating the old one. The provider's message id is stored because it is
the only thing that can prove delivery afterwards.

Domain `calanthe.ae` is verified in Resend — DKIM and all three SPF records.

### /cms is owner-only

A fulfilment status changed in Payload's own `/cms` sends **no email**. The
status email is deliberately not a collection hook — a hook writes to
`email_log` through a second connection inside Payload's transaction and
deadlocks until the database terminates it — so the send lives in the
`/admin` action, and a direct `/cms` edit skips it.

Staff therefore work in `/admin`, where it fires. `canAccessAdminPanel`
gates **only** `/cms`; the business admin authenticates through
`getAdminSession`, which still admits staff.

### Production never applies the email allowlist

`decideRecipient` returns `allowed: true` on its first line when
`VERCEL_ENV === "production"`, before the list is even parsed. `EMAIL_ALLOWLIST`
is set on Preview and Development only. There is a test asserting that a
populated list is ignored in production — the failure it guards against is a
real customer's order confirmation being silently dropped because their
address was not on a developer's list.

### Redis keys are namespaced by environment

Production and Preview share one Upstash database, and keys were written as
`rl:<bucket>:<identifier>` — so a preview deployment shared production's
rate-limit buckets. A burst of testing could lock a real customer out of
signing in, and once A5 lands, a webhook id replayed in preview would mark a
production event already handled. Every key is now prefixed with `VERCEL_ENV`
(`production:`, `preview:`, `local:`).

### Preview shares production's Blob store — do not delete media there

One `BLOB_STORE_ID` covers both environments, the preview database holds
filenames copied from production, and `handleDelete` keys objects by filename
alone. **Deleting a media document in the preview admin deletes the live
file.** Steps for a separate preview store are in `docs/OWNER_TODO.md`.
Until then, preview is read-only for media, and the preview catalogue is
published from `legacyImages` — real photography, no Blob writes
(`scripts/seed-preview-catalogue.mts`, which refuses to run against
production).

### A broken photograph can no longer take down a page

`next/image` does not degrade: handed a URL whose host is not in
`images.remotePatterns` it throws during render, and in a Server Component a
throw is a 500. `checkImageSrc` now decides before the URL reaches
`next/image`, so anything unrenderable becomes the botanical placeholder and
is reported to Sentry instead. `FloralImage` is the single image slot for
product, shop, home, occasions, cart and checkout, so one guard covers all
six.

### Product pages render per request

`/product/[slug]`, `/occasions/[slug]` and `/shop/[slug]` were ISR routes
with `generateStaticParams` while the locale is read with `cookies()` — safe
only for paths prerendered at build time. With every product hidden, that set
was empty and **every product URL returned 500**, including slugs that do not
exist. They are `force-dynamic` until A8 moves the locale into the URL.
Proven by `scripts/prove-dynamic-routes.mts`, which builds with zero
available products and then publishes one without rebuilding.

### Why Singapore, and not Frankfurt

Frankfurt is ~1,000 km closer to the UAE than Singapore, so on a map it is the
obvious choice. It is also the slower one. Measured from Abu Dhabi, 30 TCP
connects per region across three different AWS service endpoints, DNS resolved
once so the figure is transport only:

| Region | Median (run 1) | Median (run 2) | Fastest seen |
| --- | --- | --- | --- |
| `ap-southeast-1` Singapore | **89.0 ms** | **88.6 ms** | 84.0 ms |
| `eu-central-1` Frankfurt | 116.1 ms | 119.3 ms | 106.9 ms |
| `us-east-2` Ohio (previous) | 202.3 ms | 202.4 ms | 195.8 ms |

Singapore is ~30 ms (25%) ahead of Frankfurt, consistently across both runs.
Submarine cable routing out of the Gulf, not distance, decides this. Mumbai
would very likely have beaten both, but **Neon does not offer it** — the
region list is `aws-us-west-2, aws-ap-southeast-1, aws-ap-southeast-2,
aws-eu-central-1, aws-us-east-2, aws-us-east-1, azure-eastus2`. Upstash is
created in `ap-southeast-1` to sit beside the functions, so a rate-limit check
is a local round trip.

Reproduce with `scripts/latency-probe.ps1`.

### The move, 2026-09-25

Ohio → Singapore. Production held **0 orders and 0 customers**, so the write
freeze cost nothing; 99 rows moved in total.

Schema was **not** dumped. The new database was built by running the same ten
reviewed migration files (`pnpm migrate`), which is what `push: false` exists
to guarantee, and only rows were copied (`scripts/db-copy.mts`, one
transaction, parents before children, sequences reset afterwards).

Equality was then established twice over:

| Check | Tool | Result |
| --- | --- | --- |
| Row counts, migrations, products, accounts | `scripts/db-inventory.mts`, diffed | identical, byte for byte |
| Every column of every row | `scripts/db-checksum.mts` (md5 over sorted row text) | **30 tables, 99 rows, no mismatch** |
| COD checkout end to end, on the preview branch | `scripts/cod-security-test.mts` | **27 passed, 0 failed** |

The checksum matters more than the counts: two tables can hold the same
number of different rows. It also settles the sign-in question without
needing anyone's password — `users` hashes identically, so the salts and
password hashes survived, and `PAYLOAD_SECRET` was deliberately never
touched.

**Preview is no longer production.** Until this move a single `DATABASE_URL`
record covered Production, Preview *and* Development, so every preview
deployment read and wrote the live database. There are now three separate
records: Production → the new project's `production` branch, Preview and
Development → its `preview` branch.

### Sequences — the part a row copy silently gets wrong

Copying rows does not move sequences, and the obvious fix is incomplete.
`pg_get_serial_sequence()` only finds sequences **owned by a column**, and
Calanthe has two that are not: `calanthe_order_number_seq` and
`calanthe_enquiry_number_seq` are created standalone by their migrations and
read with `nextval()` in a hook, deliberately, so the customer-facing number
is not the row id. The first copy left both sitting at 1 while Ohio had
already issued 19 order numbers and 17 enquiry numbers.

For orders that was cosmetic — the table is empty, so nothing could collide.
For enquiries it was a live defect in waiting: the one surviving enquiry holds
`CAL-E-000017`, `enquiryNumber` is `unique: true`, and so the **seventeenth**
real Build-Your-Own submission would have collided and failed for a customer.

Both sequences are now set to match the source. The rule, for any future
copy: a customer-facing number series may be ahead of its source, never
behind.

`scripts/db-sequences.mts` audits every sequence in `pg_sequences`, owned or
not, `--fix` corrects them, and `--prove` inserts a real row into each copied
table, checks the id the sequence handed out, deletes it and rolls back — a
consumed sequence value survives a rollback, which is what makes it a proof
rather than a simulation. On the preview branch: **10 tables, all pass, no
test row survives.**

### Credentials

`neondb_owner` was rotated on both branches after the copy — the new
project's original password had been echoed to a terminal by `neonctl` during
creation. The rotated values went straight into Vercel's Production, Preview
and Development records. `PAYLOAD_SECRET` is untouched.

**The catalogue moved as it was, and it is hidden.** All ten products carry
`available: false` and have no uploaded photography — only `legacyImages`
pointing at an external host — which is why the live shop renders zero
products today. That is unchanged by the move and is a content decision, not
a fault: the products are marked available in `/admin` once their real
photographs are in. The demo seed (`scripts/seed-demo-catalogue.mts`) has
never run against production and must not.

**Rollback, and the retention window.** The old Ohio project is kept,
untouched and complete, and stays that way for **seven days after cutover** —
do not delete it before then. Nothing in the move is destructive to it, and
the rollback is three steps: point `DATABASE_URL` back at it, remove
`regions` from `vercel.json`, redeploy.

Project and branch identifiers, and the exact rollback commands, are in
`docs/infra-ids.local.md`. That file is **git-ignored on purpose** — the
identifiers authenticate nothing by themselves, but they name our
infrastructure and do not belong in a repository. Recover it after a fresh
clone with `neon projects list` and `vercel project inspect`.

Compute was matched to Ohio's (0.25–2 CU) on the production endpoint; the
preview endpoint stays at 0.25 CU.

**The one enquiry is a test.** `CAL-E-000017`, submitted 2026-09-19 from
`dev.calanthe@gmail.com` — the developer account — and quoting the old
AED 60 vase price. It is kept, not deleted, because it is the only row
proving the Build-Your-Own path ever wrote to this table.

## Prerequisites

- Node 20+ (dev machine runs 24), pnpm 11
- A Neon Postgres connection string (dev branch)

## Install & run

```bash
pnpm install
cp .env.example .env.local        # fill in DATABASE_URL + PAYLOAD_SECRET
pnpm migrate                      # apply DB migrations
pnpm dev                          # storefront http://localhost:3000, admin /admin
```

First visit to `/admin` offers the create-first-user screen — that
account is the owner (role: admin).

## Common commands

```bash
pnpm dev                 # dev server (Turbopack)
pnpm build && pnpm start # production build + serve (webpack — Payload requires it on Next 15)
pnpm test                # Vitest (money/pricing unit tests)
pnpm lint                # ESLint
pnpm migrate             # apply pending Payload/Drizzle migrations
pnpm migrate:create      # create a migration after schema changes
pnpm generate:types      # regenerate src/payload-types.ts
```

## Environment variables

See `.env.example`. Required to boot: `DATABASE_URL`, `PAYLOAD_SECRET`.
Required in production runtime: `SENTRY_DSN`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`. Env is Zod-validated at boot (`src/lib/env.ts`)
— the server refuses to start on a bad configuration.

## Project documentation

- `PROJECT-BRAIN.md` — how the whole system works; real vs pending
- `brand/backend-architecture.md` — the backend spec (locked)
- `docs/RUNBOOK.md` — operate/run/debug instructions
- `docs/SECURITY.md` — security checklist + status
- `docs/PROGRESS/` — one doc per build phase (B0…)
- `CHANGELOG.md`

## Structure

```
src/
  app/(frontend)/       # storefront (route group with its own root layout)
  app/(payload)/        # Payload admin + REST/GraphQL API
  collections/          # Payload collections (deny-by-default access)
  payload.config.ts     # Payload configuration
  migrations/           # Drizzle migrations (source of truth for schema)
  lib/                  # env (Zod), money (fils), redis, data, pricing (B3)
  components/           # ui / motion / blocks / commerce
```

Design law lives in `CLAUDE.md` + `.claude/skills/calanthe-design`.
Homepage order/copy are client-locked (`brand/client-vision.md`).
