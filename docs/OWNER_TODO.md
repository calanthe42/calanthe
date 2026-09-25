# Owner to-do

Things only the owner can do. Everything here blocks something, so each row
says what it blocks. Nothing on this list can be worked around in code.

Keep this file current: when a phase hits something that needs a person, it
is added here and the phase carries on with a marked placeholder rather than
stopping.

## Now — before launch

| # | Action | Blocks | Added |
| --- | --- | --- | --- |
| 1 | **Confirm the GitHub repo `calanthe42/calanthe` is private.** If it is public, make it private. | Nothing yet, but the repo carries business logic, pricing rules and infrastructure notes | 2026-09-25 |
| 2 | **Create the Sentry project** and send the DSN. The DSN in `.env.local` is a placeholder (`audit-placeholder@o0.ingest.sentry.io`) and reports nowhere. | A1 — `SENTRY_DSN` becomes required in production; error tracking is off until then | 2026-09-25 |
| 3 | **Create the Upstash Redis database in `ap-southeast-1` (Singapore)** and send the REST URL + token. | A1 — rate limiting currently falls back to per-instance memory, which does not hold across serverless instances | 2026-09-25 |
| 4 | **Grant permission for `vercel deploy --prod`,** or run it yourself. The region cutover is complete and verified everywhere except the live site. | The live site is still on Ohio / `iad1` | 2026-09-25 |
| 5 | **Mark the real products available in `/admin`** and upload their photography. All ten are `available: false` with no uploaded images, so the live shop is empty. | The shop having anything to sell | 2026-09-25 |

## Credentials the build needs

| # | Credential | Blocks | Added |
| --- | --- | --- | --- |
| 6 | Stripe **test** publishable + secret + webhook secret | A5 — running a real card transaction. The code is written and unit-tested without them | 2026-09-25 |
| 7 | Resend API key + `EMAIL_FROM` | A2 — nothing can send. Registration and password reset are broken until this exists | 2026-09-25 |
| 8 | `calanthe.ae` DNS: SPF, DKIM, DMARC | A2 — deliverability. Without it, mail that does send lands in spam | 2026-09-25 |
| 9 | Tabby merchant public + secret | Track C — all of the Tabby work | 2026-09-25 |
| 10 | Apple Pay domain verification file | Apple Pay only | 2026-09-25 |

## Business facts — never guessed

These are entered in Settings. Until they are, Settings holds a clearly
marked placeholder and the storefront shows nothing that depends on them.

| # | Fact | Blocks | Added |
| --- | --- | --- | --- |
| 11 | Legal business name, address, VAT/TRN number, invoice logo | A6 — invoices are not legal documents without them | 2026-09-25 |
| 12 | Owner + florist notification email addresses | A2 — who gets told an order arrived | 2026-09-25 |
| 13 | Delivery zones, fees, free-delivery threshold, same-day cut-off, time windows | A7 — today these are constants in `lib/data.ts`; A1 moves them to Settings seeded with today's values, which are **assumptions, not confirmed rules** | 2026-09-25 |
| 14 | Refund policy — window, and who approves | A5/A6 — the code and the policy page must agree | 2026-09-25 |
| 15 | Tabby basket minimum and maximum | Track C — the eligibility rule is server-side | 2026-09-25 |

## Decisions taken as defaults

Applied so the build could continue. Each is reversible; confirm or correct.

| # | Decision | Default applied | Added |
| --- | --- | --- | --- |
| 16 | Guest checkout | **On**, and a customer record is created from the order | 2026-09-25 |
| 17 | Cash on delivery | **On**, behind an admin switch | 2026-09-25 |
| 18 | Refund approval | **Owner only** | 2026-09-25 |
| 19 | Tabby min/max | **Placeholders**, marked as such | 2026-09-25 |

## The same vase costs two different prices

**Found 2026-09-25 in the cart drawer, not by reading the code.**

