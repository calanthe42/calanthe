---
name: calanthe-design
description: "Use for ANY visual work in this project: UI components, pages, sections, styling, Tailwind classes, animations, motion, hover states, layout, typography, spacing, colors, loading/empty states, or reviewing existing UI. Always load before writing or changing anything the user will see."
---

# CALANTHE Design Intelligence

## a) IDENTITY

Luxury flower atelier, UAE. Quiet luxury. Everything blooms, nothing
bounces. If it could be any online store, it is wrong.

The customer's emotional journey down every page: **Hope → Confidence →
Delight → Trust**. Design decisions serve that arc — editorial, intimate,
composed. Photography is soft-focus botanicals, warm muted tones, dark
green fabric, embossed paper. Never bright, never stocky.

Logo lockups: **Logotype** (Cinzel text) = header · **Monogram** = small
uses and seals · **Stacked** = formal contexts and footer.

## b) HARD RULES

Colors — these seven and nothing else (enforced: Tailwind default palette
is removed in tokens.css):

| Token | Hex | Role |
| --- | --- | --- |
| `olive` | #2B2F1B | primary text, primary dark surfaces |
| `sage` | #868764 | muted text, borders, icons |
| `burgundy` | #2E131B | intimate sections ONLY |
| `burnt-orange` | #B55B29 | accent + CTA ONLY — never large fills, never behind body text |
| `cream` | #E4DCC5 | cards, surfaces |
| `canvas` | #F3EFDF | page background |
| `hairline` | #CBC4A9 | hairlines, dividers |

Allowed pairings ONLY: cream+olive · olive+cream · burgundy+cream.

Type roles:
- **Cinzel** (`font-brand`) — wordmark, nav, eyebrows, buttons. ALWAYS
  uppercase + `tracking-brand` (0.18em).
- **Cormorant Garamond** (`font-display`) — editorial headlines only.
- **Instrument Sans** (`font-sans`) — body, UI, prices. Body ≥16px.

Surfaces: corners 2–4px (`rounded-sm`/`rounded-md`) — luxury is almost
square. Hairlines are 1px `hairline`. Film grain 3.5% overlays everything
(body::after — do not re-add per section). Currency is AED, always.

Mobile first is law: design at 390px FIRST, adapt up. `100svh` not
`100vh`. Safe-area insets on sticky bars. Tap targets ≥44px. Primary CTAs
in the thumb zone (bottom third). Product rows on mobile: horizontal
scroll, 12% next-card peek, scroll-snap. Nothing is done until verified
at 390px.

## c) MOTION GRAMMAR

Primitives in `src/components/motion/` — always reuse, never hand-roll:

| Primitive | Use for |
| --- | --- |
| `Reveal` | default entrance (fade + rise 24px) |
| `ClipReveal` | image uncover (clip-path inset from bottom, 1.1→1 settle) |
| `Stagger` | card grids, nav links, columns (80ms steps) |
| `SplitLines` | editorial headlines (lines mask upward) |
| `Parallax` | scroll-linked image drift (GSAP scrub, 0.85–1.15) |
| `MonogramBloom` | brand mark draw-on — dividers, footer, menu |

Laws:
- Animate ONLY transform / opacity / clip-path / filter.
- Easing `cubic-bezier(0.22,1,0.36,1)` everywhere. No bounce, no overshoot.
- Micro 150–250ms · reveals 600–900ms · scroll scenes scrub-linked.
- Reveals fire ONCE at 80% viewport.
- Max ONE pinned scene per page; short pins (~1.2 viewports) on mobile —
  unpin if it feels broken at 390px.
- Never animate the LCP element's opacity from 0 — transform-only entrance.
- `prefers-reduced-motion` → simple fades, Lenis smoothing off.
- One idea at a time: image → eyebrow → headline → body → CTA.

## d) TASTE TESTS — run before calling any UI task done

- Could this section appear in a template marketplace? → redo it
  editorial/asymmetric.
- Are two animations competing at once? → delete one.
- Does it feel like blooming — or like loading?
- Verified at 390px, usable with one thumb?
- Only brand colors present? Cinzel uppercase + tracked? Corners ≤4px?

## e) REFERENCES

- `brand/motion-spec.md` — full choreography, primitive recipes, laws.
- `brand/client-vision.md` — client-approved homepage flow + copy (locked).
- `src/styles/tokens.css` — the design tokens themselves.
- `CLAUDE.md` — project rules (mobile-first law, engineering standards).
