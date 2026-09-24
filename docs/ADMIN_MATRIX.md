# Admin control matrix

> **Priority 2: the owner controls everything the storefront shows or does.**
> This is the scoreboard for that promise. One row per storefront feature,
> the admin screen that controls it, and how the status was established.

Status established **2026-09-25** by running `scripts/a0-audit.mts` against a
Neon dev branch (`a0-audit`), by the admin browser sweep
(`scripts/admin-qa.mjs`, 440/440 on 2026-09-21), and by reading the route
table. Nothing here is marked from memory.

- **Works** — exercised and passed.
- **Partial** — the screen exists but does not cover the whole feature.
- **Missing** — no admin screen; the storefront reads a constant in code, so
  changing it needs a developer and a deploy.

## Catalogue

| Storefront feature | Admin screen | Status | Evidence |
| --- | --- | --- | --- |
| Products (list, detail, gallery, availability, price) | `/admin/products` · `/new` · `/[id]/edit` | **Works** | admin sweep: create → save → publish → delete cycle passed |
| Product photography | `/admin/media` | **Works** | admin sweep: upload → alt text → delete passed |
| Occasions | `/admin/occasions` | **Works** | admin sweep; occasion names now translated by slug |
| Occasion **names in Arabic** | — | **Missing** | stored name is English only; `dictionary.ts` maps 5 known slugs, a 6th would show English |
| Shop filters (flower types, price bands, sort) | — | **Missing** | `lib/data.ts` `flowerTypes`, `priceBuckets` are constants |

## Selling

| Storefront feature | Admin screen | Status | Evidence |
| --- | --- | --- | --- |
| Cart | — (customer-side only) | **n/a** | nothing for an owner to control |
| Wishlist | — (customer-side only) | **n/a** | — |
| Checkout — cash on delivery | `/admin/orders` after the fact | **Partial** | A0: COD is the only method offered, order created `PENDING` |
| Checkout — card | — | **Missing** | no Stripe code exists (A5) |
| Checkout — Tabby | — | **Missing** | no Tabby code exists (C4) |
| Payment method on/off switch | — | **Missing** | COD is hardcoded in `CheckoutForm` |
| Orders (list, filter, detail, status) | `/admin/orders` · `/[orderNumber]` | **Works** | admin sweep |
| Refunds | — | **Missing** | no refund path anywhere (A5) |
| Invoices | — | **Missing** | no `invoices` collection, no numbering, no PDF (A6) |
| Delivery zones, fees, free-delivery threshold, cut-off, time windows | — | **Missing** | `lib/data.ts` constants; `globals/Settings.ts` written but **not registered** in `payload.config.ts` (A1/A7) |

## Enquiries and bespoke

| Storefront feature | Admin screen | Status | Evidence |
| --- | --- | --- | --- |
| Build Your Own submissions | `/admin/enquiries` | **Works** | submissions land as `BUILD_YOUR_OWN` enquiries |
| Build Your Own **options** (budgets, colours, vase price, minimum) | — | **Missing** | `lib/data.ts` constants — the vase price change on 2026-09-23 needed a code edit |
| Events enquiries | `/admin/events` | **Works** | admin sweep |
| Membership enquiries | `/admin/enquiries` | **Works** | type `MEMBERSHIP` |
| Membership tiers and prices | — | **Missing** | `Memberships` collection exists; no admin screen (`shell/nav.ts` lists it as not built) |

## People

| Storefront feature | Admin screen | Status | Evidence |
| --- | --- | --- | --- |
| Customer register / verify / sign in | — | **Works** (except email) | A0: 17/19 passed; account created, verified by token, signed in, `payload-token` HttpOnly + Secure + SameSite=Lax |
| Customer password reset | — | **Partial** | A0: reset token is issued; **the email cannot be delivered** |
| Customer list and detail | `/admin/customers` · `/[id]` | **Partial** | owner-only, works; no spend, order count, recency or CSV export (A4) |
| Staff accounts, roles, lockout recovery | `/admin/team` | **Works** | A0: owner sees the team; staff refused the customer list; account locks on the 5th wrong password |
| Guest order → customer record link | — | **Missing** | A4 |

## Content and site

| Storefront feature | Admin screen | Status | Evidence |
| --- | --- | --- | --- |
| Homepage sections, hero copy, service strip | — | **Missing** | components + `lib/i18n/dictionary.ts` |
| About / delivery / membership / events page copy | — | **Missing** | hardcoded in page components |
| SEO per page (title, description, OG image, noindex) | — | **Missing** | A9 |
| Business details, VAT, TRN, logo for invoices | — | **Missing** | A1 Settings |
| Owner + florist notification addresses | — | **Missing** | A1 Settings |
| Email templates and send log | — | **Missing** | A2 |

---

## Scoreboard

| | Count |
| --- | --- |
| Works | 10 |
| Partial | 4 |
| Missing | 17 |
| n/a | 2 |

**The headline:** the admin manages the *catalogue* well and the *business
rules* not at all. Every number that decides what a customer pays —
delivery fees, the free-delivery threshold, the same-day cut-off, the vase
price, budget steps, membership prices — is a constant in `lib/data.ts`.
Changing any of them today needs a developer, an edit and a deploy. A1 and
A7 close that.

## Confirmed defect

**Registration and password reset cannot deliver their emails.** Payload logs
`No email adapter provided` and writes the message to the console. A customer
can register and can never verify; a customer can request a reset and never
receives the link. Both reproduce in A0. Fixed by A2.
