import type { GlobalConfig } from "payload";
import { isAdmin } from "@backend/payload/access";
import { ADDON_LIMITS, isAddonKey } from "@/lib/store-settings";

/**
 * The store's operating settings — one record, edited by the owner.
 *
 * ADD-ONS today: the "Something extra" list on every product, which she
 * keeps in /admin/addons. Everything here is read through
 * `backend/data/store-settings.ts`, which fills in the code defaults for
 * anything not yet saved (lib/store-settings.ts), so this global may be
 * empty and the shop still runs exactly as before.
 *
 * Delivery joins this record when /admin/delivery is built, with its own
 * migration; lib/store-settings.ts already reads the shape it will have.
 * It was drafted here before the global was registered and taken out when
 * it was, so that nothing in /cms looks editable that the shop does not
 * read.
 *
 * Public read, deliberately: the storefront prices from it on every
 * request. Owner-only write.
 */
export const Settings: GlobalConfig = {
  slug: "settings",
  label: "Store settings",
  admin: {
    group: "Shop",
    description: "The add-ons offered on every product. Edited from /admin → Add-ons.",
    /* Edited only from Admin → Add-ons, whose save clears the shop's cached
       list and writes the activity log. A /cms save would do neither. */
    hidden: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: "addons",
      type: "array",
      labels: { singular: "Add-on", plural: "Add-ons" },
      maxRows: ADDON_LIMITS.maxCount,
      admin: {
        description:
          "In the order customers see them. While this is empty the shop offers its default list. The key never changes once saved.",
      },
      /* The one rule the admin's own form cannot be trusted to keep for a row
         edited here by hand: a basket names an add-on by its key, so two rows
         with one key would be one add-on at two prices. */
      validate: (rows: unknown) => {
        const list = Array.isArray(rows) ? (rows as { key?: unknown }[]) : [];
        if (list.length > ADDON_LIMITS.maxCount) return `Keep to ${ADDON_LIMITS.maxCount} add-ons or fewer.`;
        const keys = list.map((row) => row?.key);
        if (keys.some((key) => !isAddonKey(key))) {
          return "Each key is lower-case letters and numbers joined by hyphens, like bento-cake.";
        }
        return new Set(keys).size === keys.length ? true : "Two add-ons have the same key.";
      },
      fields: [
        { name: "key", type: "text", required: true, maxLength: ADDON_LIMITS.keyMax },
        { name: "nameEn", type: "text", required: true, maxLength: ADDON_LIMITS.nameMax },
        { name: "nameAr", type: "text", required: true, maxLength: ADDON_LIMITS.nameMax },
        {
          name: "priceFils",
          type: "number",
          required: true,
          min: 0,
          max: ADDON_LIMITS.maxPriceFils,
          admin: { description: "In fils (AED × 100)." },
        },
        { name: "active", type: "checkbox", defaultValue: true, admin: { description: "Shown on products." } },
      ],
    },
  ],
};
