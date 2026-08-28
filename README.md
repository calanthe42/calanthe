# CALANTHE

Luxury flower atelier e-commerce (UAE). Next.js storefront + Payload CMS
backend in one app. Staging: https://calanthe.vercel.app

## Stack

- **Next.js 15** (App Router, React 19) · **TypeScript strict**
- **Payload CMS 3** — admin panel, collections, auth (`/admin`)
- **PostgreSQL (Neon)** via Payload's Drizzle adapter — migrations only, never push
- **Tailwind CSS v4** — brand tokens in `src/styles/tokens.css` (only brand colors exist)
- **Upstash Redis** (rate limits, OTP, idempotency) · **Sentry** · **Zod** at every boundary
- **pnpm** · Vitest · ESLint + Prettier

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
