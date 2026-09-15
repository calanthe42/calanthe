# Calanthe — Order Architecture

The full lifecycle from cart to delivered, the two status axes, the
snapshot contract, and what happens when each step fails.

Related: [DATABASE §8–9](./DATABASE.md) · [PAYMENTS](./PAYMENTS.md) ·
[EMAILS](./EMAILS.md)

---

## 1. Lifecycle

```
  CART                    server-owned, no prices stored
    │  customer clicks Checkout
    ▼
  QUOTE                   server rebuilds cart from DB,
    │                     recomputes every amount via pricing.ts,
    │                     revalidates stock / coupon / slot / cutoff
    ▼
  ORDER (unpaid)          fulfilment=awaiting_payment
    │                     payment=unpaid
    │                     NO orderNumber yet
    ▼
  STRIPE                  PaymentIntent created for the SERVER's total
    │                     customer redirected / Elements confirmed
    │
    ├── browser returns ──► "thank you" page shows PENDING, never PAID
    │                       (the browser is not proof — see §6)
    ▼
  WEBHOOK                 payment_intent.succeeded, signature verified,
    │                     idempotency checked
    ▼
  TRANSACTION             ┌ assign orderNumber (gap-free, locked)
    │                     │ decrement stock (SELECT … FOR UPDATE)
    │                     │ claim slot capacity
    │                     │ redeem coupon (atomic conditional UPDATE)
    │                     │ payment=paid, fulfilment=preparing
    │                     │ append timeline
    │                     └ queue emails (NOT sent inside the txn)
    ▼
  PREPARING ─► READY ─► OUT_FOR_DELIVERY ─► DELIVERED
                                             │
                                             └─► (refund) ─► REFUNDED
```

---

## 2. Two status axes — never one

Conflating "has it been paid" with "has it been made" is the classic
e-commerce modelling bug: a refunded-but-delivered order has no valid
single status. Orders therefore carry two independent enums.

### `fulfilmentStatus` — where the flowers are

| Value | Meaning | Set by |
| --- | --- | --- |
| `awaiting_payment` | Order row exists, money not confirmed | system |
| `preparing` | Paid; florist is making it | system (webhook) |
| `ready` | Made, waiting for the driver | staff |
| `out_for_delivery` | With the driver | staff |
| `delivered` | Handed over | staff |
| `cancelled` | Will not be delivered | admin |

**Allowed transitions** (anything else throws):

```
awaiting_payment → preparing | cancelled
preparing        → ready | cancelled
ready            → out_for_delivery | cancelled
out_for_delivery → delivered | cancelled
delivered        → (terminal)
cancelled        → (terminal)
```

`delivered` is terminal on purpose. "Undo a delivery" is a support
conversation, not a button — the audit trail must not be rewritable.

### `paymentStatus` — where the money is

| Value | Meaning |
| --- | --- |
| `unpaid` | No successful charge |
| `processing` | Stripe is working (3-D Secure, async method) |
| `paid` | Verified by webhook |
| `failed` | Last attempt declined; customer may retry |
| `partially_refunded` | Some money returned |
| `refunded` | All money returned |
| `disputed` | Chargeback opened |

Only the webhook writes `paymentStatus`. No admin UI control sets it —
if a button could mark an order paid, the button becomes the security
hole.

**Cross-axis rule:** `fulfilmentStatus` may not leave
`awaiting_payment` unless `paymentStatus = paid`. Enforced in the
transition function, not the UI.

---

## 3. The server computes everything

The browser sends **only** identifiers and intent:

```
{ cartId, deliveryZoneSlug, deliveryDate, slotLabel,
  recipient{…}, isGift, giftMessage, couponCode, idempotencyKey }
```

There is no `price`, `subtotal`, `discount`, `deliveryFee` or `total`
field in the request body — and the Zod schema **rejects the request if
one is present**, rather than ignoring it. Silently ignoring a
tampered field hides the attack; rejecting it surfaces one.

The server then:

1. Loads the cart **by id, scoped to the caller's session or guest
   token** (an unscoped load is an IDOR — any cart for any customer).
2. Loads each product fresh from the database.
3. Rejects the checkout if any item is `archived`, inactive, or out of
   stock.
4. Recomputes every amount with `lib/pricing.ts`.
5. Re-validates the coupon against live data (active, in date, min
   order met, not exhausted, allowed products).
6. Re-validates zone, slot capacity and same-day cutoff in Asia/Dubai.
7. Creates the PaymentIntent for **its own** total.

