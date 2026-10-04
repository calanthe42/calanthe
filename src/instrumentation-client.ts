/**
 * Sentry in the browser — loaded AFTER the page is interactive.
 *
 * WHY THIS FILE EXISTS. `instrumentation.ts` initialises Sentry on the server
 * and reports server render failures through `onRequestError`. Nothing ever
 * initialised it on the client, so every error a customer actually met — a
 * checkout that threw mid-submit, a cart that failed to hydrate — was
 * invisible.
 *
 * WHY IT IS DEFERRED. A static `import * as Sentry` put the whole browser SDK
 * (with tracing) into the shared chunk every page parses before hydrating —
 * about 64 KB gzip on every first visit (Lighthouse, 2026-10-04). Error
 * capture does not need to be ready in the first second, so the SDK is
 * imported when the browser is idle, and browser tracing is off: Lighthouse
 * and Vercel already measure timing.
 *
 * Next.js runs this file once, early, on the client.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  const start = () => {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,

        /* Errors only. No browser tracing: it costs bundle and main-thread
           time on every page and measures what Lighthouse already does. */
        tracesSampleRate: 0,
        integrations: (defaults) => defaults.filter((i) => i.name !== "BrowserTracing"),

        /* A customer's address and card details pass through this app. PII
           stays off and is turned on deliberately, per event, if ever needed. */
        sendDefaultPii: false,

        /* Session Replay is deliberately not enabled: it records the DOM,
           which on this site means the checkout form. */

        ignoreErrors: [
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
          "Non-Error promise rejection captured",
        ],
      });
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(start, { timeout: 4000 });
  } else {
    setTimeout(start, 3000);
  }
}
