import { deliveryZones, FREE_DELIVERY_THRESHOLD_AED, SAME_DAY_CUTOFF_HOUR, timeSlots } from "@/lib/data";

/**
 * DELIVERY IS THE OWNER'S TO SET.
 *
 * Which emirates the atelier delivers to, what each costs, when an order is
 * large enough for delivery to be complimentary, how late a same-day order
 * can be placed and which windows a courier runs — these used to be four
 * constants in code, changed by a developer and a deploy. They are now a
 * record the owner edits in /admin/delivery, and this module is the ONE
 * shape both sides agree on: the storefront reads it to price and to offer
 * days and windows; the admin writes it.
 *
 * DEFAULTS ARE THE OLD CONSTANTS. Until the owner saves the screen once,
 * and whenever a field is missing, the store behaves exactly as it did —
 * so nothing about checkout changes on the deploy that introduces this.
 *
 * Pure: no database, no React, importable from a client component.
 */

export const EMIRATES = deliveryZones.map((zone) => zone.id);
export type EmirateId = (typeof EMIRATES)[number];

export type DeliveryZoneSetting = {
  id: string;
  /** The emirate's name in English, from the catalogue; the admin translates. */
  name: string;
  feeFils: number;
  enabled: boolean;
};

export type DeliverySettings = {
  zones: DeliveryZoneSetting[];
  /** Orders at or above this are delivered free. `null` means never. */
  freeDeliveryThresholdFils: number | null;
  /** Orders placed before this hour (UAE time, 0–23) can be delivered today. */
  sameDayCutoffHour: number;
  timeSlots: string[];
};

export type StoreSettings = {
  delivery: DeliverySettings;
};

export const DEFAULT_DELIVERY: DeliverySettings = {
  zones: deliveryZones.map((zone) => ({ id: zone.id, name: zone.name, feeFils: zone.feeAed * 100, enabled: true })),
  freeDeliveryThresholdFils: FREE_DELIVERY_THRESHOLD_AED * 100,
  sameDayCutoffHour: SAME_DAY_CUTOFF_HOUR,
  timeSlots: [...timeSlots],
};

export const DEFAULT_SETTINGS: StoreSettings = { delivery: DEFAULT_DELIVERY };

/** What Payload hands back for the `settings` global, loosely typed. */
export type RawSettings = {
  delivery?: {
    zones?: Array<{ emirate?: string | null; feeFils?: number | null; enabled?: boolean | null }> | null;
    freeDeliveryThresholdFils?: number | null;
    freeDeliveryNever?: boolean | null;
    sameDayCutoffHour?: number | null;
    timeSlots?: Array<{ label?: string | null }> | null;
  } | null;
  addons?: ReadonlyArray<RawAddonRow | null | undefined> | null;
} | null;

const isHour = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 23;
const isFils = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/**
 * The saved record, completed with defaults wherever it is silent, and
 * with every zone the checkout knows about present exactly once — a zone
 * the owner never saved is delivered at its default fee, not dropped.
 */
export function normaliseSettings(raw: RawSettings): StoreSettings {
  const d = raw?.delivery ?? null;

  const saved = new Map<string, { feeFils: number; enabled: boolean }>();
  for (const row of d?.zones ?? []) {
    if (!row?.emirate || !EMIRATES.includes(row.emirate)) continue;
    saved.set(row.emirate, {
      feeFils: isFils(row.feeFils) ? row.feeFils : DEFAULT_DELIVERY.zones.find((z) => z.id === row.emirate)!.feeFils,
      enabled: row.enabled !== false,
    });
  }
  const zones = DEFAULT_DELIVERY.zones.map((zone) => ({ ...zone, ...(saved.get(zone.id) ?? {}) }));

  const slots = (d?.timeSlots ?? []).map((s) => (s?.label ?? "").trim()).filter(Boolean);

  return {
    delivery: {
      zones,
      freeDeliveryThresholdFils: d?.freeDeliveryNever
        ? null
        : isFils(d?.freeDeliveryThresholdFils)
          ? d!.freeDeliveryThresholdFils!
          : DEFAULT_DELIVERY.freeDeliveryThresholdFils,
      sameDayCutoffHour: isHour(d?.sameDayCutoffHour) ? d!.sameDayCutoffHour! : DEFAULT_DELIVERY.sameDayCutoffHour,
      timeSlots: slots.length > 0 ? slots : DEFAULT_DELIVERY.timeSlots,
    },
  };
}

/** The zones a customer may choose from, in the catalogue's order. */
export function enabledZones(delivery: DeliverySettings): DeliveryZoneSetting[] {
  return delivery.zones.filter((zone) => zone.enabled);
}

