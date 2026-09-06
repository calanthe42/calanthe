# Calanthe — Project Structure

How the codebase is organised so that **frontend, backend, admin and
shared** are obvious at a glance, without fighting Next.js or Payload.

Status: **proposed**. No files have been moved.

Related: [ARCHITECTURE](./ARCHITECTURE.md) · [SECURITY](./SECURITY.md) ·
[DEPLOYMENT](./DEPLOYMENT.md)

---

## 1. Current structure

```
src/
├── app/
│   ├── (frontend)/            21 storefront routes + layout + globals.css
│   ├── (payload)/             admin, REST, GraphQL, custom.css, importMap
│   ├── global-error.tsx
│   └── global-not-found.tsx
├── collections/               Users.ts        ← 1 file
├── components/
│   ├── blocks/                23 files        page sections
│   ├── commerce/              12 files        cart, checkout, product
│   ├── motion/                13 files        animation primitives
│   └── ui/                     9 files        design system
├── lib/                       16 files        ← everything else
├── styles/tokens.css
├── instrumentation.ts
└── payload.config.ts
```

110 TypeScript files, 36 of them client components.

---

## 2. Problems

### 2.1 `src/lib/` is four unrelated things in one folder

| File | Actually is |
| --- | --- |
| `env.ts` | **Server secrets** — `DATABASE_URL`, `PAYLOAD_SECRET` |
| `redis.ts` | **Server secret** — Upstash REST token |
| `money.ts`, `cn.ts` | Pure, safe anywhere |
| `data.ts` | 700 lines of mock catalogue |
| `cart.tsx`, `wishlist.tsx`, `toast.tsx`, `locale.tsx` | Client React contexts |
| `use*.ts` | Client hooks |
| `auth.ts` | `localStorage` mock |
| `delivery.ts` | Pure date logic |

**This is the most serious problem in the repository.** A developer
writing a client component imports `@/lib/cn` and `@/lib/cart` every
day. `@/lib/env` sits in the same folder, one autocomplete away, and it
holds the database password.

Today nothing leaks — `env` is imported by exactly three server files
(`instrumentation.ts`, `redis.ts`, `payload.config.ts`), verified. But
**nothing prevents it.** There is no `server-only` package installed, no
lint rule, and no folder boundary. The protection is that nobody has
made the mistake yet.

### 2.2 No place for backend code to go

`src/collections/` holds one file. `pricing.ts`, `orders/`, `payments/`,
`email/` have nowhere to live that isn't `lib/` — the folder that is
already overloaded and already client-adjacent.

### 2.3 No place for admin code to go

The custom dashboard, the AED field component and the order screen
([ADMIN](./ADMIN.md)) are React components that render **inside Payload's
admin**. They are neither storefront UI nor business logic.

### 2.4 `@/*` says nothing

`import { x } from "@/lib/y"` gives no signal about whether `y` is safe
in a browser. Every alias looks identical, so every import needs a
mental lookup.

### 2.5 Business logic already leaking into components

`useDeliverySchedule.ts` and `delivery.ts` compute the same-day cutoff.
That rule belongs in one server-authoritative place, because the server
must re-validate it at checkout ([ORDERS §3](./ORDERS.md)). Today it
exists only as client code.

### 2.6 Repository hygiene

- `Calanthe_Final Files/` — 6.2 MB of `.ai`, `.pdf`, `.ttf`, `.zip`
  brand source. Correctly ignored already (`/Calanthe_Final Files/` in
  `.gitignore`). It therefore exists **only on this machine** and is not
  backed up by git — the client's master brand files need a copy
  elsewhere.
- `_m.mjs`, `_m2.mjs`, `_qa.mjs` — **tracked** temporary scripts.
- `.gitignore` had `.vercel` and `.env*` listed twice, the second
  `.env*` sitting *after* `!.env.example` — latent enough to re-ignore
  the example file the moment it stopped being tracked.
- Commit messages: `kajshfkjsafsaf39823983`, `done done dovcbxvcb`.

