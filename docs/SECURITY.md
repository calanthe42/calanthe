# SECURITY — checklist & status

From `brand/backend-architecture.md` §4. Updated at the end of every
phase. Status: ✅ done · 🔶 partial · ⏳ pending.

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | All inputs Zod-validated at the boundary (API, actions, webhooks) | 🔶 | Env boundary done (B0); API boundaries land with B3–B5 |
| 2 | Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type, Referrer-Policy, Permissions-Policy) | ⏳ | B8 |
| 3 | CSRF: SameSite cookies + origin check on mutations | 🔶 | Payload session cookies are httpOnly/SameSite by default; origin checks B8 |
| 4 | No secrets client-side; NEXT_PUBLIC_ only for public values | ✅ | Enforced by env schema shape (B0) |
| 5 | Rate-limit all public endpoints (OTP, checkout, coupon, search) | 🔶 | Upstash limiter factory ready (B0); wired per-endpoint B3–B5 |
| 6 | SQL injection: parameterized only, never raw string SQL | ✅ | Payload/Drizzle adapters; no raw SQL in repo |
| 7 | XSS: escape by default, sanitize rich text, no dangerouslySetInnerHTML on user input | 🔶 | React defaults hold; rich-text sanitization when user text renders (B4+) |
| 8 | PII minimum; card data never touches our server; recipient data is PII | ⏳ | B4/B5 |
| 9 | Webhooks signature-verified, idempotent, raw-body parsed | ⏳ | B4 |
| 10 | Audit log on sensitive admin actions | ⏳ | B1 (collection) + B7 (wiring) |
| 11 | Dependency hygiene: pnpm audit in CI, pinned critical deps | 🔶 | pnpm supply-chain policy active locally; CI audit pending |
| 12 | Error handling: no stack traces to clients; Sentry gets detail | 🔶 | Sentry wired env-gated (B0); response-shape review B8 |
| 13 | Access control deny-by-default on every collection | 🔶 | Users collection done (B0); all collections B1 |
| 14 | OTP: hash-only storage, expiry, attempt caps, rate limits | ⏳ | B5 |
| 15 | Gifting rule: recipient never receives price (structural + test) | ⏳ | B4 (emails) |
| 16 | Secrets in env only; validated at boot; fail closed in prod | ✅ | src/lib/env.ts (B0) |
| 17 | Money integer fils, server-computed only | 🔶 | lib/money.ts + tests (B0); pricing.ts B3 |
| 18 | Orders immutable; paid only via verified webhook transaction | ⏳ | B4 |
