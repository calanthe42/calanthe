# Calanthe — Database Design

Specification for every collection, field, relationship, index and
constraint. Postgres via Payload's Drizzle adapter, `push: false`,
migrations only.

Conventions used throughout:

- **Money is always integer fils** (AED × 100), field names end `Fils`.
  No float, no decimal, ever. Enforced by `src/lib/money.ts`.
- **`R` = required · `N` = nullable · `L` = localized (EN/AR)**
- Every collection has Payload's `id`, `createdAt`, `updatedAt`.
- "Owner" means which role owns the row's lifecycle.

---

## 1. Rejected entities — and why

Answering the brief's question "which entities should NOT be separate
collections". Each of these was considered and deliberately refused.

| Proposed | Decision | Reasoning |
| --- | --- | --- |
| **`customers`** | ❌ → `users.role = "customer"` | Two identity tables means two auth paths, two access-control surfaces, and duplicated email/phone. A staff member who also buys flowers would exist twice. One table, one role field. |
| **`categories`** | ❌ → does not exist | The site has no generic category. It has *occasions* (a real taxonomy, its own collection), *flower type* (a select on the product), and *price bucket* (derived at query time). Inventing a `categories` table to look complete would give three overlapping ways to group a product. |
| **`order_items`** | ❌ → embedded array on `orders` | Items have no independent life: never queried alone, never shared, never edited after the order exists. Embedding guarantees the snapshot is written atomically with its order — a separate table can half-write. |
| **`gift_recipients`** | ❌ → embedded group on `orders` | A recipient is a *per-order fact*, not a person we track. The same aunt gets different addresses on different occasions. A separate table would be an unowned PII store with no clear access rule. |
| **`invoices` / `receipts`** | ❌ → derived from `orders` | A receipt is a *rendering* of a paid order, deterministically computed from an already-immutable snapshot. Storing it duplicates every amount and creates drift the day the two disagree. Only `receiptNumber` + `receiptIssuedAt` live on the order; the PDF is generated on demand. |
| **`marketing_consent`** | ❌ → group on `users` + `audit_log` | Current state is one field-set on the user. *History* (needed to prove consent) belongs in the append-only audit log, which already exists for exactly this purpose. A third place to look is a liability. |
| **`addresses`** | ❌ → embedded array on `users` | Owned by exactly one user, never shared, never queried independently. A join table buys nothing and adds an access rule to get wrong. |
| **`delivery_slots`** | ❌ → embedded array on `delivery_zones` | Three labels per zone. A collection plus a relationship, to avoid duplicating the string "13:00 – 17:00", is not worth a join on every checkout. |
| **`price_buckets`** | ❌ → computed | Storing a bucket duplicates the price and goes stale the moment the price changes. The storefront filter derives buckets from `priceFils` at query time. |
| **`coupon_redemptions`** | ❌ → atomic counter + order index | `maxRedemptions` is enforced by a conditional atomic `UPDATE ... WHERE redeemedCount < maxRedemptions` (see §6). "Once per customer" is answered by an index on `orders(couponCode, customer)`. A join table adds a row per order to answer a question the orders table already answers. |
| **`otp_codes`** | ❌ → **Redis** | *Departs from the original brief.* OTPs are ephemeral secrets with a 5-minute life. Redis gives natural TTL expiry, no cleanup job, no PII table to leak or back up, and atomic attempt counting. Postgres would need a scheduled purge and would retain hashed secrets in backups. Redis is already mandatory in production. |

---

## 2. `users` — people (staff and customers) ✅ exists, to be extended

**Owner:** admin. **Auth:** Payload auth. Staff use email+password;
customers become passwordless (WhatsApp OTP, B6).

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `email` | email | R | Payload auth field. **Unique** (Payload enforces). |
| `name` | text | N | max 120 |
| `role` | select | R | `admin` \| `staff` \| `customer`, default `customer`. `saveToJWT`. Admin-only write ✅ |
| `phone` | text | N | E.164, **unique where not null**. Required for `customer` from B6. |
| `addresses` | array | N | embedded, see below |
| `marketing` | group | N | `subscribed` bool · `consentAt` date · `source` select · `unsubscribedAt` date |
| `stripeCustomerId` | text | N | **unique where not null**. Set on first payment. **Field-level `update: () => false`** — server-only. A customer may edit their own record; without this they could paste another person's Stripe id and inherit their saved cards. |
| `notes` | textarea | N | **admin-only read/write.** Staff must not see florist notes about a customer. |
| `anonymisedAt` | date | N | Set by "delete my data". See §13. |

