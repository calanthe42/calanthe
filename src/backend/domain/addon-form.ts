import { ADDON_LIMITS, isAddonKey, type StoreAddon } from "@/lib/store-settings";

/**
 * Reading the owner's add-ons screen (Admin → Add-ons) into the list the
 * server saves.
 *
 * PURE, like the rest of backend/domain: the action (backend/actions/
 * addons.ts) does only what needs a server. A mistake in what she typed is an
 * `AddonInputError` carrying a sentence written for her and an
 * `actions.addons.*` dictionary code, so the admin can show it in her
 * language. Rows are numbered as the screen numbers them ("Add-on 3").
 *
 * KEYS ARE THE SERVER'S. The screen sends back the key of each row it was
 * given, and that key is kept only if it is one of hers already — so a
 * renamed row keeps its key, and a browser cannot invent or swap one. Any
 * other row is new and gets a key made from its English name, unique in the
 * list (`keyFromName`).
 */

export class AddonInputError extends Error {
  readonly code: string;
  readonly vars?: Record<string, string | number>;

  constructor(message: string, code: string, vars?: Record<string, string | number>) {
    super(message);
    this.name = "AddonInputError";
    this.code = `actions.addons.${code}`;
    this.vars = vars;
  }
}

/** One row as the screen sends it. Every field is untrusted. */
type SentRow = { key?: unknown; nameEn?: unknown; nameAr?: unknown; priceAed?: unknown; active?: unknown };

const words = (value: unknown): string => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

/** "150", "150.5", "1,500", "AED 25" → fils. Anything else, or out of range, → null. */
export function addonPriceFils(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/^\s*aed/i, "").replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  /* Rounded once, here: 0.29 × 100 is 28.999… in floating point. */
  const fils = Math.round(Number(cleaned) * 100);
  return fils <= ADDON_LIMITS.maxPriceFils ? fils : null;
}

/**
 * A key from an English name: "Bento Cake" → "bento-cake", unique against
 * `taken` ("vase-2" beside "vase"). A name with no letters or digits in it
 * becomes "addon".
 */
export function keyFromName(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, ADDON_LIMITS.keyMax)
      .replace(/-+$/g, "") || "addon";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const key = `${base.slice(0, ADDON_LIMITS.keyMax - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(key)) return key;
  }
}

/**
 * The screen's rows (`raw`, the JSON of its hidden `addons` field), checked
 * and keyed against her list as it is saved now (`current`).
 */
export function parseAddonsForm(raw: FormDataEntryValue | null, current: readonly StoreAddon[]): StoreAddon[] {
  let sent: unknown;
  try {
    sent = typeof raw === "string" ? JSON.parse(raw) : null;
  } catch {
    sent = null;
  }
  if (!Array.isArray(sent) || sent.some((row) => typeof row !== "object" || row === null)) {
    throw new AddonInputError("The add-ons could not be read. Reload the page and try again.", "unreadable");
  }
  const rows = sent as SentRow[];

  if (rows.length === 0) {
    /* An empty list is how the shop says "nothing saved yet" — it would
       bring the defaults back, which is the opposite of what she meant. */
    throw new AddonInputError(
      "Keep at least one add-on on the list. To show none on the website, switch them off.",
      "atLeastOne",
    );
  }
  if (rows.length > ADDON_LIMITS.maxCount) {
    throw new AddonInputError(`You can have up to ${ADDON_LIMITS.maxCount} add-ons.`, "tooMany", {
      max: ADDON_LIMITS.maxCount,
    });
  }

  const checked = rows.map((row, index) => {
    const n = index + 1;
    const nameEn = words(row.nameEn);
    const nameAr = words(row.nameAr);
    if (!nameEn) throw new AddonInputError(`Add-on ${n}: write its name in English.`, "nameEnRequired", { n });
    if (!nameAr) throw new AddonInputError(`Add-on ${n}: write its name in Arabic.`, "nameArRequired", { n });
    if (nameEn.length > ADDON_LIMITS.nameMax || nameAr.length > ADDON_LIMITS.nameMax) {
      throw new AddonInputError(
        `Add-on ${n}: keep each name under ${ADDON_LIMITS.nameMax} characters.`,
        "nameTooLong",
        { n, max: ADDON_LIMITS.nameMax },
      );
    }
    const priceFils = addonPriceFils(row.priceAed);
    if (priceFils === null) {
      throw new AddonInputError(
        `Add-on ${n}: the price must be between AED 0 and AED 10,000, like 150 or 12.50.`,
        "priceRange",
        { n },
      );
    }
    return { sentKey: row.key, nameEn, nameAr, priceFils, active: row.active !== false };
  });

  const seenNames = new Set<string>();
  for (const row of checked) {
    const name = row.nameEn.toLowerCase();
    if (seenNames.has(name)) {
      throw new AddonInputError(`Two add-ons are called “${row.nameEn}”. Give each its own name.`, "nameTwice", {
        name: row.nameEn,
      });
    }
    seenNames.add(name);
  }

  /* Her keys first, so a new row can never take a key a kept row holds. */
  const hers = new Set(current.map((addon) => addon.key));
  const taken = new Set<string>();
  const kept = checked.map((row) => {
    const key = isAddonKey(row.sentKey) && hers.has(row.sentKey) && !taken.has(row.sentKey) ? row.sentKey : null;
    if (key) taken.add(key);
    return key;
  });

  return checked.map((row, index) => {
    let key = kept[index];
    if (!key) {
      key = keyFromName(row.nameEn, taken);
      taken.add(key);
    }
    return { key, nameEn: row.nameEn, nameAr: row.nameAr, priceFils: row.priceFils, active: row.active };
  });
}
