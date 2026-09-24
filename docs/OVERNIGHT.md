# OVERNIGHT RUN

The owner's instructions for the unattended session of **2026-09-25**,
recorded verbatim in substance so they survive a context reset. If you are
reading this after a reset: read `BUILD_PLAN.md`, then this file, then
everything in `docs/reports/`, and continue from the last phase that has a
report.

> The owner is asleep. Do not end a turn to ask a question. Do not wait
> between phases. Keep going until the list is finished or everything left is
> blocked.

## Scope

Track A from `BUILD_PLAN.md`, in order:

**A1 → A2 → A3 → A4 → A5 → A6 → A7.** Stop after A7. A8 and A9 need the
owner's design and Arabic decisions and are explicitly out of scope tonight.

## Decisions already taken — do not re-open

**A1 — money model.** Every price constant in `lib/data.ts` moves to
Settings, seeded with today's values (vase = **150**, not 60). Settings are
passed *into* a pure `priceOrder()` rather than read inside it. Settings are
cached, and the cache is invalidated when an admin saves. Every order stores
a **snapshot** of the prices and rules used at that moment.

**Environment.** Enforce on `VERCEL_ENV === "production"`. A missing
Stripe / Tabby / Resend key turns that feature **off** — it must never crash
the app. `UPSTASH_*` and `SENTRY_DSN` are **required** in production. Keep
the degraded in-memory rate-limit fallback for a runtime Redis outage, and
send a Sentry alert when it triggers.

**Open product decisions** — take the plan's recommended defaults and record
them in `OWNER_TODO.md`:

- guest checkout **on**, creating a customer record
- cash on delivery **on**, behind a switch
- refunds **owner-only**
- Tabby min/max as **placeholders**

**A3 — secret scan.** Scan the **full git history**, not just staged files.
Anything found goes in `NIGHT_REPORT.md` for rotation. **Do not rewrite
history.**

## Rules

1. All work on branch **`build/track-a`**, cut from `main`. Commit after
   every green phase. This branch **may** be pushed (preview only).
   **Never push to `main`. Never deploy to production. Never change
   production data or production environment variables.**
2. Migrations run **only** on the `preview` branch of the Singapore Neon
   project. Never on `production`.
3. Definition of Done on every phase. **No test output = not done.**
4. Before starting each next phase, write `docs/reports/<phase>.md`.
5. Something needs the owner → leave a clearly marked placeholder, label it
   `UNTESTED — needs <X>`, add a row to `OWNER_TODO.md`, and keep going.
6. Blocked by a permission → **do not route around it.** Log it in
   `OWNER_TODO.md` and continue with work that does not depend on it.
7. A phase still red after real attempts → mark it **BLOCKED** in its report
   with the reason, and continue only with phases that do not depend on it.
8. **Never** delete data, drop tables, force-push, or touch the Ohio project.
9. No scope creep. No design changes beyond what a phase requires.

## Morning report — `docs/NIGHT_REPORT.md`, one page

- every phase: **GREEN / BLOCKED / UNTESTED**, plus one line saying why
- typecheck, lint, test and build results **on the final commit**
- what the owner must do, in order
- anything risky that was noticed and deliberately not fixed

Update `README.md` as well.

## Preconditions checked before starting

The run begins only after the owner pushes `main` and the live checks pass:
200 on `/`, `/shop`, `/admin/login`; `X-Vercel-Id` showing `sin1`; the media
file loading from blob; staff sign-in working on the live site; and an
Ohio-vs-Singapore diff showing no writes landed on Ohio before cutover.

**Anything red there: stop, report, do nothing else.**