`addresses[]` — `label` · `line1` R · `line2` · `area` · `city` R ·
`emirate` select R · `zone` relationship→`delivery_zones` ·
`isDefault` bool

**Indexes:** `role`, `phone` (unique partial), `stripeCustomerId`
(unique partial), `email` (unique, Payload).

**Deletion:** `delete` is admin-only, and blocked by a `beforeDelete`
hook if the user has any order. Customers with history are *anonymised*,
never deleted — orders must survive for accounting.

**Last-admin guard:** a `beforeChange` hook refuses any update that
would leave zero users with `role: "admin"`, and `beforeDelete` refuses
to remove the final admin. Without it, one mis-click locks the client
out of her own shop with no recovery path short of a database edit.

---

## 3. `media` — uploads (NEW, required)

**Owner:** admin + staff. Payload upload collection.

Today every image is an external Unsplash/Pexels URL in `lib/data.ts`.
The client cannot upload a photograph. This collection is what makes
the admin real.

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `alt` | text | R **L** | Accessibility and SEO. Required — enforced, not suggested. |
| `credit` | text | N | Photographer attribution |

**Sizes:** `thumbnail` 400w · `card` 800w · `hero` 1600w · `og` 1200×630.
Generated by `sharp` (already a dependency).

**Storage:** local disk is **not viable on Vercel** (ephemeral
filesystem). Must be Vercel Blob or S3/R2 before B1 ships. See
[DEPLOYMENT §4](./DEPLOYMENT.md).

**Access:** public read (images are public), staff create/update,
admin delete. `beforeDelete` blocks deletion if referenced by any
product, occasion, or add-on.

> **`media` is a public bucket. Nothing private may ever be stored in
> it.** Receipt PDFs in particular are generated on demand and streamed
> through an authenticated route — if a future change caches them, they
> go to a separate private store, never here. Flagged in design review
> because "just put the PDF in media" is the obvious wrong shortcut.

---

## 4. `products`

**Owner:** admin (price/status), staff (photos, copy — see [ADMIN](./ADMIN.md)).

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `name` | text | R **L** | |
| `slug` | text | R | **unique**, immutable after first publish (a changed slug breaks live links and past emails) |
| `description` | richText | N **L** | Sanitised on render |
| `gallery` | array→`media` | R | min 1, max 8 |
| `basePriceFils` | number | R | > 0, integer |
| `variants` | array | N | embedded, see below |
| `occasions` | relationship[] | N | → `occasions` |
| `flowers` | select[] | N | roses/tulips/peonies/orchids/lilies/seasonal |
| `addOnsAllowed` | relationship[] | N | → `add_ons`. Empty = all allowed. |
| `status` | select | R | `draft` \| `active` \| `archived`, default `draft` |
| `featured` | checkbox | N | |
| `newArrival` | checkbox | N | |
| `readyToday` | checkbox | N | Powers "Ready Made for Today" |
| `seo` | group | N **L** | `title` · `description` · `image`→`media` |

`variants[]` — `label` R **L** (Standard/Deluxe/Premium) ·
`priceDeltaFils` R (**may be negative**; total must stay > 0) ·
`sku` text **unique where not null** · `stock` number R default 0 ·
`trackStock` bool default true

**Indexes:** `slug` (unique), `status`, `featured`, `readyToday`,
composite `(status, featured)` for the homepage query.

**Constraints:** `basePriceFils + min(variant delta) > 0` enforced in a
`beforeValidate` hook. Deleting a product is **blocked** if it appears
in any order — archive instead. `status` change to `archived`
cascades: removed from storefront queries, kept in every past order.

**Hooks:** `afterChange` → `revalidateTag("products")` and the product's
own path. `afterChange` → `audit_log` when `basePriceFils` or `status`
changes.

---

## 5. `occasions` · `add_ons` · `delivery_zones`

**`occasions`** — `name` R **L** · `slug` R unique · `image`→`media` R ·
`order` number (manual sort) · `active` bool · `seo` group **L**.
Current live set: `birthday`, `graduation`, `new-born`, `love`,
`just-because`. Delete blocked if referenced by a product.

