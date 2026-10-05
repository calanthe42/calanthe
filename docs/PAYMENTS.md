# Calanthe — Payments (Stripe)

Related: [ORDERS](./ORDERS.md) · [SECURITY](./SECURITY.md) ·
[DEPLOYMENT](./DEPLOYMENT.md)

---

## 1. Decisions

| | |
| --- | --- |
| Provider | **Stripe** (chosen 2026-09-05) |
| Currency | **AED only** |
| Integration | **PaymentIntents + Stripe Elements**, hosted on our own checkout page |
| Card data | **Never touches our server.** Elements posts directly to Stripe; we hold only ids. |
| SCA / 3-D Secure | Handled by Stripe; `processing` is a real state we model |
| Subscriptions | Stripe Subscriptions for memberships (B7), separate from one-off orders |
| Apple Pay / Google Pay | Via the Payment Request Button, same PaymentIntent |
| Capture | **`capture_method: "automatic"`** — authorise and capture in one step. Manual capture would introduce a 7-day authorisation expiry and a whole second failure mode for no benefit to a florist who makes the bouquet the same day. |

**Not Stripe Checkout (hosted redirect)** — the redirect page cannot be
branded to Calanthe's standard, and the brief's priority is a luxury
experience. Elements keeps the customer on `calanthe.ae` with our type
and colours. The trade-off is that we own more of the PCI surface
(SAQ A-EP rather than SAQ A); acceptable because card fields remain
Stripe-hosted iframes we never read.

> **Known constraint, already learned on this project:** if the Express
> Checkout Element is used, its `onClick` must call `resolve()` within
> one second with no awaits before it. All server preparation belongs in
> `onConfirm`. Violating this silently breaks Apple Pay.

---

## 2. The rule

> **Only a signature-verified webhook may change payment state.**

Not the browser. Not the redirect. Not an admin button. Not a
`?success=true` query parameter.

Everything the customer's browser reports is a *hint* that makes the UI
feel responsive. The database changes when, and only when, Stripe tells
our server — signed — that it happened.

---

## 3. Payment states

Mapped from Stripe, stored on `payments` ([DATABASE §10](./DATABASE.md)):

| Ours | Stripe source |
| --- | --- |
| `requires_payment_method` | intent created, nothing attempted |
| `processing` | `processing`, or 3-D Secure in flight |
| `succeeded` | `payment_intent.succeeded` |
| `failed` | `payment_intent.payment_failed` |
| `partially_refunded` | `charge.refunded`, `amount_refunded < amount` |
| `refunded` | `charge.refunded`, fully |
| `disputed` | `charge.dispute.created` |

---

## 4. Webhook handling

Route: `src/app/api/webhooks/stripe/route.ts`

```ts
export const runtime = "nodejs";        // needs raw body + crypto
export const dynamic = "force-dynamic";
```

### Order of operations — every step is mandatory

1. **Read the raw body.** `await req.text()`, never `req.json()`.
   Parsing first destroys the signature.
2. **Verify the signature** with `stripe.webhooks.constructEvent(raw,
   sig, STRIPE_WEBHOOK_SECRET)`. Failure → **400**, log, stop. Never
   fall back to trusting an unverified body.
