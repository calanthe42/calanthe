/**
 * Runs once at server boot (Next.js instrumentation hook).
 * 1. Validates the environment — the app refuses to start with a
 *    missing/invalid configuration (fail fast, fail closed).
 * 2. Initializes Sentry on the server when a DSN is configured.
 */
export async function register() {
  const { env } = await import("@/lib/env");

  if (env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 0,
      /* Never send PII payloads by default. */
      sendDefaultPii: false,
    });
  }
}

export async function onRequestError(
  ...args: Parameters<(typeof import("@sentry/nextjs"))["captureRequestError"]>
) {
  const { env } = await import("@/lib/env");
  if (env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }
}
