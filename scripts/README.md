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
