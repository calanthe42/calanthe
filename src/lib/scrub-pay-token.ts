/**
 * Keeping payment-link tokens out of error reports.
 *
 * The address of a payment link — /pay/<token> — IS the credential: whoever
 * holds it can pay that order or read its invoice. Sentry records the request
 * URL, the transaction name and a trail of navigations, and every one of
 * those would carry the token off to a third party and into a dashboard
 * several people can read.
 *
 * So everything Sentry is about to send goes through `scrubPayTokens` first:
 * any "/pay/<something token-shaped>" in any string, at any depth, becomes
 * "/pay/[token]". It is deliberately broad — it walks the whole event rather
 * than naming fields — because the next SDK version will add a field nobody
 * here has heard of, and a list of known fields would miss it.
 *
 * Pure, no imports: used by both the server and the browser SDK setup.
 *
 * (Vercel's own access logs still record the path. That is accepted and
 * written down in docs/PAYMENTS.md; those logs are the host's, not a third
 * party's.)
 */

/* Real tokens are 43 base64url characters. Sixteen or more is scrubbed, so a
   truncated or mistyped token is caught as well; short words are left alone. */
const PAY_PATH = /\/pay\/[A-Za-z0-9_-]{16,}/g;
const MAX_DEPTH = 8;

/** One string, with any payment-link token replaced. */
export function scrubPayPath(text: string): string {
  return text.replace(PAY_PATH, "/pay/[token]");
}

function walk(value: unknown, depth: number): unknown {
  if (typeof value === "string") return scrubPayPath(value);
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = walk(value[i], depth + 1);
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    record[key] = walk(record[key], depth + 1);
  }
  return value;
}

/** An event, breadcrumb or transaction, scrubbed in place and handed back. */
export function scrubPayTokens<T>(event: T): T {
  return walk(event, 0) as T;
}