3. **Fast idempotency:** `SETNX stripe:evt:<event.id>` in Redis with a
   7-day TTL (longer than Stripe's 3-day retry window). Already set →
   **200**, stop.
4. **Durable idempotency:** insert `webhook_events (source='stripe',
   eventId)`. Unique violation → **200**, stop. This is the guarantee;
   step 3 is only the cheap path.
5. **Dispatch by type _and_ metadata.** Unknown types → record
   `status: ignored`, return **200**. Returning 4xx for events we simply
   do not handle trains Stripe to retry noise.

   Every PaymentIntent we create carries
   `metadata: { kind: "order" | "membership", orderId | subscriptionId }`.
   The handler routes on `kind`, never on event type alone — otherwise a
   membership invoice's `payment_intent.succeeded` would fall into the
   order handler and look like an orphan payment. **Caught in design
   review.**

   The handler also asserts `event.data.object.currency === "aed"`. A
   non-AED intent means something is badly wrong; it is flagged and not
   processed rather than silently compared against a fils total.
6. **Apply in a database transaction** (§5).
7. **Mark `webhook_events.processedAt`,** commit.
8. **Queue emails after commit,** never inside the transaction (§6).
9. Return **200**. Any thrown error → **500**, so Stripe retries.

### Why both idempotency layers

Redis alone is insufficient: it is a cache, it can be flushed, evicted,
or fail over, and Stripe retries for three days. A duplicate
`payment_intent.succeeded` after a Redis flush would double-decrement
stock and double-redeem a coupon. The unique constraint on
`(source, eventId)` cannot be flushed.

Postgres alone would be sufficient but costs a write on every duplicate
of a high-volume event. Redis absorbs those.

### Events handled

| Event | Effect |
| --- | --- |
| `payment_intent.succeeded` | The big one — §5 |
| `payment_intent.payment_failed` | `payments.status: failed`, record decline code, order stays `awaiting_payment`, customer may retry |
| `payment_intent.processing` | `payments.status: processing` |
| `charge.refunded` | Update `refundedFils`; recompute order `paymentStatus`; timeline entry; **no automatic stock return** |
| `charge.dispute.created` | `disputed`, alert admin immediately |
| `customer.subscription.*` | Membership status (B7) |
| `invoice.payment_failed` | Membership `past_due`, dunning email |

---

## 5. The paid transaction

Everything here succeeds together or nothing does.

```
BEGIN
  SELECT order FOR UPDATE
  ├─ already paid?  → COMMIT, return 200 (idempotent replay)
  ├─ amount received ≠ amounts.totalFils?
  │     → flag paymentMismatch, do NOT fulfil, alert, COMMIT
  │
  ├─ assign orderNumber       (counters row, FOR UPDATE, gap-free)
  ├─ decrement stock          (variant rows, FOR UPDATE)
  │     shortfall → still commit, flag stockShortfall, alert
  ├─ claim delivery slot      (advisory lock on date+zone+slot)
  │     full → still commit, flag slotUnavailable, alert
  ├─ redeem coupon            (conditional atomic UPDATE)
  │     exhausted → drop discount, log; never charge more than authorised
  ├─ payments.status  = succeeded, link to order
  ├─ paymentStatus    = paid
  ├─ fulfilmentStatus = preparing
  ├─ append timeline entry
  └─ write audit_log
COMMIT
→ then, outside the transaction: queue emails
```

The recurring pattern: **a problem discovered after the money is
captured never rolls back the order.** It commits with a flag and a
human is alerted. Rejecting a captured payment loses a paying customer
and leaves Stripe and our database permanently disagreeing.

---

## 6. Emails are outside the transaction

A transaction holding row locks while waiting on a third-party HTTP
call is how a database gets wedged. Worse, if Resend is slow and the
transaction times out, a **paid order is rolled back**.

So: commit first, then enqueue. `email_events` rows are created in the
same transaction (cheap, local), but the actual send happens after
commit and is retried independently. Email failure never touches money
state. ([EMAILS §5](./EMAILS.md))

---

## 7. Refunds

Refunds are issued **in the Stripe dashboard**, not from our admin.

Rationale: building a refund button means our server holds the power to
move money out, which is the highest-value target in the system and the
one most worth *not* owning. Stripe's dashboard already has audit
trails, 2FA, and role permissions the client's bank will accept.

Our side is read-only: `charge.refunded` arrives, we update
`payments.refundedFils`, recompute the order's `paymentStatus`, append
a timeline entry, and email the customer. Stock is not returned
automatically — an admin decides, because the flowers may already be
made.

Revisit only if refund volume makes the dashboard impractical.

---

## 8. Reconciliation

Daily, and detailed in [ORDERS §9](./ORDERS.md). The premise is that
Stripe and Postgres *will* drift, and drift found by a job on Tuesday
is cheap while drift found by an accountant in January is not.

---

## 9. Test surface

Stripe's test mode plus `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

| Test | Asserts |
| --- | --- |
| Valid signature | 200, order paid, number assigned |
| Tampered body | **400**, nothing written |
| Missing signature header | **400** |
| Same event twice | Second is a no-op; stock decremented **once** |
| Same event twice with Redis flushed between | Still a no-op (durable layer holds) |
| `charge.refunded` before `succeeded` | No illegal transition; event parked and replayed |
| Amount mismatch | Flagged, **not** fulfilled |
| Order creation throws | **500**, Stripe will retry, orphan payment visible |
| Two concurrent successes, 1 stock | Exactly one decrement, second flagged |
| Two concurrent redemptions, `maxRedemptions: 1` | Exactly one discount granted |
| Unknown event type | 200, recorded `ignored` |

---

## 10. Required environment

| Variable | Scope | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | server, production-only value | `sk_live_…`; test key in dev |
| `STRIPE_WEBHOOK_SECRET` | server | `whsec_…`; **different per environment** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | `pk_…`, safe to expose |

To be added to `src/lib/env.ts` as **required in production, optional in
development**, following the existing pattern. No placeholder or fake
values are committed anywhere. See [DEPLOYMENT §3](./DEPLOYMENT.md).

## Payment requests (pay by link) — added 2026-10-04

A florist confirms a bespoke or event enquiry in the admin; the customer is
emailed a link and pays there. Spec: `docs/specs/quote-pay.md`. Code:
`src/backend/actions/quotes.ts` (confirm / resend / cancel),
`src/backend/actions/pay.ts` (the customer's side),
`src/backend/payments/{pay-link,intent,invoice-number,paid,verdict}.ts`.

**What is unchanged.** Only the signed webhook marks an order PAID. No amount
is ever read from a browser: the florist's amount is parsed on the server and
frozen on the order, and the PaymentIntent is created from `order.totalFils`.

**What is new, and applies to website orders too.**

- *One order, one intent.* The PaymentIntent id is written onto the order
  (`stripePaymentIntentId`) before the client secret is released. The webhook
  refuses any other intent for that order and writes `⚠ PAYMENT CHECK` on it —
  a second charge is flagged, never swallowed as "already paid".
- *Invoice numbers.* Every order that becomes PAID gets `CAL-INV-YYYY-NNNNN`,
  gap-free, from the `invoice_counters` table in one SQL statement. That same
  statement is the single-winner gate: of two concurrent webhook deliveries,
  only the one that issued the number sends emails.
- *Paid path order:* verdict → PAID → (coupon redeem slot) → invoice claim →
  emails. A crash between PAID and the invoice is healed by Stripe's retry.

**The link.** `/pay/<token>`, token = HMAC-SHA256(`PAYLOAD_SECRET`, salt). Only
the salt and the SHA-256 of the token are stored. Valid 7 days; "resend"
extends it and sends the same link. Rotating `PAYLOAD_SECRET` kills
outstanding links until each is resent. The token appears in the request URL,
so it is in Vercel's access logs and is handed to Stripe as the 3-D Secure
return URL — accepted, and the reason the page must send no Referer and must be
scrubbed from Sentry (done with the page itself).

**Cancelling.** The order is marked CANCELLED first, then the intent is
cancelled at Stripe; if Stripe refuses because the customer is paying, the
order is put back and nothing is cancelled. If money ever arrives on a
cancelled request the order is marked PAID with
`⚠ PAID AFTER CANCELLATION`, and the owner's email says the same.
**Procedure: refund that payment in Stripe. Never reinstate the order** — the
enquiry may already have a new live request, and the database allows only one.

**Unpaid requests are not orders yet.** They are excluded from revenue, "new
orders", today's deliveries and "overdue" (`isAwaitingQuote` in
`src/backend/domain/dashboard.ts`), and they do not ring the admin bell. The
bell rings when the customer pays.

**Staff may send a payment request for any amount**; every one is named in the
activity log. A discount code can never apply to one (the collection refuses).

**DEPLOY ORDER — NOT OPTIONAL.** This code selects columns that only exist
after migration `20261004_193027_quote_pay_link`. Run `pnpm migrate` against
production, verify, and only then deploy the code. The reverse order breaks
every orders read: checkout, the Stripe webhook and the admin. The migration
is additive, so the old code keeps working against the new schema.

**Screens (added 2026-10-05).**

- *Admin.* The **Payment** card (`src/admin/components/QuotePayment.tsx`) is
  the first thing on an enquiry — above the two columns, so it is at the top
  on a phone — and on the event that enquiry created. "Confirm & request
  payment" opens one sheet: final amount (prefilled from the indicative
  total), **Send to** (the customer's email, editable so a typo is corrected
  before money is asked for at it), phone, delivery day / window / address,
  gift details, a note to the customer and the email language. Afterwards the
  card shows awaiting / link expired / cancelled / paid, with Resend, Copy
  link, Send on WhatsApp and Cancel. The order page carries the same actions
  in a notice at the top and offers no fulfilment step until it is paid.
