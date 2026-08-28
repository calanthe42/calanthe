# Changelog

## Unreleased — Backend

### B0 — Foundation (2026-08-28)
- feat(backend): Payload CMS 3 installed into the Next.js app (admin at
  /admin, REST + GraphQL under /api), Users collection with
  deny-by-default access and role guard
- feat(backend): Neon Postgres adapter (Drizzle) with migrations-only
  workflow (push disabled)
- feat(backend): Zod env schema validated at boot; production runtime
  fails closed without Sentry/Upstash
- feat(backend): Sentry (env-gated) + Upstash Redis rate-limit factory
- feat(backend): integer-fils money helpers with unit tests
- chore: project relocated to C:\dev\calanthe (OneDrive corruption),
  production builds switched to webpack (Payload requirement on Next 15)
- docs: README, RUNBOOK, SECURITY checklist, PROGRESS/B0

## Frontend (pre-backend, 2026-08-27 → 28)
- Complete storefront UI: homepage (client-locked sections + approved
  trust/video-approval inserts), shop with URL filters, product
  configuration flow, build-your-own, membership, cart drawer, checkout
  (UI), OTP login (mock), account, wishlist, system screens
- flowers.ae-informed structure: 3-row header with mega-menus + search,
  quick-nav band, cart upsell, delivery/FAQ/legal pages
- Cohesive 3D floral placeholder imagery with unifying warm grade
- Server-rendered CSS reveal engine; Lenis idle-mounted; brand-locked
  Tailwind tokens; monogram extracted from the client's vector files
