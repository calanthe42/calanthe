# Calanthe — Admin Architecture

The admin is organised around **what the client does each day**, not
around what the database looks like. She never sees the word "slug",
"fils", "collection" or "relationship".

Related: [SECURITY §3](./SECURITY.md) · [DATABASE](./DATABASE.md) ·
[ORDERS](./ORDERS.md)

---

## 0. Where the business actually works: `/admin`

> Sections 1–7 below describe the original plan to theme Payload's own
> admin panel. That plan was superseded: the business works in a custom
> Calanthe application at **`/admin`**, and Payload's panel at **`/cms`**
> is developer infrastructure only. The rules in those sections — business
> language, no fils, legal next steps only, nothing marks an order paid —
> all still apply, and are implemented in `/admin`.

**The owner never needs `/cms` for normal work.** Every business operation
has a Calanthe screen:

| Area | Screens |
| --- | --- |
| Sign in / out | `/admin/login` — Payload's own `login`, same `payload-token` cookie, admin/staff only (`backend/actions/admin-auth.ts`) |
| Dashboard | `/admin` — revenue, orders, customers, waiting enquiries; 7/30/90 days; today's deliveries, overdue orders, best sellers, recent orders and enquiries; quick actions |
| Products | `/admin/products` (search, availability, category, highlight, sort; Edit/View on every row) · `/new` · `/[id]/edit` |
| Occasions | `/admin/occasions` · `/new` · `/[id]/edit` |
| Media | `/admin/media` — upload, preview, search, type and usage filters, delete (refused while in use) |
| Orders | `/admin/orders` (search, status, payment, delivery dates) · `/[orderNumber]` |
| Customers | `/admin/customers` · `/[id]` (owner only) |
| Enquiries | `/admin/enquiries` (search, status, priority, type) · `/[id]` |
| Events | `/admin/events` (search, status, type) · `/[id]` |

**The product editor** covers every business field: name, web address,
short and full description, price and compare-at price **in AED**,
category, flowers, occasions, photos (upload or choose, reorder, remove —
the first is the card image), availability, featured / bestseller / new /
seasonal, stock, shop order, search title and description, and "hide from
search engines". Photos are picked in a dialog that can also upload, so the
owner never leaves the product to add one. A product cannot be made
available without a photo; the editor says so before she tries.

**The full description** is edited as plain paragraphs and stored as
Lexical rich text. It is only rewritten when the words change, so saving a
price never flattens formatting added elsewhere (`backend/domain/richtext.ts`).

**Deletes refuse rather than break.** A photo used by a product or occasion,
an occasion used by a product, and a product that has been ordered cannot be
deleted — the message names what is using it and offers the alternative
(remove it there, or hide instead).

**Where `/cms` still appears:** one small "Developer CMS ↗" link in the
sidebar footer, rendered for the owner role only. Staff never see it.

**Screens not yet built** (Memberships, Marketing, Delivery, Staff,
Settings) say so plainly and no longer link to the CMS.

All admin reads and writes run as the signed-in user — no `overrideAccess`
anywhere in the admin (`backend/actions/admin.ts`).

---

## 1. Navigation — business language, not schema

Payload groups collections by `admin.group`. The labels below are what
appears on screen; the collection slug is in brackets and never shown.

```
  TODAY
    Dashboard                    custom root view
    Orders                       (orders)
    Enquiries                    (enquiries)
    Custom Requests              (custom_arrangements)

  SHOP
    Flowers                      (products)
    Occasions                    (occasions)
    Add-ons                      (add_ons)
    Photos                       (media)

  CUSTOMERS
    Customers                    (users, filtered role=customer)
    Memberships                  (membership_subscriptions)

  MONEY                          admin only — hidden from staff
    Payments                     (payments)
    Discount Codes               (coupons)

  SETTINGS                       admin only
    Delivery Areas               (delivery_zones)
    Membership Plans             (membership_plans)
    Shop Settings                (site_settings global)
    Team                         (users, filtered role in admin|staff)
    Email Log                    (email_events)
    Activity Log                 (audit_log)
```

`webhook_events` and `counters` are `admin.hidden: true`. Infrastructure
is not content.