- *Finding them.* `/admin/orders` → Needs attention → "Payment requests
  awaiting payment", "Payment link expired", "Paid requests to start". The
  dashboard's Needs-attention panel links to the same three. The enquiries
  list shows a payment badge beside each status.
- *Customer.* `/pay/<token>`
  (`src/app/(frontend)/(storefront)/pay/[token]/page.tsx`,
  `src/components/commerce/PayRequestForm.tsx`). Opening it changes nothing;
  the PaymentIntent is made when pay is pressed. Apple Pay / Google Pay first,
  then card. After paying, the page says "confirming" and polls for up to 30
  seconds; it shows the invoice only once the webhook has marked the order
  paid. "Print or save as PDF" prints the invoice alone.
- *Token hygiene.* The page sends `referrer: no-referrer`, is `noindex`, and
  `/pay/` is disallowed in `robots.ts`. Sentry events, transactions and
  breadcrumbs pass through `src/lib/scrub-pay-token.ts`, on the server and in
  the browser. The paid page shows the invoice (name, email, items, total) to
  whoever holds the link, with no time limit.
- *Rate limits.* 60 page views and 10 payment starts per 10 minutes per
  network address; 5 resends per hour per order. A visitor over the limit
  sees "please wait" in their language.

**Not verified automatically.** The pay page, the admin card and Apple Pay /
Google Pay have not been run in a browser against Stripe test mode; the
manual checklist in `docs/specs/quote-pay.md` (tests section) still applies,
including a look at 390px in English and Arabic. `claimInvoice` runs real SQL and is covered
only through an injected fake. Before launch, on a scratch database: pay two
orders back to back (00001, 00002, no gap), resend a Stripe event (no second
number, no second email), and call `claimInvoice` twice in parallel for one
order (exactly one `claimedNow: true`).

