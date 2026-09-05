# CALANTHE — Motion Specification

Everything blooms, nothing bounces. Motion exists to make the customer feel
that flowers are being composed in front of them — never to show off.

## Laws

- **Properties**: animate ONLY `transform`, `opacity`, `clip-path`, `filter`.
  Never layout properties (width/height/top/margin) — they cause jank and CLS.
- **Easing**: `cubic-bezier(0.22, 1, 0.36, 1)` (token: `--ease-bloom`) for
  everything. No spring/bounce easings, no overshoot.
- **Durations**: micro-interactions 150–250ms · reveals 600–900ms ·
  scroll scenes are scrub-linked (no duration — progress follows the thumb).
- **Trigger**: reveals fire once, when the element crosses 80% of viewport
  height. Never re-fire on re-scroll.
- **Pinning**: max ONE pinned scrub scene per page. On mobile keep pins
  short (~1.2 viewports); if a pin feels broken at 390px, unpin and use
  sequential reveals instead.
- **LCP**: never animate the LCP element's opacity from 0. Entrance for the
  hero headline is transform-only (mask/translate), text visible immediately.
- **Reduced motion**: `prefers-reduced-motion: reduce` collapses every
  primitive to a simple opacity fade (or nothing). Lenis smoothing disabled.
- **Reuse**: all motion lives in `src/components/motion/` primitives.
  Sections never hand-roll animation.

## Primitives (`src/components/motion/`)

| Primitive       | Job                                                        | Recipe |
| --------------- | ---------------------------------------------------------- | ------ |
| `Reveal`        | Default entrance for any block of content                  | opacity 0→1 + translateY 24px→0, 700ms |
| `ClipReveal`    | Image uncover — feels like tissue paper lifting            | `clip-path: inset(100% 0 0 0)`→`inset(0)` + scale 1.1→1 settle, 900ms |
| `Stagger`       | Groups (cards, nav links, columns)                         | children Reveal with 80ms delay steps |
| `SplitLines`    | Editorial headlines                                        | per-line mask: lines translateY 100%→0 inside `overflow:hidden` wrappers, 80ms stagger |
| `Parallax`      | Scroll-linked drift for imagery                            | GSAP ScrollTrigger scrub, y offset by speed factor (0.85–1.15) |
| `MonogramBloom` | The brand mark blossoming — section dividers, footer, menu | SVG stroke draw-on per quarter (stroke-dashoffset), then fill fade 0→1 |

## Choreography notes

- One idea at a time: a section reveals EITHER its image OR its type first,
  never both fighting. Image (ClipReveal) → eyebrow → headline (SplitLines)
  → body → CTA is the canonical order.
- Hover states are micro (150–250ms): letterspacing widen, overlay deepen,
  crossfade. Nothing moves more than a few px on hover.
- No scroll cues, down arrows, or "scroll down" affordances anywhere —
  the content itself is the invitation.
- Ken-burns settle on hero's photography glimpse: scale 1.08→1 over 6s,
  once, transform-only.
- Hero opening beat (2026-09 redesign, cinematic pass): full-viewport
  photography is the whole background (`.hero-kenburns` settle, same
  `.floral-grade` color-grade as the rest of the site — no card
  treatment, no inset frame). A single radial scrim concentrates
  darkening at bottom-left where the words sit and fades to nothing
  toward the rest of the frame, so the photograph keeps its own
  colour. The logo lockup (`MonogramBloom` + `Logotype`) and locked
  words sit in that bottom-left pocket. Sequence: monogram blooms
  (built-in timing) -> small ribbon detail settles in beside the
  lockup (`.hero-ribbon`, a compact material accent, not a
  page-spanning line, 1.1s, translateX+scale->none) -> headline
  SplitLines (immediate mode, delay 0.4s) -> CTAs (`Reveal`, delay
  0.7s). One idea at a time, per the law above. No background
  monogram watermark in this pass — the header's own centred
  `Logotype` (see `Header.tsx`, `OVERLAY_ROUTES`) is the only other
  brand mark on screen, and the dark scrim means its existing
  cream-on-dark treatment already reads correctly with no changes.
- Marquees are CSS-only (`translateX` keyframes), pause on hover.

## Smooth scroll

Lenis provider wraps the app in root layout. Respect
`prefers-reduced-motion` → native scrolling. GSAP ScrollTrigger is driven
from Lenis' `scroll` event via `ScrollTrigger.update`.
