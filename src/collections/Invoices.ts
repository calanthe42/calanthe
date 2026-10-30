import type { CollectionConfig } from "payload";
import { activeRole, isAdmin } from "@backend/payload/access";
import { COST_LIMITS } from "@backend/domain/costs";

/**
 * Invoices — what the owner bought from one supplier on one day. The only
 * place she adds information to Costs: everything else (the price for one
 * of each thing she buys, what an arrangement costs, what she kept this
 * month) is worked out from these and from the orders.
 *
 * EVERY NUMBER IS AS SHE TYPED OR READ IT, PLUS WHAT WAS WORKED OUT FROM IT
 * WHEN SHE SAVED. `packs`, `unitsPerPack` and `lineTotalFils` are what the
 * invoice says; `units` (5 × 20 = 100 stems) and `priceForOneFils` (the
 * line plus its share of delivery and supplier VAT, over the units —
 * backend/domain/costs.ts `invoicePricesForOne`) are stored with them, so a
 * price she reads anywhere always traces back to one line of one invoice.
 * The arithmetic is done by the save action (backend/actions/costs.ts), which
 * is also what updates the price of each thing on it; editing an invoice
 * here in /cms changes neither, so change invoices in /admin.
 *
 * `totalFils` is the total AS PRINTED, kept to check the lines against it
 * ("the lines add up to AED 780 but the total says AED 861"), or null when
 * she had none to type.
 *
 * THE SAME INVOICE TWICE IS REFUSED: the same supplier and the same invoice
 * number (ignoring case and spaces) — in the action, with a sentence naming
 * the day she added it, and underneath it by a partial unique index in the
 * migration. An invoice with no number cannot be checked, and is allowed.
 *
 * OWNER ONLY, INCLUDING READ, and hidden in /cms from everyone else.
 */
export const Invoices: CollectionConfig = {
  slug: "invoices",
  labels: { singular: "Invoice", plural: "Invoices" },
  admin: {
    group: "Costs",
    useAsTitle: "invoiceNumber",
    defaultColumns: ["invoiceDate", "supplier", "invoiceNumber", "totalFils", "source"],
    description: "What you bought, invoice by invoice. Add and change them in /admin → Costs → Invoices.",
    listSearchableFields: ["invoiceNumber"],
    hidden: ({ user }) => activeRole(user) !== "admin",
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  defaultSort: "-invoiceDate",
  timestamps: true,
  fields: [
    { name: "supplier", type: "relationship", relationTo: "suppliers", required: true, index: true },
    { name: "invoiceNumber", type: "text", maxLength: 60 },
    {
      name: "invoiceDate",
      type: "date",
      required: true,
      index: true,
      admin: {
        description: "The day printed on the invoice (stored as midday in the UAE).",
        date: { pickerAppearance: "dayOnly" },
      },
    },
    {
      name: "lines",
      type: "array",
      required: true,
      minRows: 1,
      maxRows: COST_LIMITS.invoiceLinesMax,
      labels: { singular: "Line", plural: "Lines" },
      fields: [
        { name: "item", type: "relationship", relationTo: "cost-items", required: true },
        { name: "printedName", type: "text", maxLength: 120 },
        {
          name: "packs",
          type: "number",
          required: true,
          min: COST_LIMITS.packsMin,
          max: COST_LIMITS.packsMax,
          admin: { description: "How many bunches, boxes or rolls: the 5 in “5 bunches of 20”." },
        },
        {
          name: "unitsPerPack",
          type: "number",
          required: true,
          min: COST_LIMITS.unitsPerPackMin,
          max: COST_LIMITS.unitsPerPackMax,
          admin: { description: "How many in one: the 20 in “5 bunches of 20”." },
        },
        {
          name: "units",
          type: "number",
          required: true,
          min: 0.001,
          admin: { description: "Worked out: bunches × how many in one." },
        },
        {
          name: "lineTotalFils",
          type: "number",
          required: true,
          min: 0,
          max: COST_LIMITS.lineTotalMaxFils,
          admin: { description: "The line's total as printed, in fils (AED × 100)." },
        },
        {
          name: "priceForOneFils",
          type: "number",
          min: 0,
          admin: { description: "Worked out: the line plus its share of delivery and VAT, for one." },
        },
      ],
    },
    { name: "deliveryFils", type: "number", defaultValue: 0, min: 0, max: COST_LIMITS.extraMaxFils },
    { name: "vatFils", type: "number", defaultValue: 0, min: 0, max: COST_LIMITS.extraMaxFils },
    {
      name: "totalFils",
      type: "number",
      min: 0,
      admin: { description: "The total as printed on the invoice, in fils. Empty when there was none to type." },
    },
    {
      name: "source",
      type: "select",
      required: true,
      defaultValue: "typed",
      options: [
        { label: "Typed", value: "typed" },
        { label: "From a photo", value: "photo" },
      ],
    },
    { name: "notes", type: "textarea", maxLength: 1000 },
  ],
};
