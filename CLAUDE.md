# CALANTHE — Project Rules

MOBILE FIRST IS LAW: customers are phone users. Design every component
at 390px first, then adapt up. 100svh not 100vh. Safe-area insets on
sticky bars. Tap targets ≥44px. Primary CTAs in thumb zone. Mobile
product rows: horizontal scroll, 12% next-card peek, scroll-snap.
Body text ≥16px. A task is done only when verified at 390px.

DESIGN TOKENS (colors, exact, nothing else allowed): Deep Olive
#2B2F1B primary text + primary dark surfaces; Muted Sage #868764
muted text/borders/icons; Burgundy #2E131B intimate sections only;
Burnt Orange #B55B29 accent/CTA only — never large fills, never
behind body text; Warm Cream #E4DCC5 cards/surfaces; page background
#F3EFDF; hairlines #CBC4A9. Allowed pairings ONLY: cream+olive,
olive+cream, burgundy+cream.

TYPE: Cinzel = wordmark/nav/eyebrows/buttons, always uppercase,
tracking 0.18em. Cormorant Garamond = editorial headlines. Instrument
Sans = body/UI/prices. Currency AED. Corners 2–4px, luxury = almost
square. Film grain 3.5% on body.

MOTION: everything blooms, nothing bounces. Only transform/opacity/
clip-path/filter. Easing cubic-bezier(0.22,1,0.36,1). Micro 150–250ms,
reveals 600–900ms, scroll scenes scrub-linked. Reveals once at 80%
viewport. Max ONE pinned scene per page. prefers-reduced-motion →
simple fades. Never animate LCP opacity from 0. Primitives live in
components/motion and are always reused.

ENGINEERING: TypeScript strict, no any. Server Components by default,
"use client" only where needed. Conventional commits per feature.
Lighthouse mobile ≥90 is law — a flourish that costs performance dies.
Zod-validate anything dynamic later. Payload CMS will be added into
this same app later — keep structure standard. When unsure: do less,
softer, slower.