`lib/pricing.ts` is pure — fils in, fils out, no DB, no clock. Time and
loaded records are passed in. That is what makes the money path
unit-testable, and the money path is the one that must never be wrong.

```
subtotal      = Σ (unitPrice + Σ addOns) × qty
discount      = coupon applied to eligible subtotal   (never below 0)
deliveryFee   = zone fee, or 0 if subtotal ≥ freeDeliveryThreshold
vat           = settings.vatEnabled ? percentOf(taxable, rate) : 0
total         = subtotal − discount + deliveryFee + vat
```

Order of operations is fixed and tested: discount before delivery fee,
free-delivery threshold measured on the **discounted** subtotal, VAT
last. Changing the order changes what customers pay, so it is a test,
not a convention.

---

## 4. What is snapshotted, and why

At order creation every commercially significant value is **copied**
into the order. Full field list: [DATABASE §9](./DATABASE.md).

| Copied | Because without it |
| --- | --- |
| `productName`, `productSlug` | A rename or archive rewrites old receipts |
| `imageUrl` | Deleting a photo blanks past orders |
| `variantLabel`, `variantSku` | Variants get renamed and removed |
| `unitPriceFils`, `lineTotalFils` | **A price change would rewrite history** |
| add-on `name` + `priceFils` | Add-on prices change |
| `delivery.zoneName` + `feeFils` | Zone fees change |
| `couponSnapshot` | Explains *why* the discount was that amount |
| `vat` group | The day VAT is switched on, old orders stay VAT-free |
| `contact` group | The customer may change their email later |

The `product` relationship is kept **as well**, for reporting only. A
lint rule and code review enforce that no receipt, email, or order
display path reads through it.

**Required test:** create an order → change the product's price, name
and image, then archive it → re-render the receipt → assert every
value byte-identical.

---

## 5. Order numbers and receipt numbers

- **`orderNumber`** — `CAL-YYYY-NNNN`, assigned **only** inside the
  paid transaction, gap-free, via `SELECT … FOR UPDATE` on the
  `counters` row for the year. Unpaid orders never consume a number,
  so abandoned checkouts leave no holes in the books.
- **`receiptNumber`** — issued when the receipt is first generated,
  same mechanism, separate counter. Kept distinct because a receipt may
  need reissuing without minting a new order.

Both are unique-where-not-null in the database, not merely unique in
application code.

---

## 6. The browser is not proof of payment

The success page after Stripe redirect shows:

> **Order received.** We are confirming your payment — you will get an
> email the moment it clears.

and polls the order's `paymentStatus`. It **never** renders "Paid"
until the webhook has written it.

This is not paranoia. A customer can close the tab before the redirect,
the redirect can fail on a flaky connection, or an attacker can simply
open the success URL directly. Only the signature-verified webhook
changes money state. See [PAYMENTS §2](./PAYMENTS.md).

---

## 7. Failure handling

Every row here is a real scenario with a defined outcome, not a hope.

| # | Failure | Behaviour |
| --- | --- | --- |
| 1 | **Stripe succeeds, order creation fails** | Webhook returns **500**. Stripe retries with backoff for up to 3 days. The `webhook_events` row stays `failed` with the error and an attempt count; it appears in the admin's *Needs attention* panel. The `payments` row exists with `order: null` — a visible orphan, never a silent loss. Sentry alerts immediately. |
| 2 | **Webhook arrives twice** | Redis `SETNX stripe:evt:<id>` is the fast path; the unique `(source, eventId)` constraint on `webhook_events` is the guarantee. Second delivery returns **200** and does nothing. Both layers exist because Redis can be flushed and Stripe retries for days. |
| 3 | **Webhooks arrive out of order** (`refunded` before `succeeded`) | Handlers are written as **state assertions, not increments**: each reads the current row and refuses an illegal transition rather than applying a delta. An event for an unknown PaymentIntent is stored `status: received`, returns 200, and is replayed by a reconciliation job once the intent exists. |
| 4 | **Email fails** | Sending happens **outside** the DB transaction, after commit. A failure never rolls back a paid order. `email_events` row goes `failed`, retried 3× with backoff; still failing, it surfaces in the admin. Money state is never coupled to an email provider's uptime. |
| 5 | **Customer closes the browser mid-checkout** | Order stays `awaiting_payment` with no `orderNumber`. If the webhook later confirms payment, it completes normally — the browser was never required. If no payment arrives in 24 h, a job marks it `cancelled` and releases nothing (nothing was reserved). |
| 6 | **Product goes out of stock during checkout** | Soft check at add-to-cart and at quote; **authoritative** check inside the paid transaction under `SELECT … FOR UPDATE`. If stock is gone at that moment the transaction still commits the order (the money is real) but flags `fulfilmentStatus: preparing` with a `stockShortfall` timeline entry and alerts the admin to contact the customer. **Never refuse a payment that Stripe already captured.** |
| 7 | **Coupon expires between cart and payment** | Re-validated at quote *and* inside the transaction. If it fails at the transaction, the discount is dropped, the order completes at the recomputed price, and the customer is charged the amount the PaymentIntent was created for — never more. If the recomputed total is *higher* than the PaymentIntent, the difference is absorbed and logged; we do not charge more than was authorised. |
| 8 | **Delivery zone fee changes mid-checkout** | The order snapshots the fee at quote time and the PaymentIntent is created for that total. A later admin change cannot affect an in-flight checkout. |
| 9 | **Admin changes a product price mid-checkout** | Same: the quote's snapshot governs. Between quote and payment the price is frozen for that PaymentIntent. |
| 10 | **Refund issued in the Stripe dashboard** | `charge.refunded` webhook → `payments.refundedFils` updated → order `paymentStatus` becomes `refunded` or `partially_refunded`. Stock is **not** automatically returned (the flowers were cut); an admin decides. Timeline entry recorded. |
| 11 | **Delivery slot fills during checkout** | Capacity counted inside the transaction. If full, the order still completes and is flagged for the admin to reschedule with the customer. Money already taken is never rejected. |
| 12 | **Payment succeeds for an amount ≠ our total** | Order is flagged `paymentMismatch`, never auto-fulfilled, and raised in *Needs attention*. Amount is taken from Stripe's event, not from our expectation. |

