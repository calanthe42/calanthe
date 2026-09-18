import type { CollectionConfig } from "payload";
import { isAdmin, isAdminField, isStaff, isStaffField } from "@backend/payload/access";
import { filsField } from "@backend/payload/fields/money";

/**
 * Event and large-order enquiries: weddings, corporate work, engagements,
 * private parties, venue florals, custom orders.
 *
 * NOT the same thing as `occasions`. An occasion is a browsing category on
 * the shop ("Birthday"); an event is a real request from a real person that
 * someone has to answer, quote and deliver. They share vocabulary and
 * nothing else.
 *
 * This is a work queue, so it is modelled as one: a status with a defined
 * progression, an owner, internal notes, and a quote. The public enquiry
 * form will write here later through a rate-limited server route — NOT by
 * opening `create` to the public, which would be an open spam funnel into
 * the business's inbox. Until that route exists, `create` is internal only.
 *
 * PII: this collection holds names, emails, phone numbers and event
 * addresses for people who may never become customers. It is staff-visible
 * because staff must answer it; it is never public-readable.
 */
export const Events: CollectionConfig = {
  slug: "events",
  labels: { singular: "Event Enquiry", plural: "Events" },
  admin: {
    group: "Enquiries",
    useAsTitle: "name",
    defaultColumns: ["name", "eventType", "eventDate", "status", "assignedStaff"],
    description: "Wedding, corporate and large-order requests.",
    listSearchableFields: ["name", "email", "company", "eventLocation"],
  },
  access: {
    /* No public read: this is other people's personal data. */
    read: isStaff,
    /* Internal only for now. The public form arrives via a rate-limited
       route that writes with overrideAccess, exactly as customer
       registration does — deny-by-default is never widened for convenience. */
    create: isStaff,
    /* Staff answer enquiries, so they may update them. Money and deletion
       are protected below and above respectively. */
    update: isStaff,
    /* An enquiry is a business record. Cancelling is a status, not a
       deletion, and only an admin may remove a row outright. */
    delete: isAdmin,
  },
  defaultSort: "-createdAt",
  timestamps: true,
  fields: [
    /* ---------- Who is asking ---------- */
    {
      type: "collapsible",
      label: "Requester",
      fields: [
        { name: "name", type: "text", required: true, maxLength: 140 },
        {
          name: "email",
          type: "email",
          required: true,
          index: true,
          admin: { description: "Where the quote is sent." },
        },
        {
          name: "phone",
          type: "text",
          required: true,
          validate: (value: string | null | undefined) => {
            if (!value) return "A phone number is required for event enquiries.";
            return /^\+[1-9]\d{7,14}$/.test(value)
              ? true
              : "Enter the number in international format, e.g. +971501234567";
          },
          admin: { description: "International format, e.g. +971501234567" },
        },
        {
          name: "company",
          type: "text",
          maxLength: 140,
          admin: { description: "For corporate enquiries. Leave empty for private clients." },
        },
      ],
    },

    /* ---------- The event ---------- */
    {
      type: "collapsible",
      label: "Event details",
      fields: [
        {
          name: "eventType",
          type: "select",
          required: true,
          index: true,
          options: [
            { label: "Wedding", value: "wedding" },
            { label: "Corporate event", value: "corporate" },
            { label: "Birthday", value: "birthday" },
            { label: "Engagement", value: "engagement" },
            { label: "Private event", value: "private" },
            { label: "Event floral decoration", value: "decoration" },
            { label: "Large / custom order", value: "large-order" },
            { label: "Other", value: "other" },
          ],
        },
        {
          name: "eventDate",
          type: "date",
          index: true,
          admin: {
            date: { pickerAppearance: "dayOnly", displayFormat: "d MMM yyyy" },
            description: "Leave empty if the client has not fixed a date.",
          },
        },
        {
          name: "eventLocation",
          type: "text",
          maxLength: 240,
          admin: { description: "Venue and emirate, as the client described it." },
        },
        {
          name: "estimatedGuests",
          type: "number",
          min: 0,
          validate: (value: number | null | undefined) => {
            if (value === null || value === undefined) return true;
            if (!Number.isInteger(value)) return "Enter a whole number of guests.";
            if (value < 0) return "Guest count cannot be negative.";
            return true;
          },
        },
        filsField({
          name: "budgetFils",
          label: "Client budget (fils)",
          admin: {
            description:
              "What the client says they want to spend, in fils (AED × 100). Optional — many will not say.",
          },
        }),
        {
          name: "requestedServices",
          type: "select",
          hasMany: true,
          options: [
            { label: "Bridal bouquet", value: "bridal-bouquet" },
            { label: "Ceremony florals", value: "ceremony" },
            { label: "Reception / table centrepieces", value: "centrepieces" },
            { label: "Venue installation", value: "installation" },
            { label: "Entrance / arch", value: "arch" },
            { label: "Buttonholes & corsages", value: "buttonholes" },
            { label: "Guest favours", value: "favours" },
            { label: "Delivery & setup", value: "setup" },
            { label: "Teardown", value: "teardown" },
          ],
        },
        {
          name: "description",
          type: "textarea",
          required: true,
          maxLength: 4000,
          admin: { description: "What the client asked for, in their own words." },
        },
        {
          name: "inspirationImages",
          type: "array",
          maxRows: 12,
          labels: { singular: "Inspiration image", plural: "Inspiration images" },
          fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
        },
      ],
    },

    /* ---------- Managing it ---------- */
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "NEW",
      index: true,
      options: [
        { label: "New", value: "NEW" },
        { label: "Contacted", value: "CONTACTED" },
        { label: "Quoted", value: "QUOTED" },
        { label: "Confirmed", value: "CONFIRMED" },
        { label: "In progress", value: "IN_PROGRESS" },
        { label: "Completed", value: "COMPLETED" },
        { label: "Cancelled", value: "CANCELLED" },
      ],
      admin: { position: "sidebar", description: "Where this enquiry has got to." },
    },
    {
      name: "assignedStaff",
      type: "relationship",
      relationTo: "users",
      index: true,
      /* Only internal users can own an enquiry — a customer must never
         appear in this list. Enforced as a query, not a UI convention. */
      filterOptions: () => ({ role: { in: ["admin", "staff"] } }),
      admin: { position: "sidebar", description: "Who is answering this." },
    },
    filsField({
      name: "quoteAmountFils",
      label: "Quote (fils)",
      /* Money is admin-only to write. Staff progress the work and talk to
         the client; what the business charges is the owner's decision. */
      access: { create: isAdminField, update: isAdminField },
      admin: {
        position: "sidebar",
        description: "The quoted total in fils (AED × 100). Admin only.",
      },
    }),
    {
      name: "internalNotes",
      type: "textarea",
      maxLength: 8000,
      /* Staff may add notes — that is most of the job. Never shown to the
         client and never included in any email. */
      admin: {
        description: "Internal only. Never sent to the client.",
      },
    },
    {
      name: "source",
      type: "text",
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "The page the enquiry was submitted from. Set by the website.",
      },
      access: { create: isStaffField, update: () => false },
    },
  ],
};
