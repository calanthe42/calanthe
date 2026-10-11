import { unstable_cache } from "next/cache";
import { getPayload } from "payload";
import config from "@payload-config";

/**
 * WEBSITE SWITCHES the owner flips in Admin → Website, without a developer:
 *
 *   eventsLive       the Events page, its links in the menus and footer,
 *                    the homepage's way in and the sitemap entry
 *   guestFavorsLive  the guest favours section, its menu link and the
 *                    homepage button (only shown while Events are live)
 *
 * Stored in `site_settings` (key → JSON value). Read through a cache that
 * the admin action clears the moment a switch moves, so the storefront
 * follows within one page load and never queries this on every request.
 * Missing or unreadable means OFF: a hidden page that should be visible is
 * an inconvenience; a half-ready page that should be hidden is not.
 */
export type SiteFlags = { eventsLive: boolean; guestFavorsLive: boolean };

export const SITE_FLAGS_TAG = "site-flags";
export const SITE_FLAG_KEYS = ["eventsLive", "guestFavorsLive"] as const;
export type SiteFlagKey = (typeof SITE_FLAG_KEYS)[number];

const OFF: SiteFlags = { eventsLive: false, guestFavorsLive: false };

type Row = { key: string; value: unknown };
type DrizzleLike = { execute: (query: unknown) => Promise<unknown> };
const rowsOf = (result: unknown): Row[] =>
  Array.isArray(result) ? (result as Row[]) : (((result as { rows?: Row[] })?.rows ?? []) as Row[]);

async function readFlags(): Promise<SiteFlags> {
  try {
    const payload = await getPayload({ config });
    const { sql } = await import("@payloadcms/db-postgres");
    const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;
    const rows = rowsOf(await drizzle.execute(sql`SELECT key, value FROM site_settings WHERE key IN ('eventsLive', 'guestFavorsLive')`));
    const flags = { ...OFF };
    for (const row of rows) {
      if (row.key === "eventsLive" || row.key === "guestFavorsLive") flags[row.key] = row.value === true;
    }
    return flags;
  } catch {
    return OFF;
  }
}

export const getSiteFlags = unstable_cache(readFlags, ["site-flags-v1"], { tags: [SITE_FLAGS_TAG], revalidate: 3600 });

/** Guest favours only ever show inside a live Events page. */
export function effectiveFlags(flags: SiteFlags): SiteFlags {
  return { eventsLive: flags.eventsLive, guestFavorsLive: flags.eventsLive && flags.guestFavorsLive };
}