**Staff see only the TODAY and SHOP groups.** Not because the menu is
filtered — because [access control](./SECURITY.md#3-permission-matrix)
denies them, and Payload hides what a user cannot read. The menu
reflects permission; it does not create it.

---

## 2. The dashboard

A custom root view replacing Payload's default landing page. It answers
one question: **what do I have to do today?**

```
┌────────────────────────────────────────────────────────────┐
│  CALANTHE                          Saturday, 5 September   │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│    6            AED 2,340        3            2            │
│    orders       today            enquiries    low stock    │
│    today        revenue          waiting      items        │
│                                                            │
│  TODAY'S DELIVERIES                     cutoff 14:00 GST   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ CAL-2026-0184  Blush Ceremony   Al Reem   10–13  ●   │  │
│  │ CAL-2026-0185  Build Your Own   Saadiyat  13–17  ●   │  │
│  │ CAL-2026-0186  Rose Noir        Khalidiya 17–21  ●   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ⚠ NEEDS ATTENTION                                         │
│    · 1 payment received, order not created                 │
│    · 2 emails failed to send                               │
│    · Peony Dream — 2 left                                  │
└────────────────────────────────────────────────────────────┘
```

**Needs attention** is the panel that makes this a production system
rather than a CRUD screen. It surfaces exactly the failure states named
in [ORDERS §7](./ORDERS.md): orphan payments, amount mismatches, stock
shortfalls, unavailable slots, failed webhooks, failed emails. Silence
means healthy.

Every number is a link to the filtered list behind it. Nothing on this
screen is decorative.

Implementation: `admin.components.views.dashboard` — a React Server
Component querying via the Local API, so no client-side data fetching
and no extra endpoint to secure.

---

## 3. The order screen

The screen the client will use more than any other.

```
┌────────────────────────────────────────────────────────────┐
│  CAL-2026-0184                    ● Paid    ● Preparing    │
│  ────────────────────────────────────────────────────────  │
│  Placed  5 Sep, 09:14      Deliver  5 Sep, 13:00 – 17:00   │
│                                                            │
│  ┌─ MARK AS ─────────────────────────────────────────────┐ │
│  │   [ Ready ]   [ Out for delivery ]   [ Delivered ]    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  FLOWERS                              [ Print receipt ]    │
│    Blush Ceremony · Deluxe ×1              AED 620         │
│      + Vase                                AED  60         │
│    ─────────────────────────────────────────────────────   │
│    Delivery — Abu Dhabi                    AED  35         │
│    Total                                   AED 715         │
│                                                            │
│  🎁 GIFT — the recipient must not see the price            │
│    To      Mariam Al Hosani · +971 5x xxx xxxx             │
│    Where   Al Reem Island, Abu Dhabi                       │
│    Card    "Happy birthday, always."                       │
│                                                            │
│  FROM      Sara Ahmed · sara@… · +971 5x xxx xxxx          │
│                                                            │
│  FLORIST NOTES  (internal — never emailed)                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  HISTORY                                                   │
│    09:14  Order placed                                     │
│    09:14  Payment received            Stripe               │
│    09:20  Preparing                   Fatima               │
└────────────────────────────────────────────────────────────┘
```

Design rules:

- **Status buttons show only legal next steps.** `Delivered` is not
  rendered on an order that is still `preparing` — the transition
  matrix in [ORDERS §2](./ORDERS.md) drives the UI, and the server
  re-validates regardless.
- **No button marks an order paid.** Money state comes from the webhook
  only. There is nothing to click.
- **Amounts are read-only for every role**, rendered from the snapshot.
- **The gift banner is loud** so nobody hands the recipient a receipt.
- Every status change writes `timeline` and `audit_log` with the actor.

---

## 4. Fields the client never sees

| Hidden | Why | Instead |
| --- | --- | --- |
| `slug` | Meaningless to her | Auto-generated from the name, editable under "Advanced" |
| `*Fils` | Nobody thinks in fils | A custom AED input; stores fils, displays `AED 480.00` |
| `id`, relationship ids | Database noise | Titles |
| `idempotencyKey`, `stripePaymentIntentId` | Plumbing | Under "Technical", admin only |
| `webhook_events`, `counters` | Infrastructure | Hidden entirely |
| `containsPrices` | Internal assertion | Hidden |

The AED input is one small custom field component (`admin.components.Field`)
and it removes the single biggest source of admin error: entering
`48000` when you meant `480`.

---

## 5. Light and dark

```ts
admin: { theme: "all" }   // verified available in Payload 3.88
```

`"all"` gives every user a light/dark toggle that persists per account.
On top of it, one stylesheet (`admin.components.css`) maps Payload's CSS
custom properties to Calanthe's palette so both themes are the brand,
not a tinted default:

| | Light | Dark |
| --- | --- | --- |
| Background | `canvas #F3EFDF` | `olive #2B2F1B` |
| Surface | `#FFFFFF` | `#353A22` |
| Text | `olive #2B2F1B` | `cream #E4DCC5` |
| Accent / primary action | `burnt-orange #B55B29` | `burnt-orange #B55B29` |
| Hairline | `#CBC4A9` | `rgba(228,220,197,.18)` |
| Headings | Cinzel | Cinzel |

The accent stays constant across themes so a primary action is always
the same colour — the one thing that should never move.

Contrast is checked both ways: cream on olive is 8.9:1, olive on canvas
is 10.4:1, and burnt-orange on canvas is 4.6:1 — all above WCAG AA for
their sizes. Burnt-orange is used for large text and buttons only, never
small body copy.

---

## 6. English and Arabic

Two independent things, often confused:

### 6.1 Admin interface language

Payload ships Arabic translations — **verified present** in
`@payloadcms/translations@3.88.0` (`ar`, `dateFNSKey: "ar"`, one of 44
bundled languages).

```ts
i18n: {
  supportedLanguages: { en, ar },
  fallbackLanguage: "en",
}
```

Each user picks their language in their own account settings, so the
owner can work in English while a florist works in Arabic.

> **Honest limitation.** A search of `@payloadcms/ui@3.88.0` found no
> `rtlLanguages`, `dir="rtl"` or `isRTL` handling. Payload will render
> Arabic **text** in a **left-to-right layout**. It is usable, but it is
> not correct.
>
> Fixing it properly means setting `dir="rtl"` on the admin root via a
> custom provider plus a targeted stylesheet converting Payload's
> physical CSS properties (`margin-left`, `left`) to logical ones
> (`margin-inline-start`, `inset-inline-start`). That is a real cost and
> it must be **measured before it is promised**. Plan: ship Arabic text
> in LTR at B1.5, evaluate the RTL stylesheet as a separate, scoped
> task, and tell the client which of the two she is getting.

### 6.2 Content language (the important one)

Payload `localization` ([ARCHITECTURE §5](./ARCHITECTURE.md)) gives each
localized field an EN/AR toggle in the editor. One product document,
two names, two descriptions.

With `fallback: true`, Arabic falls back to English until translated —
so the client can launch in English and translate at her own pace
without a single empty page.

This is also what finally gives the storefront's `EN | ع` toggle real
content to switch. Today it flips `lang` and `dir` with no translations
behind it (`src/lib/locale.tsx`).

---

## 7. List views

Defaults matter more than they look — a good default list is the
difference between a tool and a chore.

| Collection | Default columns | Default sort | Filters |
| --- | --- | --- | --- |
| Orders | number · customer · total · delivery date · payment · fulfilment | delivery date ↑ | status, date, zone |
| Enquiries | type · name · received · status · assigned | created ↓ | type, status, assignee |
| Flowers | photo · name · price · stock · status | name ↑ | occasion, status, stock |
| Customers | name · phone · orders · last order · spend | last order ↓ | has orders, consent |
| Memberships | customer · plan · day · status · next delivery | next delivery ↑ | status, plan |

Orders default to **delivery date ascending**, not newest-first: the
question is "what leaves the shop next", not "what arrived last".

---

## 8. Access is enforced twice

The UI hides what a role cannot use. The database refuses it regardless.

Hiding a field with `admin.condition` is **presentation**. The security
boundary is the `access` function ([SECURITY §3](./SECURITY.md)). Every
restriction in this document exists in both places, and the access
tests assert the second — because a hidden field is still reachable
through the REST API, and that is exactly the mistake this note exists
to prevent.