**`add_ons`** — `name` R **L** · `image`→`media` R · `priceFils` R ·
`maxQty` number default 1 · `active` bool. Never deleted once ordered;
`active: false` hides it.

**`delivery_zones`** — `name` R **L** · `slug` R unique ·
`feeFils` R · `sameDayCutoff` text R (`"HH:mm"`, Asia/Dubai) ·
`active` bool · `slots[]` embedded.

`slots[]` — `label` R **L** ("13:00 – 17:00") · `capacityPerDay` number R
· `active` bool

> **Capacity is never stored as a counter.** Remaining capacity is
> `capacityPerDay − COUNT(orders WHERE zone,date,slot AND paid)`,
> computed inside the paid transaction under lock. A stored counter
> would drift on every cancellation and refund. See [ORDERS §8](./ORDERS.md).

Current live zones (from `lib/data.ts`, to be seeded): Dubai 25 ·
Abu Dhabi 35 · Sharjah 30 · Ajman 35 · Umm Al Quwain 45 ·
Ras Al Khaimah 45 · Fujairah 45 (AED).

---

## 6. `coupons`

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `code` | text | R | **unique, uppercase-normalised** on save |
| `type` | select | R | `percent` \| `fixed` |
| `percent` | number | N | 1–100, required when `type=percent` |
| `valueFils` | number | N | required when `type=fixed` |
| `minOrderFils` | number | N | default 0 |
| `maxRedemptions` | number | N | null = unlimited |
| `redeemedCount` | number | R | default 0, **never hand-edited** |
| `oncePerCustomer` | checkbox | N | |
| `startsAt` / `expiresAt` | date | N | |
| `active` | checkbox | R | default true |
| `appliesTo` | relationship[] | N | → `products`. Empty = whole catalogue. |

**Redemption is atomic.** Inside the paid transaction:

```sql
UPDATE coupons SET redeemed_count = redeemed_count + 1
WHERE id = $1
  AND active = true
  AND (max_redemptions IS NULL OR redeemed_count < max_redemptions);
-- 0 rows affected → coupon exhausted → discount dropped, order still
-- completes at full price, customer is told on the receipt.
```

This is why no `coupon_redemptions` table is needed: the guard and the
increment are one statement, so two simultaneous checkouts cannot both
claim the last redemption. `oncePerCustomer` is answered by an index on
`orders(couponCode, customer)`.

**Indexes:** `code` (unique), `active`, `expiresAt`.

---

## 7. `carts`

**Owner:** the customer or an anonymous token. Server-owned;
`localStorage` may only mirror, never define.

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `customer` | relationship | N | → `users`. Null for guests. |
| `guestToken` | text | N | **unique where not null**. httpOnly cookie, 32 random bytes. |
| `items` | array | N | embedded |
| `couponCode` | text | N | validated at checkout, never trusted for price |
| `expiresAt` | date | R | now + 30 days, refreshed on touch |

`items[]` — `product` rel R · `variantSku` text N · `qty` number R
(1–20) · `addOns[]` (`addOn` rel · `qty`) · `giftMessage` textarea
(max 300) · `addedAt` date

**Cart items store no prices.** Every total is recomputed from live
product data by `lib/pricing.ts` on every read and again at checkout.
A cart that stored prices would let a customer sit on a stale discount
for 30 days.

**Constraint:** exactly one of `customer` / `guestToken` is set
(`CHECK (num_nonnulls(customer_id, guest_token) = 1)`).

**Indexes:** `customer`, `guestToken` (unique partial), `expiresAt`
(for the purge job).

**Guest → customer merge** on login: items appended, quantities summed
and clamped to 20, guest cart deleted, in one transaction.

---

## 8. `orders` — the immutable record

