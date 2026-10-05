import type { CollectionConfig } from "payload";
import { isAdmin } from "@backend/payload/access";
import { filsField } from "@backend/payload/fields/money";
import { validateDiscount } from "@backend/payload/hooks/validateDiscount";
import { PRODUCT_CATEGORIES } from "@backend/domain/product-form";
import { CODE_MAX_LENGTH, MAX_DISCOUNT_PERCENT, SALE_LABEL_MAX } from "@/lib/discounts";

/**
 * Sales and discount codes — one collection, two kinds.
 *
 *   automatic   a SALE. Lowers the price of matching products for everyone;
 *               customers see it on the product, struck through. No code.
 *   code        a DISCOUNT CODE. An order-level amount off, typed in the
 *               basket or at checkout. One per order.
 *
 * The arithmetic is not here. It lives in lib/discounts.ts (pure, shared with
 * the browser) and is applied by backend/domain/pricing.ts; this file only
 * says what a discount IS and who may touch one.
 *
 * OWNER ONLY, INCLUDING READ. A code is a secret and a price is the owner's
 * decision, so staff can neither see nor change this collection. The
 * storefront and checkout never read it through REST or GraphQL: they go
 * through backend/data/discounts.ts on the server, which names the few
 * fields that may leave it.
 *
 * NOTHING HERE CHANGES AN OLD ORDER. An order copies the terms it was sold
 * under (Orders.discountSnapshot, items.compareAtUnitPriceFils, the labels),
 * so editing or deleting a discount later rewrites no receipt.
 *
 * `timesUsed` is written by exactly one statement in the whole codebase —
 * backend/payments/redeem.ts, when Stripe's signed webhook marks an order
 * paid — and by no role through any API.
 */
export const Discounts: CollectionConfig = {
  slug: "discounts",
  labels: { singular: "Discount", plural: "Discounts" },
  admin: {
    group: "Shop",
    useAsTitle: "title",
    defaultColumns: ["title", "kind", "code", "active", "startsAt", "endsAt", "timesUsed"],
    description: "Automatic sales and discount codes. Managed in /admin → Discounts.",
    listSearchableFields: ["title", "code"],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [validateDiscount],
  },
  defaultSort: "-createdAt",
  timestamps: true,
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      maxLength: 80,
      admin: { description: "For your own reference. Customers never see this." },
    },
    {
      name: "kind",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Automatic sale", value: "automatic" },
        { label: "Discount code", value: "code" },
      ],
      /* The method cannot change after creation: a sale that became a code
         would leave orders pointing at a rule that no longer describes them. */
      access: { update: () => false },
    },
    {
      name: "code",
      type: "text",
      unique: true,
      index: true,
      maxLength: CODE_MAX_LENGTH,
      admin: {
        description: "Stored in capitals. Empty for an automatic sale.",
      },
    },

    /* ---------- value ---------- */
    {
      name: "valueType",
      type: "select",
      required: true,
      options: [
        { label: "Percentage", value: "percentage" },
        { label: "Fixed amount", value: "fixed" },
      ],
    },
    {
      name: "percentOff",
      type: "number",
      min: 1,
      max: MAX_DISCOUNT_PERCENT,
      admin: { step: 1, description: `Whole number, 1 to ${MAX_DISCOUNT_PERCENT}.` },
    },
    filsField({
      name: "amountOffFils",
      label: "Amount off (fils)",
      admin: {
        description:
          "Fils (AED × 100). A sale takes this off each arrangement; a code takes it off the order once.",
      },
    }),

    /* ---------- what a sale applies to ---------- */
    {
      name: "appliesTo",
      type: "select",
      required: true,
      defaultValue: "all",
      options: [
        { label: "All products", value: "all" },
        { label: "Specific products", value: "products" },
        { label: "Specific occasions", value: "occasions" },
        { label: "Specific categories", value: "categories" },
      ],
      admin: { description: "A code always applies to the whole order." },
    },
    { name: "products", type: "relationship", relationTo: "products", hasMany: true },
    { name: "occasions", type: "relationship", relationTo: "occasions", hasMany: true },
    {
      name: "categories",
      type: "select",
      hasMany: true,
      options: PRODUCT_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
    },

    /* ---------- what customers read ---------- */
    {
      name: "labelEn",
      type: "text",
      maxLength: SALE_LABEL_MAX,
      admin: { description: "Shown on the product, e.g. “Eid offer”. Sales only." },
    },
    {
      name: "labelAr",
      type: "text",
      maxLength: SALE_LABEL_MAX,
      admin: { description: "The same label in Arabic. Sales only." },
    },

    /* ---------- when ---------- */
    {
      name: "startsAt",
      type: "date",
      admin: { date: { pickerAppearance: "dayAndTime" }, description: "Inclusive. Empty means now." },
    },
    {
      name: "endsAt",
      type: "date",
      admin: { date: { pickerAppearance: "dayAndTime" }, description: "Exclusive. Empty means no end." },
    },
    {
      name: "active",
      type: "checkbox",
      /* OFF until the owner turns it on. A discount is saved as a draft, and
         going live is a separate, confirmed act (backend/actions/discounts.ts):
         one mistyped number must not reprice the shop. */
      defaultValue: false,
      index: true,
    },

    /* ---------- code-only limits ---------- */
    filsField({
      name: "minSubtotalFils",
      label: "Minimum purchase (fils)",
      admin: { description: "Measured after sale prices. Codes only." },
    }),
    {
      name: "usageLimit",
      type: "number",
      min: 1,
      admin: { step: 1, description: "Total number of paid orders that may use the code. Codes only." },
    },
    {
      name: "oncePerCustomer",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Checked by email address. Codes only." },
    },
    {
      name: "timesUsed",
      type: "number",
      required: true,
      defaultValue: 0,
      /* Counted when an order is PAID, by one SQL statement in the webhook.
         No role can author it. */
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: "Paid orders that used this code." },
    },
  ],
};
