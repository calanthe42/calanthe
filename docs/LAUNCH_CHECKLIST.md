# Launch checklist

The gate between "the build is finished" and "a stranger can spend money
here". Nothing on this list is optional, and nothing on it may be done
early — several items are deliberately the **last** thing that happens.

Merged from `BUILD_PLAN.md` v2 §Launch checklist. `OWNER_TODO.md` holds what
the owner must supply; this file holds what must be **true on the day**.

## Phases

- [ ] All **Track A** phases green, each with its report in `docs/reports/`
- [ ] All **Track C** phases green, each with its report

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
      `scripts/db-sequences.mts`, and note that the script carries a recorded
      restart for the order sequence: check the note still matches reality.

- [ ] Confirm `scripts/db-inventory.mts` against production shows **0 orders,
      0 enquiries**, and only the real accounts.
- [ ] Confirm the demo seed (`scripts/seed-demo-catalogue.mts`) has **never**
      run against production. It must not.
- [ ] Owner and staff accounts have strong passwords; every test account is
      gone.

## Catalogue

- [ ] Every product the shop intends to sell has real photography uploaded
      through `/admin` and `available: true`.
- [ ] Every product has a price, a description and an occasion.
- [ ] Alt text on every product image.
- [ ] `/shop` renders them at 390px.

## Money

- [ ] Stripe switched from test keys to **live** keys, in Vercel Production
      only.
- [ ] Live webhook endpoint registered against the live signing secret.
- [ ] **One real, small payment made and refunded**, end to end, before
      opening.
- [ ] **Tabby live** — if the merchant application was approved. If not,
      Tabby stays hidden rather than half-built.
- [ ] Settings hold the owner's **confirmed** delivery fees, free-delivery
      threshold, same-day cut-off and time windows — not the seeded
      assumptions.

## Email

- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set in Production.
- [ ] Resend DNS verified: SPF, DKIM **and DMARC** present on `calanthe.ae`.
- [ ] One of each template received and read on a real phone: verify address,
      password reset, order confirmation, order status, refund, enquiry
      received, owner new-order notification, florist job sheet.
- [ ] A recipient-facing gift email confirmed to carry **no price**, in both
      HTML and plain text (`EMAILS.md` §3).

## Legal

- [ ] Refund, terms and privacy pages **published**, and matching what the
      code actually does — card processing requires this.
- [ ] Business name, address, VAT/TRN and logo entered in Settings — an
      invoice is not a legal document without them.

## Infrastructure

- [ ] `SENTRY_DSN` and `UPSTASH_*` set in Production, and both proven live —
      an error appears in Sentry, a rate limit actually limits.
- [ ] **Sentry alerts actually reach the owner** — not just recorded in the
      dashboard.
- [ ] The GitHub repository is private.
- [ ] Neon backup restore rehearsed at least once (`RUNBOOK.md`).
- [ ] The old Ohio Neon project deleted **after** its 7-day hold, and only on
      the owner's explicit confirmation.

## Search

- [ ] `calanthe.vercel.app` → **301 redirect** to `calanthe.ae`; one canonical
      domain, www ↔ apex resolved.
- [ ] Sitemap submitted in Google Search Console.
- [ ] Lighthouse mobile ≥ 90 on `/`, `/shop` and a product page, measured on
      the Vercel preview, three consecutive green runs.
