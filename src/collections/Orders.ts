import type { CollectionConfig } from "payload";
import {
  immutableAfterCreate,
  isAdmin,
  isStaff,
  isStaffField,
  isStaffOrOwnerOf,
  nobody,
  serverOnlyField,
} from "@backend/payload/access";
import { filsField } from "@backend/payload/fields/money";
import {
  guardInvoiceNumber,
  guardPaymentStatus,
  guardUnpaidQuoteFulfilment,
  validateBespokeLines,
  validateCustomerType,
  validateOrderTotals,
} from "@backend/payload/hooks/orderIntegrity";
import { assignOrderNumber } from "@backend/payload/hooks/orderNumber";
import { MANUAL_SOURCE, OUTSIDE_PAYMENT_METHODS, SALES_CHANNELS } from "@backend/payments/pay-link";

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
    listSearchableFields: [
      "orderNumber",
      "customerName",
      "customerEmail",
      "customerPhone",
      "couponCode",
    ],
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
    beforeValidate: [validateOrderTotals, validateBespokeLines, validateCustomerType],
    beforeChange: [
      assignOrderNumber,
      guardPaymentStatus,
      guardInvoiceNumber,
      guardUnpaidQuoteFulfilment,
    ],
    /* NO EMAIL HOOK HERE, DELIBERATELY. A hook that sends the status email
       runs inside Payload's transaction and writes an email_log row through
       a second connection — the outer transaction holds one while the inner
       write waits for another, and the database ends it with
       "terminating connection due to idle-in-transaction timeout". The send
       lives in backend/email/status-email.ts and is called by the action
       AFTER the update returns, exactly as checkout does. */
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
    {
      name: "enquiry",
      type: "relationship",
      relationTo: "enquiries",
      index: true,
      /* Set once, when a florist confirms an enquiry and asks for payment
         (backend/actions/quotes.ts). Staff-read only: a customer reading
         their own order through REST has no business following it back into
         the lead queue. */
      access: { ...immutableAfterCreate, read: isStaffField },
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "The enquiry this payment request was confirmed from. Empty for shop orders.",
      },
    },
    {
      name: "locale",
      type: "select",
      defaultValue: "en",
      options: [
        { label: "English", value: "en" },
        { label: "العربية", value: "ar" },
      ],
      access: immutableAfterCreate,
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "The language the customer is written to.",
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
          /* A text column with its own rule rather than `type: "email"`:
             an order written by hand in the admin (a WhatsApp or phone
             sale) may have NO email, stored as the empty string. Every
             other order must have a real address, exactly as before. */
          type: "text",
          required: true,
          maxLength: 200,
          index: true,
          access: immutableAfterCreate,
          validate: (
            value: string | null | undefined,
            { data }: { data?: Partial<{ source: string | null }> },
          ) => {
            const email = (value ?? "").trim();
            if (email === "") {
              return data?.source === MANUAL_SOURCE ? true : "An email address is required.";
            }
            return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? true : "Enter a valid email address.";
          },
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
        {
          name: "customerNote",
          type: "textarea",
          maxLength: 600,
          access: immutableAfterCreate,
          admin: { description: "Shown to the customer in the payment email and page." },
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
        /* ---- Sale snapshot ----
           `unitPriceFils` above is what was PAID per unit, the sale already
           applied. These record what it would have cost and what the sale
           was called, copied at checkout so the receipt reads the same after
           the sale has ended, been edited or been deleted. */
        filsField({
          name: "compareAtUnitPriceFils",
          label: "Regular unit price (fils)",
          admin: {
            description:
              "The full unit price before the sale (arrangement + add-ons). Empty when the line was not on sale.",
          },
        }),
        { name: "saleLabelEn", type: "text", maxLength: 28 },
        { name: "saleLabelAr", type: "text", maxLength: 28 },
        {
          name: "sale",
          type: "relationship",
          relationTo: "discounts",
          /* Reporting only, like `product` above — and staff-read only: a
             customer reading their own order through REST must not be handed
             a pointer into the owner's discount list. */
          access: { read: isStaffField },
          admin: { description: "Reporting link only. Never read for display or price." },
        },
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
        {
          name: "couponDiscount",
          type: "relationship",
          relationTo: "discounts",
          index: true,
          /* Reporting link, and the row the webhook counts a use against
             (backend/payments/redeem.ts). Staff-read only. */
          access: { ...immutableAfterCreate, read: isStaffField },
          admin: { readOnly: true, description: "The discount code this order used." },
        },
        {
          name: "discountSnapshot",
          type: "json",
          /* WHY the discount was that amount: the rule's terms as they stood
             at checkout — { coupon: {...} | null, sales: [...] }. It carries
             the owner's INTERNAL titles, so it is staff-read only; what a
             customer may see is in couponCode and the line labels. Present
             only on an order that had a sale or a code. */
          access: { ...immutableAfterCreate, read: isStaffField },
          admin: { readOnly: true, description: "The discount rules as they stood at checkout." },
        },
        {
          name: "couponRedeemedAt",
          type: "date",
          /* Set by one SQL statement when the order is PAID, and that
             statement is also what makes counting a use exactly-once. */
          access: { create: () => false, update: () => false },
          admin: {
            readOnly: true,
            date: { pickerAppearance: "dayAndTime" },
            description: "When this order was counted as a use of its code.",
          },
        },
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

    /* ---------------- Payment link & invoice ----------------
     *
     * Written by the server only (overrideAccess inside a trusted path):
     * backend/actions/quotes.ts mints the link, backend/payments/intent.ts
     * stores the PaymentIntent, backend/payments/invoice-number.ts allocates
     * the invoice. Nothing here can be authored through REST, GraphQL or
     * /cms by any role.
     *
     * The salt and the hash are unreadable too: the link itself is
     * HMAC(PAYLOAD_SECRET, salt), so neither the database alone nor an API
     * read can ever yield a working link. */
    {
      name: "payTokenSalt",
      type: "text",
      access: { create: serverOnlyField, read: serverOnlyField, update: serverOnlyField },
      admin: { hidden: true },
    },
    {
      name: "payTokenHash",
      type: "text",
      unique: true,
      index: true,
      access: { create: serverOnlyField, read: serverOnlyField, update: serverOnlyField },
      admin: { hidden: true },
    },
    {
      name: "payLinkExpiresAt",
      type: "date",
      access: { create: isStaffField, read: isStaffField, update: serverOnlyField },
      admin: {
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
        description: "When the emailed payment link stops accepting payment.",
      },
    },
    {
      name: "stripePaymentIntentId",
      type: "text",
      index: true,
      /* Staff-read only. Stored the moment the intent is created, because
         Stripe forgets an idempotency key after about a day: this id is what
         stops a second intent — and a second charge — on a link that lives
         for a week. The webhook refuses any other intent for this order. */
      access: { create: serverOnlyField, read: isStaffField, update: serverOnlyField },
      admin: { readOnly: true, description: "The one Stripe PaymentIntent for this order." },
    },
    {
      name: "paidAt",
      type: "date",
      index: true,
      access: { create: serverOnlyField, update: serverOnlyField },
      admin: {
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
        description:
          "When Stripe's signed webhook confirmed the money, or when the owner recorded a payment taken outside the website.",
      },
    },
    /* ---------------- Orders written by hand (WhatsApp, phone) ----------------
     *
     * Plain text columns held to their lists by `validate`, so a new channel
     * or method is a one-line change and never a database type change.
     * All three are written by the server only: backend/actions/
     * manual-orders.ts sets the channel at creation and the method when the
     * OWNER records a payment taken outside the website. An empty method on
     * a paid order means the card, through Stripe. */
    {
      name: "salesChannel",
      type: "text",
      maxLength: 40,
      access: { create: serverOnlyField, update: serverOnlyField, read: isStaffField },
      validate: (value: string | null | undefined) =>
        !value || (SALES_CHANNELS as readonly string[]).includes(value) ? true : "Unknown sales channel.",
      admin: { readOnly: true, description: "Where a hand-written order came from: WhatsApp, phone…" },
    },
    {
      name: "paymentMethod",
      type: "text",
      maxLength: 40,
      access: { create: serverOnlyField, update: serverOnlyField },
      validate: (value: string | null | undefined) =>
        !value || (OUTSIDE_PAYMENT_METHODS as readonly string[]).includes(value)
          ? true
          : "Unknown payment method.",
      admin: {
        readOnly: true,
        description: "Set only when the owner records a payment taken outside the website.",
      },
    },
    {
      name: "paymentReference",
      type: "text",
      maxLength: 140,
      access: { create: serverOnlyField, update: serverOnlyField, read: isStaffField },
      admin: { readOnly: true, description: "The owner's note for that payment, e.g. a transfer reference." },
    },
    {
      name: "invoiceNumber",
      type: "text",
      unique: true,
      index: true,
      access: { create: serverOnlyField, update: serverOnlyField },
      admin: {
        readOnly: true,
        description: "CAL-INV-YYYY-NNNNN. Gap-free, allocated once when the order is paid.",
      },
    },
    {
      name: "vatRateBps",
      type: "number",
      defaultValue: 0,
      access: { create: serverOnlyField, update: serverOnlyField },
      admin: {
        readOnly: true,
        description: "VAT rate in basis points, frozen at payment. 500 = 5%. 0 = not VAT-registered.",
      },
    },
    filsField({
      name: "vatIncludedFils",
      label: "VAT included (fils)",
      defaultValue: 0,
      access: { create: serverOnlyField, update: serverOnlyField },
      admin: { readOnly: true },
    }),

    /* ---------------- Internal management ----------------
     *
     * READ-RESTRICTED, NOT ONLY WRITE-RESTRICTED. `read` on this collection
     * lets a signed-in customer fetch their own order through Payload's REST
     * and GraphQL endpoints. Without a field-level rule that response would
     * carry the florist's private notes ("PAYMENT CHECK", "refund in
     * Stripe") and who is making the order. */
    {
      name: "assignedStaff",
      type: "relationship",
      relationTo: "users",
      index: true,
      access: { read: isStaffField },
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
      access: { read: isStaffField },
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
        description:
          'Where the order came from, e.g. "web-checkout-card", "phone", or "admin-quote" for a confirmed enquiry paid by link.',
      },
    },
  ],
};
