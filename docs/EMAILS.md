# Calanthe — Email Architecture (Resend)

Related: [DATABASE §14](./DATABASE.md) · [ORDERS](./ORDERS.md) ·
[SECURITY](./SECURITY.md)

---

## 1. Transactional vs marketing — a legal boundary, not a folder

These are separated at every level: different sending domain, different
consent rule, different unsubscribe behaviour, different code path.

| | Transactional | Marketing |
| --- | --- | --- |
| Trigger | Something the customer did | We decided to send it |
| Consent | **Not required** — it completes a transaction they started | **Required** — explicit opt-in, `users.marketing.subscribed` |
| Unsubscribe link | **Must not** carry one (they cannot opt out of a receipt) | **Mandatory**, one click, honoured immediately |
| Sender | `orders@calanthe.ae` | `hello@calanthe.ae` |
| Suppression list | Bypasses marketing suppression | Always checked first |
| Can be batched | No | Yes |

The code enforces this: `sendTransactional()` and `sendMarketing()` are
separate functions with different signatures. `sendMarketing()` will
not send without a consent check, and there is no way to reach it with
a receipt template.

Mixing the two is how a business ends up unable to deliver receipts
because a marketing campaign got the domain blocked.

---

## 2. Templates

### Transactional

| Template | To | Trigger | Contains prices |
| --- | --- | --- | --- |
| `order_confirmation` | buyer | payment verified | ✅ yes |
| `order_receipt` | buyer | payment verified (PDF attached) | ✅ yes |
| `order_preparing` | buyer | status → preparing | ❌ no |
| `order_out_for_delivery` | buyer | status → out_for_delivery | ❌ no |
| `order_delivered` | buyer | status → delivered | ❌ no |
| `order_cancelled` | buyer | status → cancelled | ✅ yes (refund amount) |
| `refund_issued` | buyer | `charge.refunded` | ✅ yes |
| `payment_failed` | buyer | intent failed | ❌ no (retry link only) |
| **`gift_notification`** | **recipient** | out_for_delivery | ❌ **structurally impossible** |
| `enquiry_received` | enquirer | form submitted | ❌ no |
| `enquiry_reply` | enquirer | staff replies | ❌ no |
| `byo_quote` | customer | admin quotes a custom arrangement | ✅ yes |
| `membership_confirmed` | customer | subscription active | ✅ yes |
| `membership_payment_failed` | customer | `invoice.payment_failed` | ✅ yes |
| `otp_code` | — | login (WhatsApp first, email fallback) | ❌ no |
| **`admin_new_order`** | owner + staff | payment verified | ✅ yes |
| **`admin_new_enquiry`** | owner + staff | form submitted | ❌ no |

### Marketing (B7+, none built at launch)

`newsletter` · `occasion_reminder` (a year after a birthday order) ·
`abandoned_cart` — all requiring `marketing.subscribed = true`.

---

## 3. The gifting rule — enforced by types, not discipline

> The recipient must never learn what the gift cost.

A comment saying "don't include prices" is worthless; the person adding
a field six months from now will not read it. So the constraint is
structural:

```ts
// The buyer's data. Has money in it.
type BuyerContext  = { order: OrderWithAmounts; … };

// The recipient's data. There is no amount field to reach.
type GiftContext   = {
  recipientName: string;
  senderName: string;
  giftMessage: string;
  deliveryWindow: string;
  // no order, no items, no amounts — by construction
};

renderGiftNotification(ctx: GiftContext): Email   // cannot see money
```

`GiftContext` is built by a mapper that takes the order and returns
only those five strings. The template function's parameter type makes
a price literally unreachable — it would be a TypeScript error, caught
at build time.

**Three layers of enforcement:**

1. **Types** — `GiftContext` has no amount field.
2. **Runtime assertion** — before any send to a recipient address, the
   rendered HTML and text are scanned for `AED`, a currency symbol, or
   a `\d+\.\d{2}` pattern. A match throws and the send is abandoned.
3. **Test** — a test renders `gift_notification` from an order with
   distinctive amounts and asserts none appear in the output. It fails
   the build if anyone adds a price.

`email_events.containsPrices` is set by the **template**, not the
caller, so the log itself proves the rule held.

