# `src/backend/` — server-side business logic

Business logic, database access, auth, pricing, orders, payments,
email, integrations, and the Payload definition.

Import with `@backend/*`.

## Every entry point starts with

```ts
import "server-only";
```

That package has no runtime — it declares a `react-server` export
condition, so importing it from a Client Component is a **build
failure**, not a runtime surprise. It is what turns the boundary from a
convention into a rule.

## May import

- `@shared/*`
- other `@backend/*`
- `payload`, provider SDKs (Stripe, Resend, Upstash)
- `process.env` — **only inside `config/`**

## May NOT import

- `@frontend/*`
- `@admin/*`
- any React component

## Planned layout

```
payload/
  payload.config.ts
  collections/    schema + access rules
  globals/        site_settings
  access/         ONE definition of each access function
  hooks/          revalidate, audit, guards
  migrations/
domain/           business logic
  pricing/        pure. no DB, no network, no Date.now()
  orders/         creation, numbering, status transitions
  carts/          merge, expiry
  memberships/
data/             ⭐ the ONLY place the Payload Local API is called
integrations/
  stripe/  email/  storage/  redis/
auth/             sessions, OTP
config/
  env.ts          🔒 the only folder that reads secrets
```

## Two rules worth repeating

**`domain/pricing/` is pure.** Fils in, fils out. Time and loaded
records are passed in, never fetched. That is what makes money testable,
and money is the thing that must never be wrong.

**`data/` is the only place `getPayload()` is called.** Callers get
`getActiveProducts()`, not a query builder. One place to add caching,
one place where the shape sent to the frontend is decided — so
`floristNotes` and internal ids are stripped before a component ever
sees them. `grep "getPayload"` returning one folder is how data access
stays auditable.

See [docs/PROJECT-STRUCTURE.md §5, §11–13](../../docs/PROJECT-STRUCTURE.md).