---

## 3. Final proposed structure

The constraint that shapes everything: **Next.js routes must live in
`src/app/`, and Payload's admin routes must live inside them.** The
boundary therefore cannot be four top-level folders alone. It is
expressed as:

> `src/app/` is a **routing layer only**. Pages compose and pass props.
> They never implement. The four boundaries live beside it.

```
src/
│
├── app/                          ROUTING ONLY — thin, no business logic
│   ├── (frontend)/               storefront routes
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── (storefront)/         21 pages
│   ├── (payload)/                ⚠ PAYLOAD-OWNED — do not hand-edit
│   │   ├── admin/[[...segments]]/
│   │   ├── admin/importMap.ts    generated
│   │   ├── api/[...slug]/        REST
│   │   ├── api/graphql/
│   │   └── layout.tsx
│   ├── api/                      OUR handlers — thin, delegate to backend
│   │   ├── webhooks/stripe/
│   │   ├── webhooks/resend/
│   │   └── cron/reconcile/
│   ├── global-error.tsx
│   └── global-not-found.tsx
│
├── frontend/                     ← CUSTOMER UI.  Never imports backend.
│   ├── components/
│   │   ├── blocks/               page sections (23)
│   │   ├── commerce/             cart, checkout, product (12)
│   │   ├── motion/               animation primitives (13)
│   │   └── ui/                   design system (9)
│   ├── hooks/                    useScrollLock, useReducedMotionPref…
│   ├── providers/                cart, wishlist, locale, toast, lenis
│   └── styles/                   tokens.css
│
├── backend/                      ← SERVER ONLY.  `import "server-only"`.
│   ├── payload/
│   │   ├── payload.config.ts
│   │   ├── collections/          schema + access
│   │   ├── globals/              site_settings
│   │   ├── access/               ONE definition of each access fn
│   │   ├── hooks/                revalidate, audit, guards
│   │   └── migrations/
│   ├── domain/                   business logic — pure where possible
│   │   ├── pricing/              pricing.ts + tests  (NO db, NO clock)
│   │   ├── orders/               creation, numbering, transitions
│   │   ├── carts/                merge, expiry
│   │   └── memberships/
│   ├── data/                     ⭐ the ONLY place the Local API is called
│   │   ├── products.ts
│   │   ├── occasions.ts
│   │   ├── orders.ts
│   │   └── settings.ts
│   ├── integrations/
│   │   ├── stripe/               client, webhook, reconciliation
│   │   ├── email/                provider iface, templates, outbox
│   │   ├── storage/              Vercel Blob
│   │   └── redis/                rate limits, OTP, idempotency
│   ├── auth/                     sessions, OTP
│   └── config/
│       └── env.ts                🔒 secrets — one folder, obviously server
│
├── admin/                        ← ADMIN UI.  Renders inside Payload.
│   ├── views/                    Dashboard, OrderScreen
│   ├── fields/                   AedInput, StatusButtons, GiftBanner
│   ├── components/               shared admin bits
│   └── styles/
│       └── admin.css             Calanthe theme, light + dark
│
├── shared/                       ← SAFE BOTH SIDES.  No secrets, no DB, no React.
│   ├── types/
│   │   ├── payload-generated.ts  generated — pure types, zero runtime
│   │   └── index.ts
│   ├── schemas/                  Zod — client forms AND server validation
│   ├── constants/                cutoff hour, min budget, thresholds
│   └── utils/                    money.ts, cn.ts, format.ts
│
├── instrumentation.ts            ⚠ Next requires this at src root
└── middleware.ts                 ⚠ if added, must be at src root
```

### What moves where

