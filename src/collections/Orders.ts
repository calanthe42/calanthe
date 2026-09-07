import type { CollectionConfig } from "payload";
import {
  immutableAfterCreate,
  isAdmin,
  isStaff,
  isStaffField,
  isStaffOrOwnerOf,
  nobody,
} from "@backend/payload/access";
import { filsField } from "@backend/payload/fields/money";
import {
  guardPaymentStatus,
  validateCustomerType,
  validateOrderTotals,
} from "@backend/payload/hooks/orderIntegrity";
import { assignOrderNumber } from "@backend/payload/hooks/orderNumber";

/**
 * An order is an immutable historical record, not a set of pointers.
 *
 * Every commercially significant value is COPIED here at creation, never
 * referenced. Renaming a product, repricing it or archiving it tomorrow must
 * not change what a customer paid today, what their receipt says, or what
 * the accounts show (docs/ARCHITECTURE.md §6, docs/DATABASE.md §9).
 *
 * The `product` relationship is kept as well — but for reporting only ("how
 * many Amber Hour did we sell?"). No display, price or receipt path may read
 * through it.
 *
 * GUEST AND REGISTERED, one table. `customer` is null for a guest; the
 * contact snapshot is required either way, so fulfilment never depends on an
 * account existing. `customerType` makes the intent explicit and is enforced
 * against `customer` by validateCustomerType.
 *
 * IMMUTABILITY is enforced server-side by field-level access
 * (`immutableAfterCreate`), which strips edits from every role — admin
 * included — through both the admin panel and the REST API. It is not a UI
 * convention and cannot be bypassed from a browser.
 */
