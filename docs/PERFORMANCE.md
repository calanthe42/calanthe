# Performance baseline

Captured **2026-09-25**, before any optimisation work, so A8 has numbers to
improve on rather than impressions.

## How these were taken

```
npx next build ; npx next start -p 3000        # production build
npx lighthouse http://localhost:3000<path> \
  --only-categories=performance,seo,accessibility,best-practices \
  --form-factor=mobile --screenEmulation.mobile \
  --throttling-method=simulate --quiet \
  --chrome-flags="--headless=new --no-sandbox"
```

Lighthouse 13.5.0, mobile emulation, simulated throttling, against the
production build on `localhost`, with the database on a Neon branch in
`us-east-2`.

**Read these as a floor, not as the customer's experience.** Two things
distort them in opposite directions: localhost removes real network latency,
while every server render here crosses the Atlantic to Neon and pays a DNS
timeout on an unreachable Upstash host (measured at ~4.5 s on a throttled
request). Vercel with a co-located database and a working Redis will differ.
The A8 gate is a re-measure **on the Vercel preview**, not here.

## Baseline — mobile

| Page | Performance | LCP | CLS | TBT | Accessibility | SEO | Best practices |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home `/` | **39** | 7.9 s | 0.123 | 970 ms | 96 | 100 | 100 |
| Shop `/shop` | **61** | 5.9 s | 0.002 | 420 ms | 95 | 100 | 100 |
| Product `/product/amber-hour` | **62** | 5.5 s | 0.002 | 420 ms | 96 | 92 | 100 |
| Checkout `/checkout` | **68** | 4.3 s | 0.006 | 430 ms | 94 | **63** | 100 |

## Targets (A8) and the gap

| Metric | Target | Worst today | Gap |
| --- | --- | --- | --- |
| LCP | < 2.5 s | 7.9 s (home) | **3.2× over** |
| CLS | < 0.1 | 0.123 (home) | over |
| INP | < 200 ms | not measured by Lighthouse; TBT 970 ms (home) suggests a problem | to measure |

## What the numbers already point at

1. **Home is the worst page on every axis.** LCP 7.9 s, TBT 970 ms and the
   only CLS failure. It is also the page carrying the hero media, the
   travelling mark, Lenis, GSAP and the seal's loop.
2. **CLS 0.123 on home only.** Something reserves no space. The hero and the
   travelling brand mark are the first suspects — the mark is positioned from
   a measured box.
3. **TBT 420–970 ms everywhere** points at JavaScript on the main thread, not
   at images.
4. **Checkout SEO 63** is expected and correct — checkout should be
   `noindex`. Confirm that is deliberate in A9 rather than assuming.
5. **Product SEO 92** is worth one look in A9.

## A8 item — Neon scale-to-zero, the cold visitor

Neon suspends an idle compute. The setting is `suspend_timeout_seconds: 0`,
which is **not** "never suspend" — it means "use the default", and the
default suspends after a few minutes of inactivity. Waking it takes a
noticeable fraction of a second, sometimes longer on a cold branch.

**Who pays for it: the first visitor after a quiet spell.** For a flower
atelier that is precisely the wrong person — a shop that is busy all day
never notices this, and a shop with gaps between customers serves its slowest
page to someone arriving fresh. It does not appear in any Lighthouse run
here, because a benchmark loop keeps the database permanently warm. Every
number in the table above was measured against an already-awake compute.

Not measured yet. A8 must:

1. **Measure it honestly** — let the branch idle past the suspend window,
   then time the first request. That figure, not the warm one, is the real
   worst-case TTFB.
2. Decide between the two fixes: raise the suspend timeout (costs money for
   idle compute) or keep the connection warm with a scheduled ping (costs
   almost nothing, but only papers over it and stops working if the cron
   does). Prefer the honest setting over the ping unless the cost is real.
3. Re-check after the region move — Singapore compute is closer, so the wake
   penalty and the round trip no longer compound the way they did from Ohio.

Related and deliberately not conflated: `iad1` → `sin1` fixes *network*
latency, which is a different problem from a suspended database. Fixing one
does not fix the other.

## Rules going forward

- Re-measure after every phase that touches the storefront, and record it
  here with the date — never overwrite a row, add one.
- A8's gate is three consecutive green runs on the Vercel preview, not a
  single good local number.
