# PROJECT-BRAIN — CALANTHE

Living state document. Update at the end of every working pass.

## Current state (2026-08-28)

- Full storefront UI live on Vercel staging: https://calanthe.vercel.app
- Stack: Next.js 15.5 App Router · TS strict · Tailwind v4 (brand-locked
  tokens) · GSAP + Lenis (idle-mounted) · CSS/IntersectionObserver reveal
  engine (`MotionObserver` + `io-*` classes) · framer-motion only in
  page-specific/lazy chunks.
- All commerce flows are UI with mock data (`src/lib/data.ts`) — backend
  phase replaces: catalog, payment (Tabby badge is visual), OTP auth,
  orders, BYO submission, memberships.

## IMAGERY — curated placeholders, NOT client photography

Every photograph on the site is a **curated Unsplash placeholder**, chosen
to match the brand palette (warm, muted, petal-toned). They are wired
through ONE slot: `ProductImage.src` in `src/lib/data.ts` (the `PHOTOS`
map) rendered by `src/components/ui/FloralImage.tsx`, with the generated
botanical art as automatic fallback when `src` is absent.

**To swap in the client's real photography:** replace the URLs in the
`PHOTOS` map / per-product `src` values (or point them at the CMS media
library). No component changes are needed. The hero also accepts a
`media` prop for a fully custom node.

Unsplash terms permit this use; still, replace before public launch —
these images are mood-matched stand-ins, not the client's arrangements.

## Locked decisions

- Homepage section order + copy: client-approved (brand/client-vision.md).
  Approved additions (refinement pass B): trust band + video-approval
  section between locked sections.
- Design law: CLAUDE.md + .claude/skills/calanthe-design + brand/motion-spec.md.
- Competitor workflow reference: brand/competitor-ux.md (flowers.ae study).

## Awaiting client

- Real photography (see IMAGERY above).
- Exact BYO copy: budget note, 8 colour options, 8 occasions, seasonal
  disclaimer (flagged in data.ts).
- Trust numbers: review count/rating, press logos — all placeholders.
- Pricing calls: same-day cutoff hour (currently 17:00), premium
  exact-hour delivery slot (not built — TODO), delivery fees per emirate.
- Legal copy: T&C, privacy, refund pages.

## Known debt

- Lighthouse mobile perf 61–84 (target ≥90) — separate perf pass planned;
  levers identified: font-swap LCP repaint, hydration TBT.
- Cream-on-burnt-orange CTA fails WCAG AA contrast for small text
  (locked brand colors — client tradeoff to acknowledge).