| From | To |
| --- | --- |
| `components/**` | `frontend/components/**` |
| `lib/cart.tsx`, `wishlist.tsx`, `toast.tsx`, `locale.tsx`, `lenis-context.ts` | `frontend/providers/` |
| `lib/use*.ts` | `frontend/hooks/` |
| `lib/auth.ts` | `frontend/providers/` (it is a `localStorage` mock; deleted in B6) |
| `styles/tokens.css` | `frontend/styles/` |
| `lib/env.ts` | `backend/config/env.ts` |
| `lib/redis.ts` | `backend/integrations/redis/` |
| `payload.config.ts` | `backend/payload/payload.config.ts` |
| `collections/Users.ts` | `backend/payload/collections/` |
| `lib/money.ts` + test | `shared/utils/money.ts` |
| `lib/cn.ts` | `shared/utils/cn.ts` |
| `lib/delivery.ts` | split: pure date helpers → `shared/utils/`; the **cutoff rule** → `backend/domain/orders/` |
| `lib/data.ts` | split — see §17.3 |

### Aliases

`@/*` is **replaced**, not supplemented. Two ways to import one file is
how a boundary rots.

```jsonc
"paths": {
  "@frontend/*": ["./src/frontend/*"],
  "@backend/*":  ["./src/backend/*"],
  "@admin/*":    ["./src/admin/*"],
  "@shared/*":   ["./src/shared/*"],
  "@payload-config": ["./src/backend/payload/payload.config.ts"]
}
```

Now every import states its own safety:

```ts
import { formatFils } from "@shared/utils/money";      // safe anywhere
import { getProducts } from "@backend/data/products";  // server only
import { ProductCard } from "@frontend/components/commerce/ProductCard";
```

---

## 4. FRONTEND boundary

**Is:** everything the customer sees. React components, client
providers, hooks, design system, storefront styles.

**May import:** `@shared/*`, other `@frontend/*`, React, Next, GSAP.

**May NOT import:** `@backend/*` — **zero exceptions**, `@admin/*`,
`payload`, any database client, `process.env`.

**Data arrives as props.** A page in `src/app/(frontend)/` is a Server
Component: it calls `@backend/data/*`, then passes plain objects down.
No component in `src/frontend/` ever queries anything.

```tsx
// src/app/(frontend)/(storefront)/shop/page.tsx     ← routing layer
import { getActiveProducts } from "@backend/data/products";
import { ShopGrid } from "@frontend/components/commerce/ShopGrid";

export default async function ShopPage() {
  const products = await getActiveProducts();   // server
  return <ShopGrid products={products} />;      // pure UI
}
```

This one rule is why the boundary holds: the *only* files that touch
both sides are route files, and there are few of them and they are
short.

---

## 5. BACKEND boundary

**Is:** business logic, database access, auth, pricing, orders,
payments, email, integrations, Payload config and collections.

**May import:** `@shared/*`, other `@backend/*`, `payload`, provider
SDKs, `process.env` (only inside `backend/config/`).

**May NOT import:** `@frontend/*`, `@admin/*`, any React component.

**Every entry point starts with:**

```ts
import "server-only";
```

That package has no runtime; it declares a `react-server` export
condition, so importing it from a Client Component is a **build
failure**, not a runtime surprise. It is the mechanism that turns this
document into an enforced rule rather than a convention.

`backend/domain/pricing/` is additionally **pure**: no database, no
network, no `Date.now()`. Time and loaded records are passed in. That is
what makes money testable ([DEPLOYMENT §8](./DEPLOYMENT.md)).

---

## 6. ADMIN boundary

**Is:** Calanthe's internal management interface — the custom dashboard,
the order screen, the AED input, the admin theme.

**May import:** `@backend/*`, `@shared/*`, `@payloadcms/ui`.

**May NOT import:** `@frontend/*`. The storefront's design system serves
customers; the admin has its own visual language inside Payload's shell.
Sharing them would couple a redesign of one to the other. Brand tokens
are shared as **CSS custom properties**, not as React components.

Admin views are Server Components querying via the Local API, so there
is no extra endpoint to secure.

> **Schema vs presentation.** A collection's `access` rules and fields
> are **backend** (`backend/payload/collections/`). How that collection
> *looks* — a custom view, a custom field widget — is **admin**
> (`src/admin/`). The collection references admin components by path
> through Payload's `importMap`; that is the seam.

