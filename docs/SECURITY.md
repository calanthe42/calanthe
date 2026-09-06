# Calanthe — Security

Roles, access control, per-collection risk review, customer data
handling, and the running checklist.

Related: [DATABASE](./DATABASE.md) · [ORDERS](./ORDERS.md) ·
[PAYMENTS](./PAYMENTS.md) · [ADMIN](./ADMIN.md)

---

## 1. Roles

Three roles on one `users` collection, discriminated by `role`
([DATABASE §1](./DATABASE.md) explains why not two tables).

| Role | Who | Auth |
| --- | --- | --- |
| `admin` | The owner | email + password, 2FA recommended |
| `staff` | Florists, drivers | email + password |
| `customer` | Buyers | passwordless WhatsApp OTP (B6) |

"Owner" in the brief maps to `admin`. A fourth role is not introduced:
one owner account with `admin`, everyone else `staff`.

---

## 2. Deny by default

Every collection declares all four operations explicitly. There is no
"unset means allowed" anywhere.

```ts
// lib/access/index.ts — defined once, imported everywhere
export const nobody: Access = () => false;
export const isAdmin: Access = ({ req }) => req.user?.role === "admin";
export const isStaff: Access = ({ req }) =>
  req.user?.role === "admin" || req.user?.role === "staff";
export const isSelf: Access = ({ req }) =>
  req.user ? { id: { equals: req.user.id } } : false;
export const isOwnerOfDoc = (field: string): Access => ({ req }) =>
  req.user ? { [field]: { equals: req.user.id } } : false;
export const publicRead: Access = () => true;  // ONLY for catalogue
```

Rules that hold the line:

1. **A new collection with no `access` block fails code review.**
2. `publicRead` appears only on catalogue collections and is spelled
   out at each use, never inherited.
3. Access functions return **query constraints**, not booleans, wherever
   ownership matters — Payload then filters at the database level, so a
   customer listing orders cannot page into someone else's.
4. Field-level access for anything sensitive inside an otherwise
   readable document (`users.notes`, `orders.amounts`,
   `payments.rawLastEvent`).

---

## 3. Permission matrix

`C` create · `R` read · `U` update · `D` delete · `—` none
`own` = only rows the user owns, enforced as a query constraint

| Collection | admin | staff | customer | public |
| --- | --- | --- | --- | --- |
| `users` | CRUD | **—** | RU own | — |
| `media` | CRUD | CRU | — | R |
| `products` | CRUD | R, U (gallery + description only) | — | R (`status=active`) |
| `occasions` | CRUD | R | — | R (`active`) |
| `add_ons` | CRUD | R | — | R (`active`) |
| `delivery_zones` | CRUD | R | — | R (`active`) |
| `coupons` | CRUD | — | — | — |
| `carts` | R | — | CRUD own | C + RUD own via token |
| `orders` | R, U (status/notes only) | R, U (status only) | R own | — |
| `payments` | R | — | — | — |
| `webhook_events` | R | — | — | — |
| `custom_arrangements` | CRUD | RU | R own | C (rate-limited) |
| `enquiries` | CRUD | RU | R own | C (rate-limited) |
| `membership_plans` | CRUD | R | — | R (`active`) |
| `membership_subscriptions` | CRUD | R | RU own | — |
| `email_events` | R | — | — | — |
| `audit_log` | R | — | — | — |
| `site_settings` | RU | R | — | R |
| `counters` | — | — | — | — |

Deliberate points:

- **Nobody can delete an order or a payment.** Not even admin.
  Cancellation is a status.
- **`audit_log` is create-server-only, `update`/`delete` = `nobody`.**
  An audit log an admin can edit is not an audit log.
- **`counters` is invisible to every role** including admin. It is
  infrastructure, mutated only by server code inside a transaction.
- **Staff have no access to `users` at all** (revised during design
  review). They never need it: every name, phone and email required to
  fulfil an order is already in that order's `contact` and `recipient`
  snapshot. Granting "read only the contact fields of customers who
  ordered" is not expressible as a clean Payload constraint, and an
  unclean access rule is worse than none. This also means the customer
  list — the business's most valuable asset — is reachable by exactly
  one account.
- **Staff cannot read `coupons`, `payments`, `email_events` or
  `audit_log`.** Discount codes are leakable value; payment and email
  records are customer PII with no fulfilment purpose.
