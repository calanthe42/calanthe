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