---

## 7. SHARED boundary

**Is:** genuinely safe in both environments — types, Zod schemas,
constants, pure utilities.

**May import:** `zod`, `clsx`, `tailwind-merge`. Nothing else.

**May NOT import:** anything from `@frontend`, `@backend`, `@admin`;
`payload`; any SDK; `process.env`; React.

**The test for admission:** *would shipping this file to the browser be
harmless, and does it work on the server unchanged?* If either answer is
no, it does not belong here.

`shared/schemas/` is the highest-value folder in the project. One Zod
schema validates the checkout form in the browser **and** the request
body on the server — impossible to drift, because it is one file.

`shared/types/payload-generated.ts` is Payload's generated output. Types
are erased at build, carry zero runtime and cannot leak a secret, so a
generated file is safe here.

---

## 8. Payload-specific structure

Payload is **not a separate application.** It is a set of route handlers
and a React admin mounted inside this Next.js app, sharing its build,
its deployment and its `node_modules`. Pretending otherwise would be a
lie the folder tree tells.

### Fixed by the framework — cannot move

| Path | Why |
| --- | --- |
| `src/app/(payload)/admin/[[...segments]]/` | A Next.js route. The admin URL *is* this file. |
| `src/app/(payload)/api/[...slug]/` | REST endpoints |
| `src/app/(payload)/api/graphql/` | GraphQL endpoint |
| `src/app/(payload)/layout.tsx` | Payload's root layout (second root layout) |
| `src/app/(payload)/admin/importMap.ts` | Generated by `payload generate:importmap`; Payload expects it here |
| `src/instrumentation.ts` | Next.js requires it at `src/` root |

**These files are thin re-exports of Payload internals. They are
generated, they are not ours to edit, and `(payload)` marks them.**

### Configurable — moves to `src/backend/payload/`

| What | How |
| --- | --- |
| `payload.config.ts` | `@payload-config` tsconfig alias |
| collections, globals, access, hooks | plain imports from the config |
| `migrations/` | `migrationDir` in the Postgres adapter |
| generated types | `typescript.outputFile` → `src/shared/types/` |
| admin CSS | `admin.css` in config → `src/admin/styles/` |

### The relationship, stated plainly

```
  src/app/(payload)/**          the mount point   (framework, generated)
        │  imports @payload-config
        ▼
  src/backend/payload/**        the definition    (ours)
        │  admin.components reference by path
        ▼
  src/admin/**                  the appearance    (ours)
```

Two root layouts already exist in this app — `(frontend)` and
`(payload)` — because the storefront and the admin need genuinely
different HTML shells. That is a deliberate Next.js pattern, already
working, and it is the seam the whole structure hangs on.

---

## 9. Dependency direction

```
   ┌───────────────────────────────────────────────┐
   │                    app/                       │
   │        routing only — the only layer          │
   │        allowed to touch both sides            │
   └───┬───────────────┬───────────────┬───────────┘
       │               │               │
       ▼               ▼               ▼
  ┌─────────┐    ┌──────────┐    ┌─────────┐
  │ frontend│    │  admin   │───►│ backend │
  └────┬────┘    └────┬─────┘    └────┬────┘
       │              │               │
       └──────────────┴───────────────┘
                      │
                      ▼
                ┌──────────┐
                │  shared  │  ← depends on nothing
                └──────────┘
```

| From | May import |
| --- | --- |
| `app/(frontend)/**` | `frontend`, `shared`, `backend/data` (Server Components only) |
| `app/(payload)/**` | `@payload-config` |
| `app/api/**` | `backend`, `shared` |
| `frontend/**` | `shared` — **never `backend`**, never `admin` |
| `admin/**` | `backend`, `shared` — never `frontend` |
| `backend/**` | `shared` — never `frontend`, never `admin` |
| `shared/**` | **nothing** in this repo |