export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Order", plural: "Orders" },
  admin: {
    group: "Orders",
    useAsTitle: "orderNumber",
    defaultColumns: [
      "orderNumber",
      "customerName",
      "totalFils",
      "fulfilmentStatus",
      "paymentStatus",
      "deliveryDate",
    ],
    description: "Placed orders. The snapshot is permanent; only fulfilment moves.",
    listSearchableFields: ["orderNumber", "customerName", "customerEmail", "customerPhone"],
  },
  access: {
    /* Staff see everything; a signed-in customer sees only their own, as a
       database constraint. Guest orders (customer null) match no customer,
       so they are reachable by staff and the server only. */
    read: isStaffOrOwnerOf("customer"),
    /* Checkout will create orders server-side with overrideAccess. Admin
       retains create for testing; staff do not invent orders by hand. */
    create: isAdmin,
    update: isStaff,
    /* NOBODY deletes an order — not staff, not admin. An order is an
       accounting record; cancelling is a status (CANCELLED), not a deletion.
       docs/DATABASE.md §8 and docs/SECURITY.md §3 both state this. If the
       business ever needs a row gone (a GDPR-style erasure), that is a
       deliberate server-side anonymisation, not a delete button. */
    delete: nobody,
  },
  hooks: {
    beforeValidate: [validateOrderTotals, validateCustomerType],
    beforeChange: [assignOrderNumber, guardPaymentStatus],
  },
  defaultSort: "-createdAt",
  timestamps: true,
  fields: [
    /* ---------------- Identity ---------------- */
    {
      name: "orderNumber",
      type: "text",
      unique: true,
      index: true,
      access: { create: isStaffField, update: () => false },
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Assigned automatically from a Postgres sequence. Never reused.",
      },
    },

    /* ---------------- Who ordered ---------------- */
    {
      type: "collapsible",
      label: "Customer (snapshot)",
      admin: {
        description:
          "Copied at checkout. Editing the customer's profile later never changes these.",
      },
      fields: [
        {
          name: "customerType",
          type: "select",
          required: true,
          defaultValue: "guest",
          index: true,
          options: [
            { label: "Guest", value: "guest" },
            { label: "Registered", value: "registered" },
          ],
          access: immutableAfterCreate,
        },
        {
          name: "customer",
          type: "relationship",
          relationTo: "users",
          index: true,
          /* Null for guests — that is the whole point of guest checkout.
             Restricted to customers so an order cannot be attributed to a
             staff account by mistake. */
          filterOptions: () => ({ role: { equals: "customer" } }),
          access: immutableAfterCreate,
          admin: { description: "Empty for guest orders." },
        },
        {
          name: "customerName",
          type: "text",
          required: true,
          maxLength: 140,
          access: immutableAfterCreate,
        },
        {
          name: "customerEmail",
          type: "email",
          required: true,
          index: true,
          access: immutableAfterCreate,
        },
        {
          name: "customerPhone",
          type: "text",
          required: true,
          index: true,
          access: immutableAfterCreate,
          validate: (value: string | null | undefined) => {
            if (!value) return "A contact phone number is required.";
            return /^\+[1-9]\d{7,14}$/.test(value)
              ? true
              : "Enter the number in international format, e.g. +971501234567";
          },
        },
      ],
    },

    /* ---------------- Where it goes ---------------- */
    {
      type: "collapsible",
      label: "Delivery (snapshot)",
      fields: [
        {
          name: "deliveryAddress",
          type: "textarea",
          required: true,
          maxLength: 600,
          access: immutableAfterCreate,
        },
        {
          name: "deliveryEmirate",
          type: "select",
          required: true,
          index: true,
          options: [
            { label: "Abu Dhabi", value: "abu-dhabi" },
            { label: "Dubai", value: "dubai" },
            { label: "Sharjah", value: "sharjah" },
            { label: "Ajman", value: "ajman" },
            { label: "Umm Al Quwain", value: "umm-al-quwain" },
            { label: "Ras Al Khaimah", value: "ras-al-khaimah" },
            { label: "Fujairah", value: "fujairah" },
          ],
          access: immutableAfterCreate,
        },
        {
          name: "deliveryDate",
          type: "date",
          required: true,
          index: true,
          access: immutableAfterCreate,
          admin: { date: { pickerAppearance: "dayOnly", displayFormat: "d MMM yyyy" } },
        },
        {
          name: "deliveryTimeSlot",
          type: "text",
          required: true,
          maxLength: 60,
          access: immutableAfterCreate,
          admin: { description: 'As sold to the customer, e.g. "13:00 – 17:00".' },
        },
        {
          name: "deliveryNotes",
          type: "textarea",
          maxLength: 600,
          access: immutableAfterCreate,
          admin: { description: "Directions the customer gave. Not internal notes." },
        },
      ],
    },

    /* ---------------- Recipient & gift ---------------- */
    {
      type: "collapsible",
      label: "Recipient & gift (snapshot)",
      admin: {
        description:
          "The recipient is often not the buyer. Never show them a price — see the gift rule in docs/EMAILS.md.",
      },
      fields: [
        {
          name: "recipientName",
          type: "text",
          maxLength: 140,
          access: immutableAfterCreate,
          admin: { description: "Empty means the buyer is the recipient." },
        },
        {
          name: "recipientPhone",
          type: "text",
          access: immutableAfterCreate,
          validate: (value: string | null | undefined) => {
            if (!value) return true;
            return /^\+[1-9]\d{7,14}$/.test(value)
              ? true
              : "Enter the number in international format, e.g. +971501234567";
          },
        },
        {
          name: "cardMessage",
          type: "textarea",
          maxLength: 300,
          access: immutableAfterCreate,
          admin: { description: "Handwritten onto the card exactly as typed." },
        },
      ],
    },

    /* ---------------- What was bought ---------------- */
    {
      name: "items",
      type: "array",
      required: true,
      minRows: 1,
      labels: { singular: "Item", plural: "Items" },
      access: immutableAfterCreate,
      admin: {
        description:
          "Frozen at checkout. Product name, slug and price are copies — renaming or repricing the product never changes them.",
      },
      fields: [
        {
          name: "product",
          type: "relationship",
          relationTo: "products",
          /* Reporting only. No display, price or receipt path reads through
             this — the snapshot fields below are the truth. Nullable so an
             order survives a product being removed from the catalogue. */
          admin: { description: "Reporting link only. Never read for display or price." },
        },
        { name: "productName", type: "text", required: true, maxLength: 140 },
        { name: "productSlug", type: "text", required: true, maxLength: 140 },
        { name: "quantity", type: "number", required: true, min: 1 },
        filsField({ name: "unitPriceFils", required: true, label: "Unit price (fils)" }),
        filsField({ name: "lineTotalFils", required: true, label: "Line total (fils)" }),
        {
          name: "selectedOptions",
          type: "array",
          labels: { singular: "Option", plural: "Options" },
          admin: { description: 'Size, add-ons, e.g. "Size: Deluxe".' },
          fields: [
            { name: "label", type: "text", required: true, maxLength: 80 },
            { name: "value", type: "text", required: true, maxLength: 140 },
          ],
        },
      ],
    },

    /* ---------------- Money ---------------- */
    {
      type: "collapsible",
      label: "Totals (snapshot)",
      admin: {
        description:
          "Written once and reconciled server-side. No role, including admin, can edit these.",
      },
      fields: [
        filsField({
          name: "subtotalFils",
          required: true,
          label: "Subtotal (fils)",
          access: immutableAfterCreate,
        }),
        filsField({
          name: "deliveryFeeFils",
          required: true,
          label: "Delivery fee (fils)",
          access: immutableAfterCreate,
        }),
        filsField({
          name: "discountFils",
          required: true,
          label: "Discount (fils)",
          access: immutableAfterCreate,
        }),
        filsField({
          name: "totalFils",
          required: true,
          label: "Total (fils)",
          index: true,
          access: immutableAfterCreate,
        }),
        {
          name: "currency",
          type: "select",
          required: true,
          defaultValue: "AED",
          options: [{ label: "UAE Dirham (AED)", value: "AED" }],
          access: immutableAfterCreate,
          admin: { readOnly: true },
        },
        {
          name: "couponCode",
          type: "text",
          maxLength: 40,
          index: true,
          access: immutableAfterCreate,
        },
        filsField({
          name: "couponDiscountFils",
          label: "Coupon discount (fils)",
          access: immutableAfterCreate,
        }),
      ],
    },

    /* ---------------- Status: two axes, never merged ---------------- */
    {
      name: "fulfilmentStatus",
      type: "select",
      required: true,
      defaultValue: "NEW",
      index: true,
      options: [
        { label: "New", value: "NEW" },
        { label: "Confirmed", value: "CONFIRMED" },
        { label: "Preparing", value: "PREPARING" },
        { label: "Ready", value: "READY" },
        { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
        { label: "Delivered", value: "DELIVERED" },
        { label: "Cancelled", value: "CANCELLED" },
      ],
      /* The one thing staff genuinely own: where the flowers are. */
      admin: { position: "sidebar", description: "Where the order is in the workshop." },
    },
    {
      name: "paymentStatus",
      type: "select",
      required: true,
      defaultValue: "PENDING",
      index: true,
      options: [
        { label: "Pending", value: "PENDING" },
        { label: "Authorized", value: "AUTHORIZED" },
        { label: "Paid", value: "PAID" },
        { label: "Failed", value: "FAILED" },
        { label: "Refunded", value: "REFUNDED" },
        { label: "Partially refunded", value: "PARTIALLY_REFUNDED" },
      ],
      /* Not editable by ANY role. Money state arrives from the payment
         provider's webhook and nowhere else; guardPaymentStatus covers the
         overrideAccess path too. There is deliberately nothing to click. */
      access: { create: isStaffField, update: () => false },
      admin: {
        position: "sidebar",
        readOnly: true,
        description:
          "Set by the payment provider only. Stays PENDING until Stripe/Tabby is connected.",
      },
    },

    /* ---------------- Internal management ---------------- */
    {
      name: "assignedStaff",
      type: "relationship",
      relationTo: "users",
      index: true,
      /* Only internal users can own an order. Enforced as a query so a
         customer can never be assigned, whatever the UI sends. */
      filterOptions: () => ({ role: { in: ["admin", "staff"] } }),
      admin: { position: "sidebar", description: "Who is making this." },
    },
    {
      name: "internalNotes",
      type: "textarea",
      maxLength: 8000,
      /* Staff write these constantly — it is most of the job. Never shown to
         a customer and never included in any email. */
      admin: { description: "Internal only. Never sent to the customer." },
    },
    {
      name: "source",
      type: "text",
      maxLength: 80,
      access: immutableAfterCreate,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: 'Where the order came from, e.g. "web-checkout", "phone".',
      },
    },
  ],
};
