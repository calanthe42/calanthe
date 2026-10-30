import type { CollectionConfig } from "payload";
import { activeRole, isAdmin } from "@backend/payload/access";

/**
 * The owner's suppliers — the flower market stall, the packaging wholesaler,
 * the bakery. Created the first time she types a new name on an invoice
 * (backend/actions/costs.ts `saveInvoice`); she never has to set one up
 * first.
 *
 * OWNER ONLY, INCLUDING READ, like everything in Costs: who she buys from,
 * and at what price, is hers alone.
 *
 * A supplier with invoices cannot be deleted (the migration's ON DELETE
 * RESTRICT on invoices.supplier_id): her invoices are her records.
 */
export const Suppliers: CollectionConfig = {
  slug: "suppliers",
  labels: { singular: "Supplier", plural: "Suppliers" },
  admin: {
    group: "Costs",
    useAsTitle: "name",
    defaultColumns: ["name", "phone", "updatedAt"],
    description: "Who you buy from. Added when you add an invoice in /admin → Costs.",
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
    { name: "phone", type: "text", maxLength: 40 },
    { name: "notes", type: "textarea", maxLength: 1000 },
  ],
};
