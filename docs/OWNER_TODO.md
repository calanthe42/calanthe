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

## Blocked by tooling or permissions

| # | Item | Added |
| --- | --- | --- |
| 20 | `vercel deploy --prod` refused by the local permission classifier — see #4 | 2026-09-25 |
| 21 | `gh` is not installed on the dev machine, so repo visibility cannot be checked from here — see #1 | 2026-09-25 |
