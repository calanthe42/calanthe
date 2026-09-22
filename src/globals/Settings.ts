import type { GlobalConfig } from "payload";
import { isAdmin } from "@backend/payload/access";
import { deliveryZones } from "@/lib/data";

/**
 * The store's operating settings — one record, edited by the owner.
 *
 * DELIVERY first, because it is the part that prices an order: a zone the
 * owner switches off disappears from checkout, a fee she changes is what the
 * next order pays, and the cut-off she sets is when "today" stops being
 * offered. Everything here is read by the storefront through
 * `backend/data/store-settings.ts`, which fills in the code defaults for
 * anything not yet saved, so this global may be empty and the shop still
 * runs exactly as before.
 *
 * Public read, deliberately: the storefront prices and offers delivery from
 * it on every request. Owner-only write.
 */
export const Settings: GlobalConfig = {
  slug: "settings",
  label: "Store settings",
  admin: {
    group: "Shop",
    description: "Delivery zones, fees, cut-off and time windows. Edited from /admin/delivery.",
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: "delivery",
      type: "group",
      fields: [
        {
          name: "zones",
          type: "array",
          labels: { singular: "Zone", plural: "Zones" },
          admin: { description: "One row per emirate. An emirate with no row is delivered at its default fee." },
          fields: [
            {
              name: "emirate",
              type: "select",
              required: true,
              options: deliveryZones.map((zone) => ({ label: zone.name, value: zone.id })),
            },
            { name: "feeFils", type: "number", required: true, min: 0, admin: { description: "In fils (AED × 100)." } },
            { name: "enabled", type: "checkbox", defaultValue: true },
          ],
        },
        {
          name: "freeDeliveryThresholdFils",
          type: "number",
          min: 0,
          admin: { description: "Orders at or above this amount (fils) are delivered free." },
        },
        {
          name: "freeDeliveryNever",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Delivery is always charged, whatever the order's size." },
        },
        {
          name: "sameDayCutoffHour",
          type: "number",
          min: 0,
          max: 23,
          admin: { description: "Hour of the day (UAE time, 0–23) after which same-day delivery is no longer offered." },
        },
        {
          name: "timeSlots",
          type: "array",
          labels: { singular: "Time window", plural: "Time windows" },
          fields: [{ name: "label", type: "text", required: true, maxLength: 40 }],
        },
      ],
    },
  ],
};
