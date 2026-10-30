import type { CollectionConfig } from "payload";
import { activeRole, isAdmin } from "@backend/payload/access";
import { COST_LIMITS, DEFAULT_COST_SETTINGS } from "@backend/domain/costs";

/**
 * What goes into a product — its cost recipe. One row per product, at most.
 *
 * WHY A SEPARATE COLLECTION, NOT FIELDS ON THE PRODUCT. Products are public:
 * the storefront and its API read them. A cost on the product row would be
 * one forgotten `select` away from a customer's browser. Here it sits behind
 * owner-only access, and the product never knows it exists.
 *
 * Edited in the product editor's Cost section and saved by the product's own
 * Save button (backend/actions/admin.ts → actions/costs-shared.ts). The cost
 * itself is never stored: it is worked out from the library's current prices
 * each time (backend/domain/costs.ts `recipeCost`), so a dearer rose shows up
 * in every product that uses it the moment its price changes.
 *
 * Deleting the product deletes its recipe (the migration's ON DELETE CASCADE):
 * a recipe for nothing is meaningless.
 */
export const ProductCosts: CollectionConfig = {
  slug: "product-costs",
  labels: { singular: "Product cost", plural: "Product costs" },
  admin: {
    group: "Costs",
    useAsTitle: "id",
    defaultColumns: ["product", "wastePercent", "makingMinutes", "updatedAt"],
    description: "What goes into each product. Edited in /admin → Products → Cost.",
    hidden: ({ user }) => activeRole(user) !== "admin",
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  timestamps: true,
  fields: [
    { name: "product", type: "relationship", relationTo: "products", required: true, unique: true },
    {
      name: "lines",
      type: "array",
      maxRows: COST_LIMITS.recipeLinesMax,
      labels: { singular: "Line", plural: "Lines" },
      fields: [
        { name: "item", type: "relationship", relationTo: "cost-items", required: true },
        {
          name: "quantity",
          type: "number",
          required: true,
          min: 0.001,
          max: COST_LIMITS.quantityMax,
          admin: { description: "In the item's use-unit: stems, pieces, metres." },
        },
      ],
    },
    {
      name: "wastePercent",
      type: "number",
      defaultValue: DEFAULT_COST_SETTINGS.defaultWastePercent,
      min: COST_LIMITS.wastePercent.min,
      max: COST_LIMITS.wastePercent.max,
      admin: { description: "Allowance for lost flowers, added to flowers and greenery only." },
    },
    {
      name: "makingMinutes",
      type: "number",
      defaultValue: 0,
      min: COST_LIMITS.makingMinutes.min,
      max: COST_LIMITS.makingMinutes.max,
      admin: { description: "Making time, costed at the florist's hourly rate." },
    },
    { name: "notes", type: "textarea", maxLength: 1000 },
  ],
};
