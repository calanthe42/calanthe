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
