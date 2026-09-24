# Launch checklist

The gate between "the build is finished" and "a stranger can spend money
here". Nothing on this list is optional, and nothing on it may be done
early — several items are deliberately the **last** thing that happens.

`OWNER_TODO.md` holds what the owner must supply. This file holds what must
be **true on the day**.

## Before opening — clear the workshop

The database carries test data from building it. None of it may survive into
the shop's first real day.

- [ ] **Delete every test order.** Orders are normally undeletable by design
      (`DATABASE.md` §8 — an order is an accounting record). This is the one
      sanctioned exception, and it happens **before** a single real order
      exists, never after.
- [ ] **Delete every test enquiry.** As of 2026-09-25 there is exactly one:
      `CAL-E-000017`, submitted from `dev.calanthe@gmail.com` on 2026-09-19,
      quoting the old AED 60 vase price.
- [ ] **Delete every test account.** As of 2026-09-25: `staff@gmail.com`, and
      any `*@calanthe.invalid` fixture left by a suite. Keep the real owner
      account.
- [ ] **Reset both counters** so the first real records read `CAL-000001` and
      `CAL-E-000001`:

      ```sql
      select setval('calanthe_order_number_seq',   1, false);
      select setval('calanthe_enquiry_number_seq', 1, false);
      ```

      Safe **only** while both tables are empty — which is why this comes
      after the deletions above and before anything opens. A number series
      must never walk backwards over numbers already issued. Verify with
      `scripts/db-sequences.mts`.

- [ ] Confirm `scripts/db-inventory.mts` against production shows **0 orders,
      0 enquiries**, and only the real accounts.
- [ ] Confirm the demo seed (`scripts/seed-demo-catalogue.mts`) has **never**
      run against production. It must not.

## Catalogue

- [ ] Every product the shop intends to sell has real photography uploaded
      through `/admin` and `available: true`.
- [ ] Every product has a price, a description and an occasion.
- [ ] `/shop` renders them at 390px.

## Money

- [ ] Stripe switched from test keys to **live** keys, in Vercel Production
      only.
- [ ] Stripe webhook endpoint registered against the live signing secret, and
      a live event verified end to end.
- [ ] Tabby switched to live credentials, with the basket min/max confirmed by
      the owner.
- [ ] A real card charged and refunded once, for real, before opening.
- [ ] Settings hold the owner's **confirmed** delivery fees, free-delivery
      threshold, same-day cut-off and time windows — not the seeded
      assumptions.

## Email

- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set in Production.
- [ ] SPF, DKIM and DMARC present on `calanthe.ae` and verified.
- [ ] One of each template received and read on a real phone: verify address,
      password reset, order confirmation, order status, enquiry received.
- [ ] A recipient-facing email confirmed to carry **no price** (`EMAILS.md` §3).

## Legal

- [ ] Business name, address, VAT/TRN and logo entered in Settings — an
      invoice is not a legal document without them.
- [ ] Terms, refund and privacy pages match what the code actually does.

## Infrastructure

- [ ] `SENTRY_DSN` and `UPSTASH_*` set in Production, and both proven live —
      an error appears in Sentry, a rate limit actually limits.
- [ ] The GitHub repository is private.
- [ ] The old Neon project has passed its 7-day retention and been reviewed
      before deletion.
- [ ] Lighthouse mobile ≥ 90 on `/`, `/shop` and a product page, measured on
      the Vercel preview, three consecutive green runs.
- [ ] A restore from backup rehearsed at least once (`RUNBOOK.md`).
