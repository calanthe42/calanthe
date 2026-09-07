import type { CollectionConfig } from "payload";
import { isAdmin, isAdminField, publicReadWhenLive } from "@backend/payload/access";
import { filsField } from "@backend/payload/fields/money";
import { generateSlugFrom, validateSlug } from "@backend/payload/hooks/slug";
import { validateProductState } from "@backend/payload/hooks/validateProduct";

/**
 * The catalogue.
 *
 * Two decisions worth stating, because both look like omissions:
 *
 * 1. `category` is a select, not a relationship. The site has exactly one
 *    real taxonomy — occasions — and adding a second generic one would
 *    give three overlapping ways to group a product (docs/DATABASE.md §1).
 *    Category here is the shape of the arrangement, which is a fixed,
 *    small vocabulary that does not need client management.
 *
 * 2. Money is integer fils, never decimal AED. See backend/payload/fields/money.ts.
 *
 * Products are archived, never deleted, once they appear in an order —
 * an order's snapshot must keep resolving for reporting. That guard is
 * added with the Orders collection, since it has nothing to check against
 * until orders exist.
 */
export const Products: CollectionConfig = {
  slug: "products",
  admin: {
    group: "Shop",
    useAsTitle: "name",
    defaultColumns: ["name", "priceFils", "category", "available", "featured"],
    description: "The arrangements for sale.",
    listSearchableFields: ["name", "slug", "shortDescription"],
  },
  access: {
    /* Public sees only available products, enforced as a database query so
       an unavailable product cannot be reached by guessing its id. */
    read: publicReadWhenLive("available"),
    /* Staff are read-only on the catalogue for now, as instructed: they
       must not be able to change pricing or availability. docs/SECURITY.md §3
       anticipates granting them gallery + description later; that is a
       field-level widening of `update`, not a change to this line. */
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [validateProductState],
  },
  defaultSort: "sortOrder",
  fields: [
    /* ---------- Identity ---------- */
    {
      name: "name",
      type: "text",
      required: true,
      maxLength: 140,
      admin: { description: "The name customers see, e.g. Amber Hour." },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [generateSlugFrom("name")] },
      validate: validateSlug,
      admin: {
        position: "sidebar",
        description:
          "Page address: /product/<slug>. Generated from the name. Changing it breaks live links and past emails.",
      },
    },
    {
      name: "shortDescription",
      type: "textarea",
      maxLength: 200,
      admin: {
        description: "One or two lines for product cards and search results. Max 200 characters.",
      },
    },
    {
      name: "description",
      type: "richText",
      admin: { description: "The full story on the product page." },
    },

    /* ---------- Money ---------- */
    filsField({
      name: "priceFils",
      required: true,
      label: "Price (fils)",
      admin: {
        description:
          "Amount in fils (AED × 100). 48000 = AED 480.00. This is the price customers pay.",
      },
    }),
    filsField({
      name: "compareAtPriceFils",
      label: "Compare-at price (fils)",
      admin: {
        description:
          "Optional crossed-out 'was' price. Must be higher than the price. Leave empty if not on offer.",
      },
    }),
    {
      name: "currency",
      type: "select",
      required: true,
      defaultValue: "AED",
      options: [{ label: "UAE Dirham (AED)", value: "AED" }],
      admin: {
        position: "sidebar",
        readOnly: true,
        description:
          "AED only. Multi-currency is deliberately out of scope (docs/ARCHITECTURE.md §9).",
      },
    },

    /* ---------- Classification ---------- */
    {
      name: "category",
      type: "select",
      required: true,
      index: true,
      defaultValue: "bouquet",
      options: [
        { label: "Bouquet", value: "bouquet" },
        { label: "Vase arrangement", value: "vase-arrangement" },
        { label: "Box arrangement", value: "box-arrangement" },
        { label: "Basket", value: "basket" },
        { label: "Single stem", value: "single-stem" },
        { label: "Plant", value: "plant" },
        { label: "Event piece", value: "event-piece" },
      ],
      admin: { description: "The shape of the arrangement." },
    },
    {
      name: "flowers",
      type: "select",
      hasMany: true,
      options: [
        { label: "Roses", value: "roses" },
        { label: "Peonies", value: "peonies" },
        { label: "Orchids", value: "orchids" },
        { label: "Tulips", value: "tulips" },
        { label: "Lilies", value: "lilies" },
        { label: "Wildflowers", value: "wildflowers" },
      ],
      admin: { description: "Drives the storefront's flower filter." },
    },
    {
      name: "occasions",
      type: "relationship",
      relationTo: "occasions",
      hasMany: true,
      index: true,
      admin: { description: "Which occasion pages this product appears on." },
    },

    /* ---------- Imagery ---------- */
    {
      name: "images",
      type: "array",
      minRows: 1,
      maxRows: 8,
      required: true,
      labels: { singular: "Image", plural: "Images" },
      admin: {
        description: "The first image is the one shown on cards and in search results.",
      },
      fields: [
        { name: "image", type: "upload", relationTo: "media", required: true },
      ],
    },

    /* ---------- Merchandising & stock ---------- */
    {
      name: "available",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: {
        position: "sidebar",
        description: "Unticked keeps it off the website entirely. New products start hidden.",
      },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: { position: "sidebar", description: "Shows in the homepage featured row." },
    },
    {
      name: "bestseller",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: { position: "sidebar", description: "Shows in the Best Sellers row." },
    },
    {
      name: "seasonal",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Availability depends on the season — shown with a seasonal note.",
      },
    },
    {
      name: "trackStock",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Tick to enforce a stock count. Most made-to-order arrangements do not.",
      },
    },
    {
      name: "stock",
      type: "number",
      min: 0,
      defaultValue: 0,
      admin: {
        position: "sidebar",
        condition: (data) => Boolean(data?.trackStock),
        description: "Units on hand. Cannot be negative.",
      },
      validate: (value: number | null | undefined) => {
        if (value === null || value === undefined) return true;
        if (!Number.isInteger(value)) return "Stock must be a whole number.";
        if (value < 0) return "Stock cannot be negative.";
        return true;
      },
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
      index: true,
      admin: { position: "sidebar", description: "Lower numbers appear first." },
    },

    /* ---------- SEO ---------- */
    {
      name: "seo",
      type: "group",
      label: "SEO",
      admin: { description: "Optional. Falls back to the name and short description." },
      fields: [
        { name: "title", type: "text", maxLength: 70, admin: { description: "Max ~60 characters." } },
        {
          name: "description",
          type: "textarea",
          maxLength: 180,
          admin: { description: "Max ~155 characters shows in full on Google." },
        },
        { name: "image", type: "upload", relationTo: "media", label: "Social share image" },
        {
          name: "noIndex",
          type: "checkbox",
          defaultValue: false,
          label: "Hide from search engines",
          /* Admin-only: a staff member should not be able to quietly
             de-index a product from Google. */
          access: { create: isAdminField, update: isAdminField },
        },
      ],
    },
  ],
};