## Discounts (automatic sales and discount codes) — added 2026-10-05

Server side only so far; the owner's screens and the storefront display are the next step.

### What a discount is

One collection, `discounts`, two kinds. Owner-only for read, create, update and delete — staff cannot see it.

| Kind | What it does | Where it lands on the order |
| --- | --- | --- |
| Automatic sale | Lowers the **arrangement** (base price + size uplift) of matching products. Never an add-on. One sale per product; sales never stack. | Inside `items[].unitPriceFils`, with the regular price beside it in `items[].compareAtUnitPriceFils` and the labels in `saleLabelEn` / `saleLabelAr`. |
| Discount code | An order-level amount off the already-reduced subtotal, add-ons included. One code per order. Never discounts delivery. | `discountFils` = `couponDiscountFils`, with `couponCode`. |

The order total equation is unchanged: `total = subtotal + delivery − discount`. So the payment verdict (§4) needed no change — the PaymentIntent is created for `order.totalFils`, which already is the discounted total.

Rounding is always in the customer's favour and always to whole dirhams: a sale price is rounded **down**, a percentage code is rounded **up**. The deepest discount of either kind is 90%. There is no free-order path: a total under AED 2 (`MIN_CHARGE_FILS` in `src/lib/money.ts`, the one definition) is refused.

All of the arithmetic is in `src/lib/discounts.ts` (pure, shared with the browser) and applied by `src/backend/domain/pricing.ts`.

### The browser never sets a price

The browser sends product ids, quantities, option ids, and the **text** of a code. It also sends `shownTotalFils` — the total it showed the customer. That value is an assertion: it is compared with the server's total and never used, stored or sent to Stripe. If they differ (a sale ended while the page was open, a price was edited, the request was tampered with) the answer is `PRICE_CHANGED` and nothing is created.

A code is validated on the server twice: when the basket is quoted (`quoteCheckout`) and again when the order is placed (`startCardCheckout`). A code that no longer applies refuses the order and says why; it is never silently dropped.

### A code's limits are enforced, not merely checked

A code is checked when the order is created and counted when it is paid, and a PaymentIntent never expires. Without more, a "first 20 customers" code could be attached to any number of unpaid orders and paid later. So:

1. **An order that can still be paid holds a claim** on its code. Claims = orders with that code that are redeemed, or not cancelled.
2. **A new order is admitted in two looks** — before it is created, and again after, counting everybody else's claims. An order that finds the limit already met without it is cancelled before any PaymentIntent exists. Two customers racing for the last use can both be refused; they can never both be admitted.
3. **A claim cannot be held open.** An unpaid discounted order (sale price or code) older than 60 minutes (`DISCOUNT_HOLD_MINUTES`) is cancelled together with its PaymentIntent, so a form somebody kept open stops working. This runs lazily after each checkout, and for a limited code before its claims are counted.
4. **The same customer starting again** (changing the basket creates a new order) releases her own earlier unpaid order with that code, so her own abandoned attempt never reads as "already used".

Code: `src/backend/payments/coupon-claims.ts`.

