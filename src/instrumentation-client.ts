/**
 * Sentry in the browser.
 *
 * WHY THIS FILE EXISTS. `instrumentation.ts` initialises Sentry on the server
 * and reports server render failures through `onRequestError`. Nothing ever
 * initialised it on the client, so every error a customer actually met — a
 * checkout that threw mid-submit, a cart that failed to hydrate, a broken
 * image handler — was invisible. The server was the only half being watched,
 * and it is not the half where a sale is lost.
 *
 * Next.js runs this file once, early, on the client.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    /* Matches the server's sampling. Traces are for timing, and paying to
       trace every page view of a flower shop buys nothing the Lighthouse
       work in A8 does not already measure. */
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,

    /* A customer's address and card details pass through this app. Sentry
       must never be the reason a delivery address ends up in a third-party
       dashboard, so PII stays off and is turned on deliberately, per event,
       if it is ever needed. */
    sendDefaultPii: false,

    /* Session Replay is deliberately not enabled. It records the DOM, which
       on this site means the checkout form: names, phone numbers, addresses
       and card fields. Turning it on is a privacy decision for the owner,
       not a default. */

    ignoreErrors: [
      /* Browser extensions and cross-origin scripts we do not control, and
         cannot fix, reported as our own failures. */
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
    ],
  });
}

/* Required by Next for navigation instrumentation; harmless when Sentry is
   not configured, because `captureRouterTransitionStart` is a no-op then. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