**No cycles are possible**, because the graph is a DAG by construction:
`shared` is a sink, `app` is the only source, and `frontend`/`backend`
never reference each other.

### Enforcement — three layers, not a promise

1. **`server-only`** at the top of every backend entry point → a client
   import is a build error.
2. **`client-only`** in `frontend/providers/` → a server import is a
   build error.
3. **ESLint `no-restricted-imports`**, per-directory in the flat config:

```js
// eslint.config.mjs
{
  files: ["src/frontend/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [
    { group: ["@backend/*"], message:
      "frontend must not import backend — pass data as props from app/" },
    { group: ["@admin/*"],   message: "frontend must not import admin" },
  ]}]},
},
{
  files: ["src/shared/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [
    { group: ["@backend/*", "@frontend/*", "@admin/*", "payload*"],
      message: "shared must depend on nothing" },
  ]}]},
},
{
  files: ["src/backend/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [
    { group: ["@frontend/*", "@admin/*"],
      message: "backend must not import UI" },
  ]}]},
}
```

Layers 1 and 2 catch the dangerous mistakes at build time. Layer 3
catches the architectural ones in the editor, with a message that says
what to do instead.

---

## 10. Server-only vs client-safe

| Marker | Meaning |
| --- | --- |
| `import "server-only"` | Never reaches the browser. **Every file in `backend/`.** |
| `import "client-only"` | Browser only. `frontend/providers/`, `frontend/hooks/`. |
| `"use client"` | A React Client Component boundary |
| Neither | Must be safe in both — i.e. it belongs in `shared/` |

**A file with no marker that is not in `shared/` is a bug.** Either it
is safe both sides (move it) or it is not (mark it).

Secrets exist in exactly one folder: `src/backend/config/`. Everything
else reads them through the validated `env` object, never
`process.env` directly.

`NEXT_PUBLIC_*` values are public by definition. The only one today is
`NEXT_PUBLIC_SERVER_URL`; Stripe's publishable key joins it at B5.

---

## 11. Where database access is allowed

**`src/backend/data/**` — and nowhere else.**

Every Payload Local API call lives behind a named function in that
folder:

```ts
// src/backend/data/products.ts
import "server-only";
import { getPayload } from "payload";
import config from "@payload-config";

export async function getActiveProducts(): Promise<ProductSummary[]> { … }
export async function getProductBySlug(slug: string) { … }
```

Callers get `getActiveProducts()`, not a query builder. This is not
ceremony — it buys four things:

1. One place to add caching and `revalidateTag`.
2. One place where the shape returned to the frontend is decided, so
   `floristNotes` and internal ids are stripped **before** they reach a
   component.
3. Queries are testable without rendering.
4. `grep "getPayload"` returns one folder. That is how you audit data
   access.

**Never** in `src/frontend/`. **Never** inline in a page — pages call
these functions, they do not write queries.

---

## 12. Where integration code belongs

| Integration | Folder | Notes |
| --- | --- | --- |
| **Stripe** | `backend/integrations/stripe/` | `client.ts` (server SDK, secret key), `webhook.ts`, `reconcile.ts`. **The secret key is read only here.** The publishable key is `NEXT_PUBLIC_` and used by a frontend component — that is correct and safe. |
| **Resend** | `backend/integrations/email/` | `provider.ts` (interface), `resend.ts`, `console.ts`, `memory.ts`, `templates/`, `outbox.ts` |
| **Vercel Blob** | `backend/integrations/storage/` | Wired into Payload's upload adapter, not called directly |
| **Upstash Redis** | `backend/integrations/redis/` | Rate limits, OTP, webhook idempotency |
| **Sentry** | `instrumentation.ts` + config | Framework-mandated location |

Stripe's webhook route is `src/app/api/webhooks/stripe/route.ts` and is
**thin** — read raw body, verify signature, hand to
`backend/integrations/stripe/webhook.ts`. Route handlers are transport,
not logic.

---

## 13. Where business logic belongs

**`src/backend/domain/`.** Never in a React component, never in a route
handler, never in a Payload hook body.

