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
