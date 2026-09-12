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
has a Calanthe screen, in her language and her theme.

### 0.1 One design system

Every screen is assembled from the primitives in `src/admin/ui/` — one
Button, one Table, one Dialog, one toast system, one save cycle. No screen
carries its own copy of anything (see `src/admin/README.md`).

| Piece | How it is built |
| --- | --- |
| Modal, confirmation, mobile drawer | The browser's own `<dialog>` with `showModal()`: the top layer, so no ancestor can clip or re-anchor it, with focus trapping, Escape and focus return built in |
| Row menu, tabs | The WAI-ARIA patterns by hand: arrow keys, Home/End, type-to-find, Escape returns focus to the trigger |
| Tables | A real `<table>` from 768px; below that each row becomes a card, so the Edit button is never the part that falls off-screen |
| Toasts, saving state | One provider and one `useAction` hook, used by every screen |

**No dependency was added for any of it.** Display primitives are Server
Components; only interaction is a client island.

### 0.2 Theme and language are decided on the server

`calanthe-admin-theme` (light, dark, system) and `calanthe-admin-locale`
(en, ar) are cookies read in `(admin)/admin/layout.tsx`, which stamps `lang`,
`dir` and `data-theme` on `<html>` before the first byte reaches the browser.
There is no flash of the wrong theme, and no moment where Arabic renders
left-to-right.

- Dark mode is **designed, not inverted** (section 5).
- Arabic **mirrors the whole layout** (section 6.1). Every admin file uses
  logical CSS only, enforced by `src/admin/rtl-guard.test.ts`, which fails
  the build if a left/right-specific class appears in an admin class string.
- Both switches live at the foot of the navigation, beside View store and
  the account, and on the sign-in screen.

### 0.3 The screens

| Area | Screens |
| --- | --- |
| Sign in / out | `/admin/login` — Payload's own `login`, the same `payload-token` cookie, admin/staff only; language and theme can be chosen before signing in |
| Dashboard | `/admin` — revenue (placed orders, with paid shown beside it), orders, customers, products; 7/30/90 days; a **Needs attention** panel built only from conditions that are true; revenue and order charts; open orders by status; top products; today's deliveries; recent orders and enquiries; quick actions |
| Products | `/admin/products` (search, availability including missing photos and out of stock, category, highlight, sort, paging) · `/new` · `/[id]/edit` |
| Occasions | `/admin/occasions` (search, status) · `/new` · `/[id]/edit` |
| Media | `/admin/media` — upload, search, type and usage filters, a details sheet with editable alt text, delete (refused while in use) |
| Orders | `/admin/orders` (search, status, payment, needs-attention, delivery dates, paging) · `/[orderNumber]` |
| Customers | `/admin/customers` · `/[id]` (owner only) |
| Enquiries | `/admin/enquiries` (search, status including "waiting for a reply", priority, type, follow-up due) · `/[id]` |
| Events | `/admin/events` (search, status, type) · `/[id]` |
| Not built yet | Discounts, Delivery, Memberships, Campaigns, Staff, Settings — each marked "Soon", saying plainly what is missing, linking to nothing |

Navigation is grouped **Overview, Catalog, Sales, Operations, Marketing,
System**, as a sidebar on desktop and a drawer on a phone.

**The product editor** covers every business field: name, web address, short
and full description, price and compare-at price **in AED**, category,
flowers, occasions, photos (upload or choose, reorder, set the primary one,
remove), availability, featured / bestseller / new arrival / seasonal, stock,
store order, search title and description, and "hide from search engines". A
product cannot be made available without a photo, and the switch says so
before she tries.

**The full description** is edited as plain paragraphs and stored as Lexical
rich text, rewritten only when the words change, so saving a price never
flattens formatting added elsewhere (`backend/domain/richtext.ts`).

### 0.4 Every change says what happened

Every save, delete and status change moves through one path:
idle, saving, then **saved** or **couldn't save**. "Saved" and its toast
appear only after the server confirms — nothing is optimistic. A failed save
keeps everything that was typed and says why. Leaving a form with unsaved
changes asks first.