| Rule | Home |
| --- | --- |
| How a total is computed | `domain/pricing/` — pure, tested |
| Which order status may follow which | `domain/orders/transitions.ts` |
| How an order number is minted | `domain/orders/numbering.ts` |
| Whether same-day delivery is still possible | `domain/orders/cutoff.ts` |
| How a guest cart merges | `domain/carts/merge.ts` |

Payload hooks stay one-liners that delegate:

```ts
// backend/payload/collections/Orders.ts
hooks: { beforeChange: [assertLegalTransition] }   // imported from domain/
```

**The cutoff rule is a live example of the problem.** It exists today in
`lib/delivery.ts` and `lib/useDeliverySchedule.ts` — client code only.
The server must enforce it at checkout ([ORDERS §3](./ORDERS.md)). After
the move, `domain/orders/cutoff.ts` is authoritative and the client
imports the same *constants* from `@shared/constants` to render the
picker — one rule, one source, two consumers.

---

## 14. Where UI components belong

| Kind | Folder |
| --- | --- |
| Design system (Button, Eyebrow, Logo) | `frontend/components/ui/` |
| Page sections (Hero, ShopByOccasion) | `frontend/components/blocks/` |
| Commerce UI (ProductCard, CheckoutForm) | `frontend/components/commerce/` |
| Motion primitives (Reveal, Parallax) | `frontend/components/motion/` |
| Admin views and fields | `src/admin/` |

A component is a Server Component unless it needs state, effects or
event handlers. `"use client"` is pushed **as deep as possible** — a
page stays a Server Component and only the interactive leaf opts in.

Components receive data as props and render it. A component that
imports from `@backend/*` is a lint error with a message telling the
author to lift the query into the page.

---

## 15. Where tests belong

Beside the code, not in a mirror tree — a test three folders away from
its subject is a test nobody updates.

```
backend/domain/pricing/pricing.ts
backend/domain/pricing/pricing.test.ts        ⭐ the money tests
backend/domain/orders/transitions.test.ts
backend/integrations/stripe/webhook.test.ts
backend/payload/access/access.test.ts         IDOR + permission matrix
shared/utils/money.test.ts                    ✅ exists, 5 tests
```

Exception: **end-to-end** tests are cross-cutting and live at the root
in `e2e/` (Playwright). Fixtures and factories in `test/factories/`.

Test names state a rule, not a function:
`"a coupon larger than the subtotal never produces a negative total"`.

---

## 16. Where documentation belongs

| Doc | Purpose |
| --- | --- |
| `README.md` | Front door: what it is, install, run |
| `PROJECT-BRAIN.md` | Single source of truth: how it all works, what is real vs pending |
| `CLAUDE.md` | Repo-specific agent instructions |
| `docs/ARCHITECTURE.md` | System design |
| `docs/PROJECT-STRUCTURE.md` | This file |
| `docs/DATABASE.md` · `ORDERS.md` · `PAYMENTS.md` · `EMAILS.md` · `SECURITY.md` · `ADMIN.md` · `DEPLOYMENT.md` | Per-domain specs |
| `docs/RUNBOOK.md` | How to operate it |
| `docs/PROGRESS/B*.md` | One per phase — the build diary |
| `brand/` | Client-facing briefs and specs (not engineering docs) |
| `CHANGELOG.md` | Per release |

A folder that needs explaining gets a short `README.md` inside it.
`src/backend/data/README.md` says "every database query lives here";
`src/shared/README.md` states the admission test.

---

## 17. Migration plan

Mechanical, reversible, and **verified after every step**. Nine commits,
no behaviour change, no logic rewritten.

### Ground rules

- Every step ends with `tsc --noEmit` + `eslint` + `vitest run` +
  `next build` green. A red step is reverted, not patched forward.
- **`git mv`**, never delete-and-recreate — history must survive.
- Windows + Git: `git config core.ignorecase false` first, or a
  case-only rename is silently lost.
