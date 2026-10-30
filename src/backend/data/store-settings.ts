import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { addonsForSale, DEFAULT_ADDONS, normaliseAddons, type StoreAddon } from "@/lib/store-settings";

/**
 * The store settings as the shop reads them: the saved `settings` global
 * (globals/Settings.ts), completed with the code defaults wherever nothing is
 * saved (lib/store-settings.ts). Today that is the add-ons.
 *
 * THREE READERS, ONE LIST.
 *   · the storefront layout — `getStoreAddons`, cached under a tag the
 *     owner's save clears (backend/actions/addons.ts), so the product page and
 *     the basket show her change on the next page load;
 *   · the server's quote and payment — `readStoreAddons`, read fresh every
 *     time (backend/data/checkout-pricing.ts): what is charged is what is
 *     saved now, and a price she changed while a basket was open is caught
 *     as PRICE_CHANGED;
 *   · Admin → Add-ons — `getAddonsForAdmin`, fresh, every row.
 *
 * UNREADABLE MEANS THE DEFAULTS, never an empty list and never an error page.
 * The defaults are the list the shop sold before the owner had a screen for
 * it, so the shop keeps selling exactly as before — including in the minutes
 * between a deploy and its migration. The failure is logged.
 *
 * No `import "server-only"`, for the same reason as data/products.ts.
 */

export const STORE_ADDONS_TAG = "store-addons";

export type SavedAddons = { addons: StoreAddon[]; saved: boolean; updatedAt: string | null };

/**
 * The global as saved. THROWS when it cannot be read; the callers decide.
 * The owner's save reads through this too: the keys it keeps are the keys
 * of what is saved, never of a fallback.
 */
export async function readSavedAddons(payload: Payload): Promise<SavedAddons> {
  /* Public read (the global's own rule), so no user and no override. */
  const doc = await payload.findGlobal({ slug: "settings", depth: 0, overrideAccess: false });
  const rows = doc?.addons ?? [];
  return { addons: normaliseAddons(rows), saved: rows.length > 0, updatedAt: doc?.updatedAt ?? null };
}

const defaults = (): StoreAddon[] => DEFAULT_ADDONS.map((addon) => ({ ...addon }));

/* Only "the tables are not there yet" — the minutes between a deploy and its
   migration — means the defaults. Any other failure must not quietly bring
   back add-ons she switched off at prices she changed. */
function tablesMissing(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const { code, message } = current as { code?: unknown; message?: unknown };
    if (code === "42P01") return true;
    if (typeof message === "string" && /relation "settings(_addons)?" does not exist/.test(message)) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Every add-on she keeps, switched on or off, in her order. For pricing:
 * a switched-off key is refused by name (backend/domain/pricing.ts). A read
 * that fails for any reason but missing tables THROWS, so checkout refuses
 * to charge rather than price at the defaults.
 */
export async function readStoreAddons(payload: Payload): Promise<StoreAddon[]> {
  try {
    return (await readSavedAddons(payload)).addons;
  } catch (error) {
    if (!tablesMissing(error)) throw error;
    payload.logger.error(
      `[addons] the store settings could not be read; using the default add-ons: ${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
    return defaults();
  }
}

/* Cleared by the owner's save; the hour is only a backstop. A read that
   fails throws out of the cache, so a failure is never what is cached. */
const cachedForSale = unstable_cache(
  async () => addonsForSale((await readSavedAddons(await getPayload({ config }))).addons),
  ["store-addons-v1"],
  { tags: [STORE_ADDONS_TAG], revalidate: 3600 },
);

/** The add-ons a customer may choose, for the storefront layout. Never throws. */
export async function getStoreAddons(): Promise<StoreAddon[]> {
  try {
    return await cachedForSale();
  } catch (error) {
    /* Next's own signals (a page that must render per request) pass through. */
    unstable_rethrow(error);
    /* Before the migration the defaults are today's list; after it, an
       unreadable list shows no extras rather than old prices checkout would
       refuse. */
    console.error("[addons] the add-ons could not be read", error);
    return tablesMissing(error) ? addonsForSale(defaults()) : [];
  }
}

export type AddonsForAdmin = {
  addons: StoreAddon[];
  /** False while the shop is still on the defaults. */
  saved: boolean;
  /** Changes with every save, so the editor starts again from what was saved. */
  version: string;
};

/**
 * Her whole list for Admin → Add-ons.
 *
 * The one reader that does NOT fall back: an editor that opened on the
 * defaults because her own list could not be read would save the defaults
 * over it. It throws, and the admin's error screen says nothing was lost.
 */
export async function getAddonsForAdmin(): Promise<AddonsForAdmin> {
  const saved = await readSavedAddons(await getPayload({ config }));
  return { addons: saved.addons, saved: saved.saved, version: saved.updatedAt ?? "defaults" };
}
