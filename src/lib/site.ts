/**
 * Canonical public origin, used by robots.txt and sitemap.xml.
 *
 * `NEXT_PUBLIC_SERVER_URL` carries a localhost default (see lib/env.ts)
 * so the app boots without configuration. That default is harmless
 * everywhere except here: a sitemap full of `http://localhost:3000`
 * URLs is worse than no sitemap at all, and it fails silently — the
 * build succeeds and Google indexes nothing. So a production build
 * falls back to the real domain rather than trusting the default.
 *
 * Moves to shared/constants/ in step 2 of the structure migration.
 */
const CANONICAL_ORIGIN = "https://calanthe.ae";

function resolveOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL;

  if (!configured) return CANONICAL_ORIGIN;

  /* A localhost origin baked into a production build is always a
     misconfiguration, never an intention. */
  if (process.env.NODE_ENV === "production" && configured.includes("localhost")) {
    return CANONICAL_ORIGIN;
  }

  return configured.replace(/\/$/, "");
}

export const SITE_ORIGIN = resolveOrigin();

/**
 * True only on the real production deployment. Preview deployments and
 * local builds must never be indexed — duplicate content on a
 * `*.vercel.app` URL competes with the real site.
 */
export const IS_PRODUCTION_DEPLOYMENT =
  process.env.VERCEL_ENV === "production" ||
  (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === undefined);

export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}