- No logic changes. Renaming and moving only. Anything that *looks*
  like it needs a fix gets a TODO and its own commit later.

### The steps

| # | Step | Risk | Verify |
| --- | --- | --- | --- |
| **0** | Housekeeping: `.gitignore` `Calanthe_Final Files/`, delete `_m.mjs`/`_m2.mjs`/`_qa.mjs`, install `server-only` + `client-only` | none | build |
| **1** | Create empty folders + `README.md` in each; add the four aliases **alongside** `@/*` | none | build |
| **2** | `shared/` first — `money.ts` (+test), `cn.ts`, pure date helpers. Update imports. | low | tests |
| **3** | `frontend/` — `git mv` `components/**`, providers, hooks, `styles/`. Bulk import rewrite. | **highest churn** — ~90 files | build + visual QA |
| **4** | `backend/config/env.ts`, `backend/integrations/redis/`. Update the 3 importers. | low | boot |
| **5** | `backend/payload/` — config, `Users.ts`; repoint `@payload-config`, `migrationDir`, `typescript.outputFile` | **highest risk** — Payload resolution | `/admin` loads, `generate:types` |
| **6** | Split `lib/data.ts` (§17.3) | medium | build |
| **7** | Add `src/admin/` (empty, with README) — populated at B1.5 | none | — |
| **8** | **Remove `@/*`.** Any surviving `@/` import fails the build — that is the point. | low | build |
| **9** | Add the three ESLint boundary rules; fix what they catch | low | lint |

Steps 3 and 5 are the two that can go wrong, and they are deliberately
separated by step 4 so a failure is unambiguous.

### 17.1 Import rewriting

```bash
# one pattern at a time, build between each — never all at once
grep -rl '@/components/' src/ | xargs sed -i 's|@/components/|@frontend/components/|g'
```

`tsc --noEmit` is the safety net: a missed or wrong path cannot compile.

### 17.2 The Payload move (step 5)

Highest risk because Payload resolves its config through a build-time
alias. Order matters:

1. `git mv src/payload.config.ts src/backend/payload/payload.config.ts`
2. `git mv src/collections src/backend/payload/collections`
3. `tsconfig.json` → `"@payload-config": ["./src/backend/payload/payload.config.ts"]`
4. In the config: `migrationDir` → `src/backend/payload/migrations`,
   `typescript.outputFile` → `src/shared/types/payload-generated.ts`
5. `pnpm generate:types && pnpm generate:importmap`
6. Verify `/admin` loads and `pnpm build` is green

`src/app/(payload)/**` is **not touched** — those files import
`@payload-config`, which now points somewhere else. That is the entire
change from their perspective.

### 17.3 Splitting `lib/data.ts`

700 lines, imported by 36 files. It is three things:

| Part | Destination |
| --- | --- |
| Types (`Product`, `Occasion`, `Addon`…) | `shared/types/catalogue.ts` — **temporary**, replaced by generated Payload types at B2 |
| Constants (`BYO_MIN_BUDGET_AED`, `FREE_DELIVERY_THRESHOLD_AED`, `SAME_DAY_CUTOFF_HOUR`) | `shared/constants/` — these survive |
| Mock arrays (`products`, `occasions`, `addons`, `deliveryZones`) | `shared/mock-catalogue.ts` — **named "mock" on purpose**, deleted in one commit at B2 |

Naming the mock file `mock-catalogue.ts` rather than hiding it in a
neutral folder is deliberate: it should look temporary in every import
statement, and its deletion should be a single obvious diff.

### 17.4 Rollback

Each step is one commit. `git revert` restores the previous state, and
because nothing but paths and imports changed, a revert cannot lose
work. Do the whole migration on `refactor/project-structure` and merge
only when the full test suite and a manual pass over the storefront and
`/admin` are green.

### 17.5 Timing

**Before B1.** Moving 110 files is a day's careful work now; moving 250
after collections, pricing, orders and payments exist is a week and a
merge conflict with every branch open at the time.
