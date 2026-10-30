import type { CollectionConfig } from "payload";
import { activeRole, isAdmin } from "@backend/payload/access";
import { COST_LIMITS } from "@backend/domain/costs";

/**
 * What goes into a product (florists call it a recipe). One row per
 * product, at most.
 *
 * WHY A SEPARATE COLLECTION, NOT FIELDS ON THE PRODUCT. Products are public:
 * the storefront and its API read them. A cost on the product row would be
 * one forgotten `select` away from a customer's browser. Here it sits behind
 * owner-only access, and the product never knows it exists.
 *
 * Only WHAT and HOW MANY are stored. What it costs is worked out from the
 * current prices each time (backend/domain/costs.ts `arrangementCost`), so a
 * dearer rose shows in every arrangement that uses it the moment an invoice
 * says so. There is no allowance for lost flowers and no making time: waste
 * is measured, not guessed, and her time is left out of every "you kept".
 *
 * Saved by the product's own Save (backend/actions/admin.ts →
 * actions/costs-shared.ts). Deleting the product deletes this (the
 * migration's ON DELETE CASCADE): what goes into nothing means nothing.
 */
export const ProductCosts: CollectionConfig = {
  slug: "product-costs",
  labels: { singular: "What goes in", plural: "What goes in" },
  admin: {
    group: "Costs",
    useAsTitle: "id",
    defaultColumns: ["product", "updatedAt"],
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
          admin: { description: "How many stems, pieces or metres." },
        },
      ],
    },
    { name: "notes", type: "textarea", maxLength: 1000 },
  ],
};
