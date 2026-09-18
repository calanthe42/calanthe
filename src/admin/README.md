# `src/admin/` — the Calanthe admin

The business's own application at **`/admin`**. Payload's panel at `/cms` is
developer infrastructure; nothing a florist does day to day goes through it.

Import with `@admin/*`.

## May import

- `@backend/*` — data, server actions, pure domain logic
- `@shared/*`
- `@/lib/*` — `cn`, `money`

## May NOT import

- **`@frontend/*`** — the storefront's design system serves customers; the
  admin has its own visual language. Sharing components would couple a
  redesign of one to the other. Brand tokens are shared as **CSS custom
  properties**, not as React components.
- **Nothing in `@backend/*` may import `@admin/*`.** The backend stays free of
  any knowledge of languages or screens: server actions return an English
  `message` plus a dictionary `code`, and the admin translates it.

## Layout

```
i18n/          en.ts · ar.ts · translate.ts · server.ts · client.tsx
               The English dictionary is the schema: Arabic is typed against
               it, so a missing key is a compile error. `t()` keys are typed.
lib/           status.ts — which tone a stored status is shown in
preferences.ts Language and theme cookies (pure; unit tested)
shell/         nav.ts · AdminNav.tsx (sidebar + drawer) · Preferences.tsx
ui/            The design system. One file per primitive.
components/    Screen-specific pieces: ProductForm, OccasionForm, MediaManager,
               MediaPicker, OrderOps, WorkflowForm, Charts, ComingSoon
rtl-guard.test.ts  Fails the build if a left/right-specific class appears
```

## Rules that keep it consistent

**One design system.** Screens import primitives from `@admin/ui/*` and never
restyle them inline. If a screen needs something new, it goes in `ui/` — not a
second version of a button in a page file.

**Server by default.** Display primitives are Server Components with no client
JavaScript. Only interaction is a client island: dialogs, the row menu, tabs,
toasts, forms. `PageHeader`, `FilterBar`, `Pagination` and `ComingSoon` read the
translator on the server themselves, so they must never be imported from a
Client Component.

**Start and end, never left and right.** Only logical utilities
(`ms/me`, `ps/pe`, `start/end`, `text-start/end`, `border-s/e`, `rounded-s/e`)
and `gap-*`. Arabic mirrors the whole layout; a single `ml-4` breaks a screen
in Arabic while looking perfect in English. `rtl-guard.test.ts` enforces this.

**Semantic colour only.** Components name a role — `page`, `surface`, `ink`,
`line`, `accent`, `danger` — never a brand colour. Light and dark are two sets
of the same tokens in `(admin)/admin.css`, chosen on the server from a cookie
and stamped on `<html>`, so the first paint is already right.

**One save cycle.** Every mutation goes through `ActionForm` or `ActionButton`
→ `useAction`: idle → saving → saved | failed, with the toast and the "saved"
state only after the server confirms. Nothing is optimistic.

**Deletes ask first**, and destructive server actions refuse rather than
orphan: a photo in use, an occasion in use, a product that has been ordered.

**Access is the backend's job.** Every read and write runs as the signed-in
user — no `overrideAccess` anywhere in the admin. What a staff member cannot
see is decided by Payload's access rules, not by hiding a link.

See [docs/ADMIN.md](../../docs/ADMIN.md) and
[docs/PROJECT-STRUCTURE.md](../../docs/PROJECT-STRUCTURE.md).