Known and accepted: someone who knows a customer's email and a once-per-customer code could cancel that customer's unpaid order by starting a checkout with the same email — the customer sees a payment error and tries again. Checkout is limited to 8 orders an hour per network.

### Counting a use — step 3 of the paid path

`redeemCoupon` (`src/backend/payments/redeem.ts`) is one SQL statement: it stamps `orders.coupon_redeemed_at` only if it is empty and the order is settled, and adds one to `discounts.times_used` only from that stamp. That makes the count exactly-once per order, however often Stripe delivers the event.

It runs **after PAID and before the invoice claim**, for the winning delivery and for a recovering retry alike, inside its own try/catch:

```
verdict → PAID → redeemCoupon → claimInvoice (single winner) → emails
```

- A failed count never undoes PAID, never stops the invoice and never stops the emails. It is logged; such orders are found by `couponDiscount` set and `couponRedeemedAt` empty.
- A crash between PAID and the count is healed by Stripe's retry, which reaches the same step again.
- **A use is never given back.** A refund or a cancellation does not decrement `timesUsed`.

Two notes can be written on the order for the owner, each once, and neither changes the order — the money is already captured, so it is honoured:

- `⚠ DISCOUNT CHECK: code X was redeemed past its limit.`
- `⚠ DISCOUNT CHECK: this discounted order was paid after its price hold ended…`

A web order paid after it was cancelled (released as stale a moment before the payment landed) is marked PAID and gets the same `⚠ PAID AFTER CANCELLATION` note a payment request gets.

### Code guessing

- One sentence for a code that does not exist, is switched off, has not started or has ended.
- The quote takes **no email address**, so it cannot be used to test whether an address belongs to a customer. Once-per-customer is applied only when an order is placed.
- `LIMITS.discountCode` (12 per 10 minutes per network) counts **wrong codes only**. A basket holding a good code re-quotes for free. A caller out of attempts is told to wait and gets the basket priced without the code.
- Paying is never blocked by that limit; the checkout limit (8 an hour) bounds guessing there.

### Payment requests are never discounted

The florist types that amount. The order collection refuses any discount, code, sale field or discount snapshot on an `admin-quote` order.

### Release order

Run migration `20261004_202611_discounts` against production **before** this code is deployed, after `20261004_193027_quote_pay_link`. The reverse breaks every read and write of `orders`.

### Not verified

`redeemCoupon`'s SQL and the claim queries are tested against fakes only, never against a real Postgres. Before launch, with `stripe listen`: pay a coded order and check `coupon_redeemed_at` is set and `times_used` goes up by exactly one; resend the same event and check it does not change.

## Payments taken outside the website

An order written by hand in the admin (`source: "admin-manual"`) can be paid
two ways, and no third: through its payment link (Stripe's signed webhook,
exactly as above), or recorded by the OWNER as cash, bank transfer or card
machine (`recordOutsidePayment`, guarded by `MANUAL_PAYMENT_CONTEXT` in
`backend/payload/hooks/orderIntegrity.ts`). A website order or an enquiry's
payment request can never be marked paid by hand. Recording a payment first
cancels any card payment still open for that order; if one is already going
through, nothing is recorded.

Migration `20261005_023342_manual_orders` adds three text columns to
`orders` (`sales_channel`, `payment_method`, `payment_reference`). Apply it
to the database BEFORE deploying the code that reads them.

## The money guard (database trigger, 2026-10-06)

Payload's `update` rewrites the whole order row from a copy it read a moment
earlier, so two writers a few milliseconds apart (the webhook and a staff
save, or two deliveries of one webhook) could put a paid order back to
unpaid or empty its invoice number. Migration
`20261006_000000_orders_money_guard` adds a BEFORE UPDATE trigger on
`orders` that lets the money columns move forward only: payment status never
leaves PAID / REFUNDED / PARTIALLY_REFUNDED, and the invoice number, payment
time, counted discount code, payment method and (once paid) the PaymentIntent
id keep their first value. It never raises: the innocent save succeeds and
the settled values are simply kept.

Prove it against a TEST database (everything is rolled back):

    npx tsx --env-file=.env.local scripts/money-guard-probe.mts <test-host-fragment>

Also fixed with it: a PaymentIntent is created without `receipt_email` when
the order has no email (Stripe refuses an empty one); the intent id is
written as one column, not a whole-row update; a replayed create is never
trusted; an order can never be CREATED as paid; a payment link is valid until
the end of its last day in Abu Dhabi.

