# scripts/

Developer utilities. Not part of the application build, not imported by
any application code, and not shipped to production.

## `visual-qa.mjs`

Multi-device visual regression sweep of the storefront using Playwright.
Drives Chromium and WebKit across six viewports (1440, 1280, 768, 414,
iPhone 13, iPhone SE) and reports the problems that are invisible in a
single-browser check:

- horizontal overflow, with the offending elements named
- tap targets under 40 px on small screens
- the hero logo's alignment against the nav row once docked
- console errors and failed network requests

Screenshots are written for every viewport in three scroll states
(hero, docked, footer).

```bash
pnpm dev                                    # in another terminal
node scripts/visual-qa.mjs <out-dir> http://localhost:3000
```

`<out-dir>` must exist. Use a scratch directory, never a path inside the
repository — the screenshots are throwaway.

Exit is always 0; read the `ISSUES` block it prints at the end.

## `dev-clean.sh`

Restarts the Next dev server safely on a Windows machine. Two problems it
exists to avoid, both of which cost real debugging time:

1. **`.next` must be deleted while no node process is running.** Removing it
   under a live server leaves Next rebuilding into a half-deleted directory,
   and every route then 500s with
   `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'` — an error
   that looks like a broken dependency and is not.
2. **Postgres must be reached over IPv4.** This machine has no IPv6 route,
   but DNS returns AAAA records for the Neon endpoint, so node's
   happy-eyeballs picks a dead address and every page fails with
   `cannot connect to Postgres` / `ENETUNREACH`. The script forces IPv4.

```bash
bash scripts/dev-clean.sh /path/to/dev.log
```

Waits for `/` to return 200 and prints how long it took, or `NOT READY`
with the last status code.

## `register-aliases.mjs` + `alias-hooks.mjs`

Module-resolution hooks that teach plain Node the project's path aliases
(`@/`, `@backend/`, `@admin/`, `@frontend/`, `@shared/`, `@payload-config`)
and fill in the extensions TypeScript lets application code omit.

Node 22+ strips TypeScript types on its own, so these hooks are the only
thing standing between plain `node` and the `.mts` suites below — which
import application code, which imports aliases. Without them every suite
dies with `ERR_MODULE_NOT_FOUND` before its first assertion. The
alternative was a `tsx` dependency for the sole purpose of resolving six
prefixes.

The alias list must stay in step with `paths` in `tsconfig.json` and
`resolve.alias` in `vitest.config.ts`.

```bash
node --env-file=.env.local --import ./scripts/register-aliases.mjs scripts/<suite>.mts
```

## `team-permission-test.mts`

Access-control suite for staff administration (`/admin/team`). Creates
owner / staff / customer fixtures, exercises the rules over HTTP and over
the Local API with `overrideAccess: false` — the same path the server
actions take — then removes every fixture and asserts none remain.

Covers: an invited staff account can actually sign in with its issued
password; staff cannot create, read, unlock, suspend or delete another
account; neither staff nor a customer can promote themselves; a suspended
account cannot authenticate; and the last-admin guard does not
false-positive while another usable admin exists.

```bash
node --env-file=.env.local --import ./scripts/register-aliases.mjs \
     scripts/team-permission-test.mts
```

Exit 0 only if every check passed AND the database was left clean.

## `team-flow-test.mts`

The same screen, driven in a real browser: invite → the one-time password
→ sign in with it → lock the account → lift the lock → issue a new
password → suspend → restore → remove. Every claim is checked against the
database or against a real HTTP login, never against the text of a button.
Also measures the screen in Arabic (right-to-left) at 320/390/414/768/1440
and asserts no sideways overflow, no untranslated keys and no console
errors.

```bash
node --env-file=.env.local --import ./scripts/register-aliases.mjs \
     scripts/team-flow-test.mts [base-url]
```

**Serve on the port `NEXT_PUBLIC_SERVER_URL` names** (3000 by default).
`payload.config.ts` sets `csrf: [NEXT_PUBLIC_SERVER_URL]`, and Payload
refuses a cookie-borne token whose request `Origin` is outside that list.
A browser sends `Origin` on every POST, and a server action is a POST — so
on the wrong port every action returns "Only the owner can manage staff
accounts", which looks exactly like a permissions bug and is not one. That
cost an hour once; it is written down so it cannot cost another.
