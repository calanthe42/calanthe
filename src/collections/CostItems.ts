import type { CollectionConfig } from "payload";
import { activeRole, isAdmin } from "@backend/payload/access";
import { COST_KINDS, COST_LIMITS, USE_UNITS } from "@backend/domain/costs";

/**
 * Flowers and materials — the owner's library of what goes into a product,
 * and what each one costs her now.
 *
 * ONE ROW PER THING SHE BUYS, COUNTED IN THE UNIT A RECIPE USES. A rose is
 * bought by the bunch of 20 and used by the stem, so `useUnit` is "stem",
 * `unitsPerPack` is 20, and `currentUnitCostFils` is the cost of ONE stem —
 * a fraction of a fils allowed, because AED 7.50 for 20 stems is 37.5 fils.
 *
 * The cost is typed by the owner for now (`costSource: "manual"`); a later
 * step takes it from her latest purchase invoice instead. The arithmetic of a
 * recipe lives in backend/domain/costs.ts; this file only says what an item
 * IS and who may touch one.
 *
 * OWNER ONLY, INCLUDING READ. What she pays her suppliers is hers alone:
 * staff, customers and the public get nothing through any API, and the
 * collection is hidden from everyone else in /cms. The product a customer
 * buys is public; what it cost her lives here, apart from it.
 *
 * An item is ARCHIVED rather than deleted once she stops buying it, so the
 * recipes that still name it keep saying so.
 */
export const CostItems: CollectionConfig = {
  slug: "cost-items",
  labels: { singular: "Flower or material", plural: "Flowers and materials" },
  admin: {
    group: "Costs",
    useAsTitle: "name",
    defaultColumns: ["name", "kind", "useUnit", "currentUnitCostFils", "archived"],
    description: "What each flower and material costs you. Managed in /admin → Costs.",
    listSearchableFields: ["name"],
    hidden: ({ user }) => activeRole(user) !== "admin",
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  defaultSort: "name",
  timestamps: true,
  fields: [
    { name: "name", type: "text", required: true, unique: true, maxLength: 80 },
    {
      name: "kind",
      type: "select",
      required: true,
      defaultValue: "flower",
      index: true,
      options: COST_KINDS.map((value) => ({ label: value[0]!.toUpperCase() + value.slice(1), value })),
    },
    {
      name: "useUnit",
      type: "select",
      required: true,
      defaultValue: "stem",
      options: USE_UNITS.map((value) => ({ label: value[0]!.toUpperCase() + value.slice(1), value })),
      admin: { description: "The unit a recipe counts in." },
    },
    {
      name: "packName",
      type: "text",
      maxLength: 40,
      admin: { description: "How it is bought: Bunch, Carton, Roll." },
    },
    {
      name: "unitsPerPack",
      type: "number",
      required: true,
      defaultValue: 1,
      min: COST_LIMITS.unitsPerPackMin,
      admin: { description: "Use-units in one pack: 20 stems a bunch, 50 metres a roll." },
    },
    {
      name: "currentUnitCostFils",
      type: "number",
      defaultValue: 0,
      min: 0,
      max: COST_LIMITS.maxFils,
      admin: {
        description:
          "Fils (AED × 100) for ONE use-unit, decimals allowed. Delivery included; VAT left out when you claim it back.",
      },
    },
    {
      name: "costSource",
      type: "select",
      defaultValue: "manual",
      options: [
        { label: "From a purchase", value: "purchase" },
        { label: "Typed by hand", value: "manual" },
      ],
    },
    {
      name: "swatch",
      type: "text",
      maxLength: 7,
      validate: (value: unknown) =>
        value === null || value === undefined || value === "" || /^#[0-9a-fA-F]{6}$/.test(String(value))
          ? true
          : "Use a colour like #c0392b.",
      admin: { description: "Optional colour shown beside the name, #rrggbb." },
    },
    {
      name: "aliases",
      type: "array",
      labels: { singular: "Printed name", plural: "Printed names" },
      admin: { description: "Names as suppliers print them on invoices." },
      fields: [{ name: "text", type: "text", required: true, maxLength: 80 }],
    },
    { name: "archived", type: "checkbox", defaultValue: false, index: true },
    { name: "notes", type: "textarea", maxLength: 1000 },
  ],
};