| Where | Price |
| --- | --- |
| Cart / product page add-on ("Vase") — `addons` in `lib/data.ts` | **AED 60** |
| Build Your Own — `BYO_VASE_PRICE_AED` | **AED 150** |

When the Build Your Own vase went from 60 to 150 on 2026-09-23, the add-on
kept the old price. A customer who builds their own and then buys a ready
arrangement sees the same vase at less than half the price, which for a
luxury atelier reads as a mistake or as being overcharged.

**A price is yours, not mine — I have not changed it.** Tell me which is
right and I will make them agree. A1 moves both into Settings, where this
cannot drift again.

| # | Action | Blocks | Added |
| --- | --- | --- | --- |
| 21b | **Decide the vase price: AED 60 or AED 150?** | Nothing technically; it is live and inconsistent right now | 2026-09-25 |

## Delivery — how we compare, and what only you can decide

Added 2026-09-25 after looking at what UAE florists actually do
(Flowers.ae, FNP, Floward, Bliss). Each row is a business rule, so none of
it was guessed or built. Full workings in `docs/reports/ui-and-delivery.md`.

| # | Question | What we do now | What they do | Added |
| --- | --- | --- | --- | --- |
| 22 | **What happens when the recipient is not in?** Nothing in the shop says, and there is no field for it. This is the most common failure in gift delivery and we have no answer for it. | Nothing | Call the recipient → redirect or leave with someone they know → failing that, call the sender for another number or a new date | 2026-09-25 |
| 23 | **Redelivery fee?** | None defined | AED 30–45 Dubai/Sharjah, AED 45–65 elsewhere | 2026-09-25 |
| 24 | **Is the 17:00 same-day cutoff right?** It is much earlier than the market and costs the whole evening. | 17:00 | 22:00 (Flowers.ae), 23:00 for their 1-hour service | 2026-09-25 |
| 25 | **Is AED 350 the right free-delivery threshold?** | AED 350 | AED 275 | 2026-09-25 |
| 26 | **Do you want a paid express tier?** A luxury atelier can charge for certainty. | No | Exact-time +AED 50, 60-minute +AED 75 | 2026-09-25 |
| 27 | **Is 90 minutes the right lead time** between an order and a delivery window opening? I chose it so a composed-and-photographed arrangement is possible; it is now enforced. | 90 min (new) | Varies | 2026-09-25 |

## Deferred to A1/A7 — needs the migration, so not done tonight

| # | Item | Why it waits | Added |
| --- | --- | --- | --- |
| 28 | **Structured UAE address** — area/district, building or villa, and a landmark, instead of one free-text box. UAE addresses have no postcodes and couriers rely on landmarks; one textarea is where failed deliveries begin. | New order columns → belongs in A1's single migration | 2026-09-25 |
| 29 | **Delivery instructions** field, and a **recipient-unavailable choice** at checkout (once #22 is answered) | Same migration | 2026-09-25 |
| 30 | Delivery zones, fees, threshold, cutoff and windows read from Settings rather than `lib/data.ts` | A1 moves them; A7 builds the screen | 2026-09-25 |

## Design decisions you may want to overrule

| # | Decision | Added |
| --- | --- | --- |
| 31 | **Form labels are 10px** uppercase Cinzel across every form, including checkout. That is small for text a customer must read while entering a delivery address, and it is the one place the brand's label style meets a task that punishes misreading. I have **not** changed it — it is site-wide and yours to call. Raising it to 12px is a one-line change in `form-classes.ts`. | 2026-09-25 |
| 32 | **Footer and header nav links are 12–14px.** Same reasoning; left alone. | 2026-09-25 |

## Blocked by tooling or permissions

| # | Item | Added |
| --- | --- | --- |
| 20 | `vercel deploy --prod` refused by the local permission classifier — see #4 | 2026-09-25 |
| 21 | `gh` is not installed on the dev machine, so repo visibility cannot be checked from here — see #1 | 2026-09-25 |