/* ------------------------------------------------------------------ */
/* Add-ons — "Something extra" on every product                         */
/* ------------------------------------------------------------------ */

/**
 * THE ADD-ONS ARE THE OWNER'S TO SET, like delivery: what they are called in
 * both languages, what each costs, which are offered and in what order. She
 * keeps them in Admin → Add-ons (the `settings` global, globals/Settings.ts),
 * and everything that shows or charges one reads that same list — the
 * product page and the basket from the storefront layout, the server's
 * quote and payment from the global itself (backend/data/store-settings.ts).
 *
 * THE KEY IS FOR EVER. `key` is what a basket and the checkout call an
 * add-on by. It is made from the English name when the row is first saved
 * and never changes after: renaming "Vase" to "Glass vase" changes the
 * names, not the key, so a basket that holds it still holds it. Orders do
 * not depend on it at all — each one keeps the name it was sold under.
 */
export type StoreAddon = {
  key: string;
  nameEn: string;
  nameAr: string;
  priceFils: number;
  /** "Show on products". Off: kept on her list, not for sale. */
  active: boolean;
};

export const ADDON_LIMITS = {
  maxCount: 12,
  /** AED 10,000. */
  maxPriceFils: 1_000_000,
  nameMax: 40,
  keyMax: 40,
} as const;

/* Lower-case words joined by single hyphens: "vase", "bento-cake". */
const ADDON_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isAddonKey = (value: unknown): value is string =>
  typeof value === "string" && value.length <= ADDON_LIMITS.keyMax && ADDON_KEY.test(value);

/**
 * DEFAULTS ARE THE LIST THE SHOP SELLS TODAY (client, 2026-10-30: the vase
 * is AED 150, and chocolates are no longer offered), with the Arabic names
 * the storefront dictionary has always shown. Until the owner saves her own
 * list, this is the list — so nothing changes for a customer on the deploy
 * that introduces the screen.
 */
export const DEFAULT_ADDONS: readonly StoreAddon[] = [
  { key: "vase", nameEn: "Vase", nameAr: "مزهرية", priceFils: 15_000, active: true },
  { key: "balloon", nameEn: "Balloon", nameAr: "بالون", priceFils: 3_500, active: true },
  { key: "cake", nameEn: "Bento Cake", nameAr: "كيكة بنتو", priceFils: 9_500, active: true },
  { key: "teddy", nameEn: "Teddy Bear", nameAr: "دبدوب", priceFils: 9_000, active: true },
  { key: "polaroid", nameEn: "Polaroid Card", nameAr: "بطاقة بولارويد", priceFils: 2_500, active: true },
];

/** One saved row, as Payload hands it back, loosely typed. */
export type RawAddonRow = {
  key?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  priceFils?: number | null;
  active?: boolean | null;
};

/**
 * The saved list in her order, or the defaults while nothing is saved.
 *
 * A row that could not be sold as it stands — no key, a key already used
 * above it, no English name, a price out of range — is left out rather than
 * shown wrong. The admin's own save never writes one; this is for a row
 * edited by hand in the developer CMS.
 */
export function normaliseAddons(raw: ReadonlyArray<RawAddonRow | null | undefined> | null | undefined): StoreAddon[] {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length === 0) return DEFAULT_ADDONS.map((addon) => ({ ...addon }));

  const seen = new Set<string>();
  const list: StoreAddon[] = [];
  for (const row of rows) {
    const key = row?.key?.trim() ?? "";
    const nameEn = row?.nameEn?.trim() ?? "";
    const priceFils = row?.priceFils;
    if (!isAddonKey(key) || seen.has(key) || !nameEn) continue;
    if (!isFils(priceFils) || priceFils > ADDON_LIMITS.maxPriceFils) continue;
    seen.add(key);
    list.push({ key, nameEn, nameAr: row?.nameAr?.trim() || nameEn, priceFils, active: row?.active !== false });
  }
  return list;
}

/** The add-ons a customer may choose from, in the owner's order. */
export function addonsForSale(list: readonly StoreAddon[]): StoreAddon[] {
  return list.filter((addon) => addon.active);
}

/**
 * An add-on's name in the reader's language.
 *
 * The live list answers first — her own words, as she last saved them. A key
 * that is no longer on it (`chocolates`, offered until 2026-10-30) falls back
 * to the storefront dictionary's `addonNames`, and then to the key itself,
 * so a name is never blank.
 */
export function addonLabel(
  key: string,
  list: readonly StoreAddon[],
  locale: "en" | "ar",
  fallback: Readonly<Record<string, string>>,
): string {
  const addon = list.find((a) => a.key === key);
  if (addon) return locale === "ar" ? addon.nameAr || addon.nameEn : addon.nameEn;
  return fallback[key] ?? key;
}