- **The last `admin` cannot be demoted or deleted.** A `beforeChange`
  hook counts remaining admins and throws. Without it, one mis-click
  locks the client out of her own shop permanently.
- **`users.stripeCustomerId` is server-write-only.** A customer may
  update their own record, so without a field-level rule they could
  write someone else's Stripe customer id onto their account and
  inherit that person's saved payment methods. Real escalation vector,
  caught in review.
- **`orders.amounts` is `update: () => false` for every role.** Money is
  written once, by the webhook. No human edits a total.
- **`orders.floristNotes` is invisible to customers** at field level,
  even though they may read their own order.

---

## 4. Per-collection risk review

Each collection interrogated for unauthorised read and write.

| Collection | Read risk | Write risk | Mitigation |
| --- | --- | --- | --- |
| `users` | Customer list is the business's most valuable asset; phone + address are PII | Role escalation | `read: isAdminOrSelf` as a **query constraint**; `role` write is admin-only ✅ already implemented. Staff see contact details via the order snapshot, never by listing users. |
| `carts` | Reading another cart reveals purchase intent | Editing another cart | Guest token is 32 random bytes in an httpOnly cookie, **unique** in the DB. Access scopes by `customer` **or** `guestToken` — never by a URL id alone. |
| `orders` | **Worst case: enumerate `/orders/1,2,3`** and read strangers' addresses | Marking unpaid orders paid | `read` returns `{ customer: { equals: user.id } }`; Payload filters in SQL, so an unknown id is *not found* rather than *forbidden*. `paymentStatus` is writable by **no role** — only the webhook, server-side. |
| `payments` | Card metadata, amounts | Fabricating a payment | Admin read only; create/update server-only; `rawLastEvent` admin-only at field level. |
| `coupons` | Leaked codes are direct revenue loss | Self-issuing a 100% coupon | Admin only, all four operations. Creation writes `audit_log`. |
| `enquiries` / `custom_arrangements` | Other people's enquiries | **Public create is the main abuse surface** | Only `create` is public. Zod-validated, rate-limited per IP and per email, honeypot field, hard max lengths. `internalNotes` hidden from the submitter. |
| `media` | — | Malicious upload | MIME allow-list (`jpeg`, `png`, `webp`, `avif`), 10 MB cap, `sharp` re-encodes every upload — strips EXIF (including GPS) and any embedded payload. Original bytes are never served. |
| `site_settings` | — | Flipping `vatEnabled` or the free-delivery threshold | Admin write only; every change audited. |
| `audit_log` | — | Erasing evidence | `update`/`delete` = `nobody`, structurally. |
| `email_events` | Every customer's email address | — | Admin read only. |
| `products` | — | Staff changing prices | Field-level: staff may write `gallery` and `description`; `basePriceFils`, `variants` and `status` are admin-only. Price changes audited. |

### The IDOR test that must exist

For `orders`, `carts`, `enquiries`, `custom_arrangements` and
`membership_subscriptions`: create two customers, have A create a row,
then attempt read and update as B by id — **expect 404, not 403.**
A 403 confirms the row exists, which is itself a leak.

---

## 5. Customer data

**Collected, and why:** name, email, phone (delivery coordination and
OTP login), delivery addresses, order history, marketing consent state.

**Never collected:** card numbers (Stripe holds them; PANs never reach
our server or logs), date of birth, government ID.

**Recipient data is PII too.** A gift recipient never consented to
anything, so their name, phone and address are stored on the order,
used for delivery, and never used for marketing.

**Retention**

| Data | Kept | Then |
| --- | --- | --- |
| Orders, payments | Indefinitely | Accounting record; never deleted |
| Carts | 30 days after last touch | Purged by job |
| OTP codes | 5 minutes | Redis TTL expiry |
| `email_events` | 2 years | Admin purge |
| `audit_log` | Indefinitely | — |
| Anonymised users | Row retained, PII cleared | — |

**"Delete my data"** anonymises rather than deletes: `email` becomes
`deleted-<uuid>@calanthe.invalid`, `name`/`phone`/`addresses` are
cleared, `anonymisedAt` is set, marketing consent revoked. Orders
survive with their `contact` snapshot intact, because a business must
keep sales records. This is written down so the promise on the privacy
page matches what the code actually does.

**Exports** (customer list, order CSV) are admin-only and write an
`audit_log` entry naming the actor — a bulk export is the
highest-impact action available in the admin.

