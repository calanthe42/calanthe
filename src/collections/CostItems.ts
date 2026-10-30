import type { CollectionConfig } from "payload";
import { activeRole, isAdmin } from "@backend/payload/access";
import { COST_LIMITS, ONE_UNITS } from "@backend/domain/costs";

/**
 * What you buy — every flower, green, piece of packaging and extra the
 * owner buys, and what ONE of it costs her now.
 *
 * ONE ROW PER THING SHE BUYS, PRICED FOR ONE. A rose comes as a bunch of
 * 20 and goes into an arrangement a stem at a time, so `packName` is
 * "bunch", `unitsPerPack` is 20, `one` is "stem", and `currentUnitCostFils`
 * is the price of ONE stem — a fraction of a fils allowed, because 30 stems
 * for AED 64 is 213.33 fils.
 *
 * THE PRICE COMES FROM HER INVOICES. Saving an invoice sets the price to the
 * price for one on the item's LATEST invoice line (by invoice date), with
 * the day and the supplier (backend/actions/costs.ts). Only something with
 * no invoice yet has a price she typed (`costSource: "typed"`). No price at
 * all is null — never 0 — so an arrangement that uses it reads "at least".
 *
 * OWNER ONLY, INCLUDING READ. What she pays her suppliers is hers alone:
 * staff, customers and the public get nothing through any API, and the
 * collection is hidden from everyone else in /cms. The product a customer
 * buys is public; what it cost her lives here, apart from it.
 *
 * Something she stops buying is ARCHIVED ("I don't buy this any more")
 * rather than deleted: her invoices and arrangements still name it.
 */
export const CostItems: CollectionConfig = {
  slug: "cost-items",
  labels: { singular: "Something you buy", plural: "What you buy" },
  admin: {
    group: "Costs",
    useAsTitle: "name",
    defaultColumns: ["name", "group", "currentUnitCostFils", "lastPaidAt", "archived"],
    description: "What you buy and what one of it costs you. Managed in /admin → Costs → What you buy.",
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
      name: "group",
      type: "select",
      required: true,
      defaultValue: "flowers",
      index: true,
      options: [
        { label: "Flowers", value: "flowers" },
        { label: "Greenery", value: "greenery" },
        { label: "Packaging", value: "packaging" },
        { label: "Something extra", value: "extra" },
      ],
    },
    {
      name: "packName",
      type: "text",
      maxLength: 40,
      admin: { description: "How it comes: bunch, box, roll, carton, single." },
    },
    {
      name: "unitsPerPack",
      type: "number",
      required: true,
      defaultValue: 1,
      min: COST_LIMITS.unitsPerPackMin,
      max: COST_LIMITS.unitsPerPackMax,
      admin: { description: "How many in one: the 20 in “a bunch of 20”." },
    },
    {
      name: "one",
      type: "select",
      required: true,
      defaultValue: "stem",
      options: ONE_UNITS.map((value) => ({ label: value[0]!.toUpperCase() + value.slice(1), value })),
      admin: { description: "What one is, in “AED 3.23 a stem”." },
    },
    {
      name: "currentUnitCostFils",
      type: "number",
      min: 0,
      max: COST_LIMITS.priceForOneMaxFils,
      admin: {
        description:
          "The price for one, in fils (AED × 100), decimals allowed. From the latest invoice; empty means no price yet.",
      },
    },
    {
      name: "costSource",
      type: "select",
      required: true,
      defaultValue: "typed",
      options: [
        { label: "From an invoice", value: "invoice" },
        { label: "Typed by you", value: "typed" },
      ],
    },
    {
      name: "lastPaidAt",
      type: "date",
      admin: { description: "The invoice date the price came from.", date: { pickerAppearance: "dayOnly" } },
    },
    { name: "lastSupplier", type: "relationship", relationTo: "suppliers" },
    {
      name: "aliases",
      type: "array",
      labels: { singular: "Name on the invoice", plural: "Names on the invoice" },
      admin: { description: "Names as suppliers print them, learned when an invoice is saved." },
      fields: [{ name: "text", type: "text", required: true, maxLength: 80 }],
    },
    {
      name: "archived",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: { description: "I don't buy this any more." },
    },
    { name: "notes", type: "textarea", maxLength: 1000 },
  ],
};
