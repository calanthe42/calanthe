# `src/frontend/` — customer-facing UI

Everything the customer sees. React components, client providers, hooks,
the design system, storefront styles.

Import with `@frontend/*`.

## May import

- `@shared/*`
- other `@frontend/*`
- React, Next.js, GSAP, Lenis

## May NOT import

- **`@backend/*` — zero exceptions**
- `@admin/*`
- `payload`, any database client
- `process.env`

## How data gets here

As **props**. Nothing in this folder queries anything.

A page in `src/app/(frontend)/` is a Server Component: it calls
`@backend/data/*`, then passes plain objects down.

```tsx
// src/app/(frontend)/(storefront)/shop/page.tsx   ← routing layer
const products = await getActiveProducts();   // @backend — server
return <ShopGrid products={products} />;      // @frontend — pure UI
```

This is the rule that keeps the boundary honest: the only files touching
both sides are route files, and they are few and short.

## Planned layout

```
components/
  ui/         design system      Button, Eyebrow, StackedLogo
  blocks/     page sections      Hero, ShopByOccasion, Footer
  commerce/   shop UI            ProductCard, CheckoutForm, CartDrawer
  motion/     animation          Reveal, Parallax, HeroLogoDock
hooks/        useScrollLock, useReducedMotionPref
providers/    cart, wishlist, locale, toast, lenis  (client-only)
styles/       tokens.css
```

`"use client"` goes as deep as possible — a page stays a Server
Component and only the interactive leaf opts in.

See [docs/PROJECT-STRUCTURE.md §4](../../docs/PROJECT-STRUCTURE.md).
