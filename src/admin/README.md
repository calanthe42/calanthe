# `src/admin/` — Calanthe's internal management UI

The presentation layer of the Payload admin: the custom dashboard, the
order screen, the AED input, the light/dark Calanthe theme.

Import with `@admin/*`.

## May import

- `@backend/*`
- `@shared/*`
- `@payloadcms/ui`

## May NOT import

- **`@frontend/*`**

The storefront's design system serves customers; the admin has its own
visual language inside Payload's shell. Sharing components would couple
a redesign of one to the other. Brand tokens are shared as **CSS custom
properties**, not as React components.

## Schema vs presentation — the seam

A collection's **fields and access rules are backend**
(`@backend/payload/collections/`). How that collection **looks** — a
custom view, a custom field widget — is **admin**.

Payload connects them by path through its generated `importMap`:

```
src/app/(payload)/**       the mount point   (framework, generated)
      ↓ imports @payload-config
src/backend/payload/**     the definition    (ours)
      ↓ admin.components reference by path
src/admin/**               the appearance    (ours)
```

Payload is **not** a separate application. It is route handlers plus a
React admin mounted inside this Next.js app, sharing its build and its
deployment.

## Planned layout

```
views/       Dashboard (custom root view), OrderScreen
fields/      AedInput, StatusButtons, GiftBanner
components/  shared admin pieces
styles/
  admin.css  Calanthe palette mapped onto Payload's CSS variables,
             light and dark
```

Admin views are Server Components querying through `@backend/data/*`,
so there is no extra endpoint to secure.

**Empty until B1.5.** The folder exists now so the boundary is visible
from the first day of the migration rather than retrofitted later.

See [docs/PROJECT-STRUCTURE.md §6, §8](../../docs/PROJECT-STRUCTURE.md)
and [docs/ADMIN.md](../../docs/ADMIN.md).