---

## 6. Application security

| Area | Approach |
| --- | --- |
| Input validation | Zod at **every** boundary: route handlers, server actions, webhooks. Checkout **rejects** unexpected price fields rather than ignoring them ([ORDERS §3](./ORDERS.md)). |
| Rate limiting | `lib/redis.ts` sliding window ✅. Enquiry 5/h/IP · checkout 10/h/IP · coupon 20/h/IP · OTP send 3/h/phone + 10/h/IP · OTP verify 5/code. **Fails closed** — no Redis in production means the endpoint refuses, not allows. |
| CSRF | Payload sessions are httpOnly + SameSite, plus an `Origin` check on every mutating route handler. |
| Security headers | **Not present in `next.config.ts` today.** To add: CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. CSP must allow Stripe (`js.stripe.com` + frames) — the tightest workable policy, not blanket `unsafe-inline`. |
| XSS | React escapes by default; rich text sanitised on render; `dangerouslySetInnerHTML` never used on user input. Gift messages and florist notes **are** user input. |
| SQL injection | Payload/Drizzle parameterise. No raw SQL in the repository. `FOR UPDATE` and advisory-lock statements must use parameterised bindings. |
| Secrets | Env only, Zod-validated at boot, fail-closed in production ✅. `NEXT_PUBLIC_` reserved for genuinely public values. No secret is ever printed to a log or a response. |
| Errors | Sentry gets the stack; the client gets a clean message and a reference id. No internals in any response body. |
| Dependencies | `pnpm audit` in CI. `playwright` currently sits in devDependencies and installs on every Vercel build — to be reviewed. |
| Admin surface | `/admin` and `/api/graphql` stay authenticated. GraphQL is never exposed to the storefront. |

---

## 7. Checklist status

From `brand/backend-architecture.md` §4, updated at the end of every
phase. ✅ done · 🔶 partial · ⏳ pending

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | All inputs Zod-validated at the boundary | 🔶 | Env boundary done (B0); API boundaries B3–B5 |
| 2 | Security headers | ⏳ | B8 — **absent from `next.config.ts` today** |
| 3 | CSRF: SameSite cookies + origin check | 🔶 | Payload cookies default-safe; origin checks B8 |
| 4 | No secrets client-side | ✅ | Enforced by env schema shape (B0) |
| 5 | Rate-limit all public endpoints | 🔶 | Limiter factory ready (B0); wired B3–B5 |
| 6 | Parameterised SQL only | ✅ | Payload/Drizzle; no raw SQL in repo |
| 7 | XSS: escape, sanitise rich text | 🔶 | React defaults hold; sanitisation when user text renders |
| 8 | PII minimum; card data never on our server | ⏳ | B5 — design fixed in §5 above |
| 9 | Webhooks signature-verified, idempotent, raw body | ⏳ | B5 — design in [PAYMENTS §4](./PAYMENTS.md) |
| 10 | Audit log on sensitive admin actions | ⏳ | B1 collection + B8 wiring |
| 11 | Dependency hygiene | 🔶 | CI audit pending; `playwright` placement to review |
| 12 | No stack traces to clients | 🔶 | Sentry wired (B0); response shapes B8 |
| 13 | Deny-by-default on every collection | 🔶 | `users` done (B0); all others B1 |
| 14 | OTP: hash-only, expiry, attempt caps | ⏳ | B6 — **moved to Redis**, see [DATABASE §1](./DATABASE.md) |
| 15 | Gifting rule enforced structurally + test | ⏳ | B5 — three-layer design in [EMAILS §3](./EMAILS.md) |
| 16 | Secrets in env, validated at boot, fail closed | ✅ | `src/lib/env.ts` (B0) |
| 17 | Money integer fils, server-computed only | 🔶 | `lib/money.ts` + tests ✅; `pricing.ts` B4 |
| 18 | Orders immutable; paid only via verified webhook | ⏳ | B5 |
| 19 | IDOR tests on every owned collection | ⏳ | B1 onward, per §4 |
| 20 | Uploads re-encoded, EXIF stripped, MIME allow-listed | ⏳ | B1 |
| 21 | Rate limiters fail **closed** when Redis is absent | ⏳ | B8 |

Item 21 is a real gap in the code as it stands: `rateLimit()` returns
`null` when Redis is unconfigured and leaves the decision to the caller.
Every production caller must treat `null` as deny.