**Deletes refuse rather than break.** A photo used by a product or occasion,
an occasion used by a product, and a product that has been ordered cannot be
deleted — the message names what is using it and offers the alternative.

### 0.5 Security is unchanged

All admin reads and writes run as the signed-in user — **no `overrideAccess`
anywhere in the admin** (`backend/actions/admin.ts`). What a staff member may
see is decided by Payload's access rules, not by hiding links: the customer
list refuses staff, the product editor is read-only for them, and the
"Developer CMS" link is rendered for the owner alone.

Server actions return an English message **plus a dictionary code**, and the
admin translates it. The backend keeps no knowledge of languages or screens.

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

The admin is a custom application, so this is no longer Payload's `theme`
setting. `(admin)/admin.css` defines one set of **semantic** tokens with two
values each; components name a role, never a brand colour, so both themes are
correct by construction.

| Role | Light | Dark |
| --- | --- | --- |
| `page` | `#F7F4EB` warm cream | `#12140C` olive-black |
| `surface` / `raised` | `#FFFDF8` / `#FFFFFF` | `#1A1D13` / `#22261A` |
| `ink` / `ink-2` / `ink-3` | `#2B2F1B` / `#55583F` / `#66674B` | `#EDE7D5` / `#C9C4AE` / `#A19F86` |
| `line` / `line-strong` | `#E6E0CF` / `#CBC4A9` | `#2C3022` / `#434834` |
| `accent` (primary action) | burnt orange `#B55B29` | `#D27C47` |
| `success` / `warning` / `danger` | `#3F6337` / `#8A4A1C` / `#8C2F3C` | `#9CBF8C` / `#E3A86A` / `#EB8F9A` |
| Navigation | olive `#2B2F1B` | `#0E1009` |

**Dark is designed, not inverted.** Surfaces grow lighter as they come
forward, text is warm rather than white, and the accent is lifted so it keeps
its contrast on a dark ground.

Contrast was checked both ways at body size: the quietest text colour
(`ink-3`) is 4.9:1 on the light sunken surface and 6.3:1 on the dark one, and
accent, success, warning and danger all clear 4.5:1 on their surfaces. On the
dark navigation the focus ring switches to the navigation's own ink, because
the accent is under 3:1 there.

The choice persists in a cookie and follows the device on a first visit
(system). Switching repaints colours only — no layout shift.

## 6. English and Arabic

Two independent things, often confused:

### 6.1 Admin interface language

Built — and not through Payload. The admin carries its own dictionary.

- `src/admin/i18n/en.ts` is the source **and the schema**: `ar.ts` is typed
  against it, so a missing or misspelt key is a compile error, and the keys
  passed to `t()` are typed too.
- Plurals use CLDR categories. Arabic's six forms (zero, one, two, few, many,
  other) are all present and selected by `Intl.PluralRules`.
- Stored values — statuses, emirates, categories, event types — are
  translated through `labels`, so a florist never meets a database constant.
- Server action results carry a dictionary code, so "Changes saved" and every
  validation message appear in the reader's language.
- Money stays `AED 1,234.50`, and both languages use Western digits and
  Asia/Dubai dates.
- IBM Plex Sans Arabic is loaded for Arabic only (its `unicode-range` means an
  English session never downloads it). Cinzel and Cormorant have no Arabic
  glyphs, and letter-spacing breaks Arabic letter joins, so under `:lang(ar)`
  the brand faces fall back to Plex, untracked.

**Right-to-left is real, not Arabic text in a left-to-right layout.** Every
admin file uses logical properties only (enforced by
`src/admin/rtl-guard.test.ts`), directional icons mirror, the drawer opens
from the correct edge, and charts run right-to-left with the text.

> **Honest limitation.** The Arabic strings were written for clarity and
> consistency, not by a native speaker of the brand's voice, and they have not
> yet been verified in a browser. They should be reviewed before launch — the
> structure makes that a text edit in one file, with the type checker
> guaranteeing nothing is missed.

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