---

## 4. Provider abstraction

```ts
export interface EmailProvider {
  send(msg: OutboundEmail): Promise<{ providerMessageId: string }>;
}
```

Three implementations:

- `ResendProvider` — production
- `ConsoleProvider` — development; prints to the terminal, sends nothing
- `MemoryProvider` — tests; captures for assertions

Selected by env, never by an `if (NODE_ENV)` scattered through call
sites. **No real email is ever sent from a developer machine**, which
is how a test order ends up in a real customer's inbox.

---

## 5. Sending pipeline

```
  business event (order paid, enquiry created)
        │
        ▼
  email_events row written  ─── inside the DB transaction (cheap, local)
        │                       status: queued
   ─────┴───── COMMIT ────────────────────────────────────────
        │
        ▼
  send attempt              ─── AFTER commit, never inside
        │
        ├─ ok    → status: sent, providerMessageId stored
        └─ error → attempts++, retry at 1 m, 5 m, 30 m
                   after 3 → status: failed → admin "Needs attention"
        │
        ▼
  Resend webhook  → delivered | bounced | complained
```

**Why the row is written inside the transaction but the send is not:**
the row is the durable intent — if the process dies immediately after
commit, a queued row still exists and the retry job picks it up. The
HTTP call is what must stay outside, so a slow provider can never hold
database locks or roll back a paid order.

A **hard bounce** or **spam complaint** on a marketing send sets
`marketing.subscribed = false` automatically and records the reason in
`audit_log`. Sending again to an address that complained is how a
domain's reputation dies.

---

## 6. Domain setup

Sending from `calanthe.ae` requires DNS records the client controls:

| Record | Purpose |
| --- | --- |
| SPF (TXT) | Authorises Resend to send as the domain |
| DKIM (CNAME ×3) | Cryptographically signs each message |
| DMARC (TXT) | Policy — start `p=none`, tighten to `p=quarantine` |
| Return-Path (MX/CNAME) | Bounce handling |

Until these verify, `ConsoleProvider` stays selected in production and
the admin shows a warning banner. **Never send from an unverified
domain** — it lands receipts in spam and burns the domain's reputation
permanently.

Sending from `calanthe.ae@gmail.com` is not an option: Gmail blocks
automated bulk sending and receipts will not deliver reliably.

---

## 7. What each email may contain

| Audience | Allowed | Forbidden |
| --- | --- | --- |
| Buyer | Everything about their own order | Anything about another order; `floristNotes`; internal ids |
| **Recipient** | Sender's name, gift message, delivery window | **Any amount**; the buyer's address, email or phone; product SKUs |
| Enquirer | Their own enquiry, our reply | `internalNotes`; other enquiries |
| Admin/staff | Everything | — (internal) |

Every customer-facing template renders **only** from an explicit
context object built by a mapper. No template receives a raw Payload
document, because a raw document carries `floristNotes`, internal ids,
and every field added in future.

---

## 8. Required environment

| Variable | Scope |
| --- | --- |
| `RESEND_API_KEY` | server, production-only value |
| `RESEND_WEBHOOK_SECRET` | server, for delivery/bounce events |
| `EMAIL_FROM_TRANSACTIONAL` | e.g. `Calanthe <orders@calanthe.ae>` |
| `EMAIL_FROM_MARKETING` | e.g. `Calanthe <hello@calanthe.ae>` |
| `EMAIL_ADMIN_RECIPIENTS` | comma-separated, for new-order alerts |

Optional in development (falls back to `ConsoleProvider`), required in
production. No fake values committed.

---

## 9. Tests

| Test | Asserts |
| --- | --- |
| Gift notification contains no price | The rule, on real order data |
| `GiftContext` type has no amount field | Compile-time (`tsc`) |
| Recipient scan catches an injected price | The runtime guard actually fires |
| Marketing send without consent | Throws, sends nothing |
| Transactional send without consent | Succeeds (correct — it must) |
| Unsubscribed address, marketing | Suppressed |
| Unsubscribed address, receipt | **Still delivered** |
| Provider throws | Row `failed` after 3 attempts, order unaffected |
| Duplicate Resend webhook | Idempotent |
| Order email renders from snapshot | Unchanged after the product is edited |