**Owner:** system. **Nobody, including the owner, may edit amounts.**
See [ORDERS](./ORDERS.md) for the full lifecycle; fields only here.

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `orderNumber` | text | N | `CAL-2026-0184`. **unique where not null.** Assigned only at payment. Null while pending. |
| `customer` | relationship | N | → `users`. Null for guest checkout. |
| `contact` | group | R | `name` · `email` · `phone` — **snapshot**, not read through `customer` |
| `items` | array | R | full snapshot, see §9 |
| `recipient` | group | R | `name` · `phone` · `line1` · `line2` · `area` · `city` · `emirate` · `instructions` |
| `isGift` | checkbox | R | drives the price-free recipient template |
| `giftMessage` | textarea | N | max 300, sanitised |
| `delivery` | group | R | `zoneName` · `zoneSlug` · `feeFils` · `date` · `slotLabel` — all snapshot |
| `amounts` | group | R | `subtotalFils` · `deliveryFeeFils` · `discountFils` · `vatFils` · `totalFils` |
| `couponCode` | text | N | snapshot of the code used |
| `couponSnapshot` | group | N | `type` · `percent` · `valueFils` — why the discount was what it was |
| `vat` | group | R | `enabled` bool · `ratePercent` · `trn` text — snapshot of settings at purchase |
| `fulfilmentStatus` | select | R | see [ORDERS §2](./ORDERS.md) |
| `paymentStatus` | select | R | see [ORDERS §2](./ORDERS.md) |
| `timeline` | array | R | append-only: `status` · `at` · `by` rel · `note` |
| `floristNotes` | textarea | N | internal, **never in any customer email** |
| `receiptNumber` | text | N | **unique where not null** |
| `receiptIssuedAt` | date | N | |
| `idempotencyKey` | text | R | **unique.** Client-supplied per checkout attempt; prevents double order creation. |

**Indexes:** `orderNumber` (unique partial), `customer`,
`fulfilmentStatus`, `paymentStatus`, `idempotencyKey` (unique),
`(couponCode, customer)`, `(delivery.date, delivery.zoneSlug,
delivery.slotLabel)` for capacity, `createdAt DESC` for the dashboard.

**Access:** create — server only (no public create). update — amounts
are `update: () => false` at field level for *every* role, including
admin; only `fulfilmentStatus`, `timeline`, `floristNotes` are
writable, and only through validated transitions. delete — **nobody**.
Cancellation is a status, not a deletion.

---

## 9. `orders.items[]` — the snapshot

Embedded, not a collection (§1). Every field here is a **copy taken at
order creation**, never a live read.

| Field | Why it is copied |
| --- | --- |
| `product` (rel) | Reporting only. **No display path may read through it.** |
| `productName` | The product may be renamed or archived tomorrow |
| `productSlug` | Receipt links must keep working after a slug change |
| `imageUrl` | The gallery may be re-ordered or the photo deleted |
| `variantLabel`, `variantSku` | Variants get renamed and removed |
| `unitPriceFils` | **The reason this whole design exists** |
| `qty` | |
| `addOns[]` — `name`, `priceFils`, `qty` | Add-on prices change |
| `lineTotalFils` | Recomputed and asserted equal at write time; stored so the receipt never re-derives |

Test that must exist: create order → change product price, name, image
and archive it → re-render receipt → **every value identical**.
(See [DEPLOYMENT §8](./DEPLOYMENT.md) and [ORDERS §4](./ORDERS.md).)

---

## 10. `payments` — money attempts

