# CALANTHE

Luxury flower atelier e-commerce — UAE. Mobile-first, motion-driven storefront.

## Stack

- **Next.js 15** (App Router, React 19, Turbopack) · **TypeScript strict**
- **Tailwind CSS v4** — brand tokens in `src/styles/tokens.css` (default palette removed; only brand colors exist)
- **Motion** (Framer Motion successor) + **GSAP** + **Lenis** smooth scroll
- **pnpm** · ESLint + Prettier

## Commands

```bash
pnpm dev          # dev server (Turbopack)
pnpm build        # production build
pnpm lint         # ESLint
pnpm format       # Prettier write
```

## Structure

```
src/
  app/
    (storefront)/     # customer-facing routes
    style-check/      # internal design QA page
  components/
    ui/               # buttons, logotype, primitives
    motion/           # reusable animation primitives (Reveal, ClipReveal, …)
    blocks/           # page sections
    commerce/         # product cards, cart, commerce UI
  lib/                # utilities (cn, …)
  styles/             # tokens.css — design tokens (@theme)
public/brand/         # exported brand assets (monogram, wordmark)
```

Design rules live in `CLAUDE.md` — mobile-first at 390px is law, brand tokens only,
Lighthouse mobile ≥ 90. Payload CMS will be added into this app later.