The governing principle across all twelve: **once Stripe has the
customer's money, the order always exists.** Every downstream problem
becomes a flag for a human, never a rollback that loses the sale.

---

## 8. Concurrency

Four races exist. Each has a named mechanism.

| Race | Mechanism |
| --- | --- |
| Two customers buy the last bouquet | `SELECT … FOR UPDATE` on the variant row inside the paid transaction; stock decrement and the check are one atomic step |
| Two customers claim the last redemption of a coupon | Conditional atomic `UPDATE … WHERE redeemed_count < max_redemptions`; 0 rows affected means exhausted ([DATABASE §6](./DATABASE.md)) |
| Two orders take the last delivery slot | `COUNT` of paid orders for `(date, zone, slot)` inside the transaction, with a Postgres advisory lock on a hash of that tuple |
| Two webhook deliveries process the same event | Redis `SETNX` + unique `(source, eventId)` |

Order numbers are serialised by the `counters` row lock. That
deliberately makes paid-order creation single-threaded; at this
business's volume it costs nothing and buys gap-free books.

### Lock ordering — deadlock prevention

The paid transaction takes **four** locks. Two transactions acquiring
them in different orders will deadlock under concurrency. The order is
therefore fixed and must never vary:

```
1. counters          (order number)
2. product variants  (stock, ascending by variant id)
3. delivery slot     (advisory lock on hash(date, zone, slot))
4. coupon            (conditional UPDATE, no explicit lock)
```

Variants are locked **in ascending id order** within step 2, so two
orders containing the same two products in opposite cart order cannot
deadlock against each other. This is easy to get wrong and expensive to
debug in production, so it is a documented rule with a concurrency
test behind it, not a convention.

### Guest cart merge

Logging in from two tabs simultaneously must not duplicate items. The
merge runs in a single transaction that locks the target cart, appends,
clamps quantities to 20, and deletes the guest cart. A second
concurrent merge finds no guest cart and is a no-op.

---

## 9. Reconciliation

A daily job (Vercel Cron) that assumes the system has drifted, because
eventually it will:

1. Stripe PaymentIntents `succeeded` in the last 7 days with no
   matching `payments` row → alert.
2. `payments` rows `succeeded` with `order: null` → alert.
3. Orders `paymentStatus: paid` whose summed payments ≠ `amounts.totalFils` → alert.
4. Orders stuck `awaiting_payment` > 24 h → auto-cancel.
5. `webhook_events` still `failed` after max attempts → alert.
6. Carts past `expiresAt` → delete.
7. **`email_events` still `queued` after 15 minutes → send now.** This
   is the safety net for a process that dies between transaction commit
   and the send call. Without it, the durable-intent row written inside
   the transaction would never be acted on and a customer would silently
   never receive their receipt. Added in design review — the original
   pipeline described the row but never named who sweeps it.

Output goes to the admin dashboard's *Needs attention* panel and to
Sentry. Silence is the success case.