A separate collection, not embedded, because one order can have many
attempts (declined card → retry → success → partial refund) and because
**reconciliation must query payments without an order** ("find every
Stripe charge with no matching order").

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `order` | relationship | N | → `orders`. **Nullable on purpose** — an orphan payment is a real, reportable state. |
| `provider` | select | R | `stripe` (only value today) |
| `stripePaymentIntentId` | text | R | **unique** |
| `stripeChargeId` | text | N | |
| `amountFils` | number | R | as reported by Stripe, not by us |
| `currency` | text | R | `AED` |
| `status` | select | R | see [PAYMENTS §3](./PAYMENTS.md) |
| `refundedFils` | number | R | default 0 |
| `failureCode` / `failureMessage` | text | N | from Stripe |
| `rawLastEvent` | json | N | admin-only read; debugging |

**Indexes:** `stripePaymentIntentId` (unique), `order`, `status`,
`createdAt DESC`.

**Access:** read admin only (staff must not see payment internals),
create/update **server only**, delete nobody.

---

## 11. `webhook_events` — durable idempotency

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `source` | select | R | `stripe` \| `resend` |
| `eventId` | text | R | **unique together with `source`** |
| `type` | text | R | e.g. `payment_intent.succeeded` |
| `receivedAt` | date | R | |
| `processedAt` | date | N | null = received but not yet applied |
| `status` | select | R | `received` \| `processed` \| `failed` \| `ignored` |
| `attempts` | number | R | default 0 |
| `error` | textarea | N | |
| `payloadJson` | json | N | admin-only |

**Why Postgres and not only Redis:** Redis is a cache and can be
flushed or evicted. Stripe retries for up to three days. Charging a
customer twice because a cache was cleared is unacceptable. Redis is
the *fast path*; the unique constraint `(source, eventId)` is the
*guarantee*. See [PAYMENTS §4](./PAYMENTS.md).

---

## 12. `custom_arrangements` · `enquiries`

These are **two collections, not one**, because their lifecycles
differ: a custom arrangement becomes an order; an enquiry never does.

**`custom_arrangements`** (Build Your Own)

`customer` rel N · `contact` group R · `budgetFils` R (**min 15000 fils
= AED 150**, from `BYO_MIN_BUDGET_AED`) · `colours[]` select ·
`vase` bool · `occasion` rel · `cardMessage` textarea · `notes` ·
`preferredDate` date · `status` select
(`new` → `quoted` → `accepted` → `converted` → `declined`) ·
`quotedPriceFils` N · `order` rel N (set on conversion) ·
`assignedTo` rel→users

On conversion the arrangement becomes **one line inside a normal
order**, not an order of its own — the customer may add a vase and a
card to it. `custom_arrangements.order` therefore points at the parent
order, and the matching `orders.items[]` entry carries
`customArrangement` (rel) plus the same snapshot fields as any other
line: `productName` = "Build Your Own", `unitPriceFils` =
`quotedPriceFils` at acceptance. Clarified in design review — the
original wording ("becomes an order line") left the cardinality
ambiguous.

**`enquiries`** — one collection with a `type` discriminator, not four
tables. The shape is identical (who, what, when, status, assignee);
only `type` and an optional detail group differ.

`type` select R: `event` \| `guest_favors` \| `membership` \|
`contact` \| `corporate` · `contact` group R · `message` textarea R ·
`eventDetails` group N (`eventDate` · `guestCount` · `venue` ·
`budgetFils`) — shown only when `type` is event-ish ·
`status` select R (`new` → `in_progress` → `answered` → `closed` ·
`spam`) · `assignedTo` rel · `internalNotes` · `source` text (page URL)

**Indexes:** both — `status`, `createdAt DESC`, `assignedTo`.

**Access:** create is **public but rate-limited and validated** (this
is the only public write in the system besides checkout). Read/update
admin + staff. Delete admin only.

---

## 13. `membership_plans` · `membership_subscriptions`

**`membership_plans`** — `name` R **L** · `slug` R unique ·
`blurb` **L** · `pricePerDeliveryFils` R · `deliveriesPerMonth` R ·
`includes[]` **L** · `mostLoved` bool · `active` bool ·
`stripePriceId` text N (**unique where not null**)

Live tiers to seed: Essential (AED 260) · Signature (AED 420) · plus
whatever the client adds.

**`membership_subscriptions`** — `customer` rel R · `plan` rel R ·
`planSnapshot` group R (name + price at signup — same immutability rule
as orders) · `deliveryDay` select R (Sun–Sat) ·
`deliveryAddress` group R · `status` select R (`pending` \| `active` \|
`paused` \| `cancelled` \| `past_due`) · `stripeSubscriptionId` text N
**unique where not null** · `startedAt` · `pausedAt` · `cancelledAt` ·
`nextDeliveryDate` date

**Indexes:** `customer`, `status`, `nextDeliveryDate`,
`stripeSubscriptionId` (unique partial).

---

## 14. `email_events` — the outbox and the log

| Field | Type | | Notes |
| --- | --- | --- | --- |
| `template` | select | R | see [EMAILS §2](./EMAILS.md) |
| `category` | select | R | `transactional` \| `marketing` — **legally distinct** |
| `to` | email | R | |
| `subject` | text | R | |
| `relatedOrder` / `relatedEnquiry` | rel | N | |
| `status` | select | R | `queued` \| `sent` \| `delivered` \| `bounced` \| `complained` \| `failed` |
| `providerMessageId` | text | N | **unique where not null**, from Resend |
| `attempts` | number | R | default 0, max 3 |
| `lastError` | textarea | N | |
| `containsPrices` | checkbox | R | **set by the template, not the caller** — the gifting-rule assertion reads this |
| `sentAt` / `deliveredAt` | date | N | |

**Access:** admin read only. `to` addresses are PII; staff have no
business reading the mail log. Nobody creates or edits by hand.

**Indexes:** `status`, `providerMessageId` (unique partial),
`relatedOrder`, `createdAt DESC`.

---

## 15. `audit_log` — append-only

`actor` rel N (null = system) · `actorEmail` text (snapshot — the user
may later be deleted) · `action` text R (`product.price_changed`,
`order.status_changed`, `user.role_changed`, `consent.changed`,
`coupon.created`, `settings.changed`) · `targetCollection` text ·
`targetId` text · `before` json N · `after` json N · `ip` text N ·
`at` date R

**Access:** read admin only. **`create` server-only; `update` and
`delete` are `() => false` for every role including admin.** An audit
log an admin can edit is not an audit log.

**Indexes:** `at DESC`, `actor`, `action`, `(targetCollection, targetId)`.

---

## 16. `site_settings` — global

`vatEnabled` bool default **false** · `vatRatePercent` number default 5
· `vatTrn` text N · `freeDeliveryThresholdFils` default 35000
(AED 350) · `currency` text `AED` · `whatsappNumber` text ·
`instagramHandle` · `supportEmail` · `announcement` group **L**
(`text` · `active`) · `storeOpen` bool · `orderCutoffHour` number
default 14 · `minOrderFils`

**VAT is off and stays off** until the client registers. The fields
exist so switching on is a settings change, not a migration
([DEPLOYMENT §7](./DEPLOYMENT.md)). Every order snapshots the VAT state
at purchase time, so turning it on never rewrites history.

**Access:** write admin only. Read is **not** blanket-public: an
explicit allow-list of fields is exposed to the storefront
(`announcement`, `whatsappNumber`, `instagramHandle`, `supportEmail`,
`storeOpen`, `freeDeliveryThresholdFils`, `minOrderFils`,
`orderCutoffHour`, `vatEnabled`, `vatRatePercent`, `vatTrn`).
Anything added to this global in future is private until deliberately
added to that list — the opposite default to "public read", so a
future operational setting cannot leak by being forgotten.

---

## 17. `counters` — infrastructure, hidden

One row per year: `key` text unique (`order:2026`) · `value` number.

Used only for gap-free order numbering under `SELECT … FOR UPDATE`
inside the paid transaction. Hidden from the admin UI
(`admin.hidden: true`), no user-facing access at all.

Gap-free numbering serialises every paid order through one row lock.
At a flower atelier's volume this is free, and it is what an accountant
expects. A Postgres sequence would be faster and would leave gaps on
every rollback.

---

## 18. Deletion behaviour, summarised

| Collection | Delete allowed? | Instead |
| --- | --- | --- |
| `orders` | **Never** | `fulfilmentStatus: cancelled` |
| `payments` | **Never** | status change |
| `audit_log` | **Never** | — |
| `email_events` | Never (admin purge job only, > 2 years) | — |
| `users` | Only with zero orders | anonymise (§2) |
| `products` | Only if never ordered | `status: archived` |
| `media` | Only if unreferenced | — |
| `occasions`, `add_ons`, `plans` | Only if unreferenced | `active: false` |
| `delivery_zones` | Only if unreferenced by products, orders **and `users.addresses[].zone`** | `active: false` |
| `carts` | Yes, and purged after `expiresAt` | — |
| `enquiries`, `custom_arrangements` | Admin only | `status: closed` |

Enforced by `beforeDelete` hooks that query for references and throw a
readable error — not by hoping nobody clicks the button.

---

## 19. Migration policy

- `push: false` in every environment. Dev, staging and production run
  the identical reviewed migration files.
- One migration per phase, named for it: `pnpm migrate:create b1_collections`.
- **Migrations are reviewed like code.** A generated migration that
  drops a column is rejected until proven intentional.
- Never edit a migration that has run anywhere. Write a new one.
- `pnpm migrate` runs in Vercel's build command before the app starts —
  see [DEPLOYMENT §5](./DEPLOYMENT.md).
