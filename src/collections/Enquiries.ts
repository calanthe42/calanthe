import type { CollectionConfig } from "payload";
import {
  immutableAfterCreate,
  isAdminField,
  isStaff,
  isStaffField,
  isStaffOrOwnerOf,
  nobody,
} from "@backend/payload/access";
import { filsField } from "@backend/payload/fields/money";
import {
  assignEnquiryNumber,
  preventMembershipAutoActivation,
  stampResolvedAt,
  validateEnquiryDates,
} from "@backend/payload/hooks/enquiryIntegrity";

/** Only render a group for the enquiry type it belongs to. */
const whenType = (type: string) => (data: Record<string, unknown> | undefined) =>
  data?.type === type;

/**
 * Every lead that reaches Calanthe before money changes hands.
 *
 * ONE COLLECTION, NOT FIVE. Build-your-own, events, memberships, contact and
 * custom requests share an identical spine — who asked, what about, who owns
 * it, what state is it in, when do we chase it — and differ only in a
 * handful of detail fields. Five tables would mean five access surfaces,
 * five sets of status logic, and five places to look for "what came in
 * today" (docs/DATABASE.md §12 reached the same conclusion). The `type`
 * discriminator plus conditional field groups keeps one queue.
 *
 * NOT ORDERS. An enquiry is a conversation; an order is a contract. Nothing
 * here is immutable except the reference number and the contact snapshot,
 * because an enquiry is expected to be edited as it is worked.
 *
 * NOT EVENTS. The Events collection already models a booked event in
 * detail. An EVENT-type enquiry LINKS to an Events row via `relatedEvent`
 * rather than restating venue, guest count and services — one place to edit,
 * no drift.
 *
 * PUBLIC SUBMISSION IS DELIBERATELY NOT ENABLED. `create` is internal-only.
 * The website form will post to a rate-limited server route that validates,
 * checks a spam signal and writes with `overrideAccess`. Making the
 * collection publicly writable instead would be an open funnel straight into
 * the business's work queue.
 */
export const Enquiries: CollectionConfig = {
  slug: "enquiries",
  labels: { singular: "Enquiry", plural: "Enquiries" },
  admin: {
    group: "Enquiries",
    useAsTitle: "enquiryNumber",
    defaultColumns: ["enquiryNumber", "type", "subject", "status", "priority", "assignedStaff"],
    description: "Every lead: build-your-own, events, memberships, contact, custom requests.",
    listSearchableFields: ["enquiryNumber", "subject", "contactName", "contactEmail", "contactPhone"],
  },
  access: {
    /* Staff see the whole queue; a signed-in customer sees only their own,
       as a database-level constraint. Guest enquiries (customer null) match
       no customer and are reachable by staff and the server only. */
    read: isStaffOrOwnerOf("customer"),
    /* Internal only for now — see the note above about public submission. */
    create: isStaff,
    /* Staff work the queue. Customers cannot update at all: the sensitive
       fields (status, priority, assignment, notes, ownership) are therefore
       unreachable to them by construction, not by field-by-field patching.
       Field-level rules below still protect against a widened `update`. */
    update: isStaff,
    /* A lead is a business record. Resolution is a status — SPAM, CANCELLED,
       RESOLVED — never a delete, so the funnel can still be measured. */
    delete: nobody,
  },
  hooks: {
    beforeValidate: [validateEnquiryDates, preventMembershipAutoActivation],
    beforeChange: [assignEnquiryNumber, stampResolvedAt],
  },
  defaultSort: "-createdAt",
  timestamps: true,
  fields: [
    {
      name: "enquiryNumber",
      type: "text",
      unique: true,
      index: true,
      /* Immutable for every role. Also guarded in assignEnquiryNumber for
         the overrideAccess path. */
      access: { create: isStaffField, update: () => false },
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Assigned automatically from a Postgres sequence. Never reused.",
      },
    },
    {
      name: "type",
      type: "select",
      required: true,
      index: true,
      defaultValue: "CONTACT",
      options: [
        { label: "Build your own", value: "BUILD_YOUR_OWN" },
        { label: "Event", value: "EVENT" },
        { label: "Membership", value: "MEMBERSHIP" },
        { label: "Contact", value: "CONTACT" },
        { label: "Custom request", value: "CUSTOM_REQUEST" },
      ],
      /* The type decides which detail group applies, so changing it after
         creation would orphan whatever was filled in. */
      access: immutableAfterCreate,
      admin: { position: "sidebar" },
    },

    /* ---------------- Who is asking ---------------- */
    {
      type: "collapsible",
      label: "Contact (snapshot)",
      admin: {
        description:
          "Copied as submitted. A customer editing their profile later never rewrites what a lead originally told us.",
      },
      fields: [
        {
          name: "customer",
          type: "relationship",
          relationTo: "users",
          index: true,
          filterOptions: () => ({ role: { equals: "customer" } }),
          /* Ownership is set once. Staff must not be able to reassign an
             enquiry to a different person — that would hand one customer's
             private request to another. */
          access: immutableAfterCreate,
          admin: { description: "Empty for guest enquiries." },
        },
        { name: "contactName", type: "text", required: true, maxLength: 140, access: immutableAfterCreate },
        { name: "contactEmail", type: "email", required: true, index: true, access: immutableAfterCreate },
        {
          name: "contactPhone",
          type: "text",
          access: immutableAfterCreate,
          validate: (value: string | null | undefined) => {
            if (!value) return true;
            return /^\+[1-9]\d{7,14}$/.test(value)
              ? true
              : "Enter the number in international format, e.g. +971501234567";
          },
        },
        { name: "company", type: "text", maxLength: 140, access: immutableAfterCreate },
      ],
    },

    /* ---------------- The ask ---------------- */
    { name: "subject", type: "text", required: true, maxLength: 200 },
    { name: "message", type: "textarea", maxLength: 8000, admin: { description: "In the enquirer's own words." } },

    /* ---------------- BUILD YOUR OWN ---------------- */
    {
      name: "buildYourOwn",
      type: "group",
      admin: { condition: whenType("BUILD_YOUR_OWN"), description: "Incomplete requests are expected." },
      fields: [
        {
          name: "style",
          type: "select",
          options: [
            { label: "Romantic", value: "romantic" },
            { label: "Minimal", value: "minimal" },
            { label: "Wild / garden", value: "wild" },
            { label: "Structured", value: "structured" },
            { label: "Luxe", value: "luxe" },
            { label: "Not sure", value: "unsure" },
          ],
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
            { label: "Florist's choice", value: "florists-choice" },
          ],
        },
        {
          name: "colours",
          type: "select",
          hasMany: true,
          options: [
            { label: "Blush", value: "blush" },
            { label: "White & cream", value: "white-cream" },
            { label: "Burgundy", value: "burgundy" },
            { label: "Terracotta", value: "terracotta" },
            { label: "Sage & green", value: "sage" },
            { label: "Bold / bright", value: "bold" },
            { label: "Pastel", value: "pastel" },
          ],
        },
        {
          name: "size",
          type: "select",
          options: [
            { label: "Standard", value: "standard" },
            { label: "Deluxe", value: "deluxe" },
            { label: "Premium", value: "premium" },
            { label: "Statement", value: "statement" },
          ],
        },
        { name: "quantity", type: "number", min: 1 },
        filsField({ name: "budgetFils", label: "Approximate budget (fils)" }),
        { name: "deliveryDate", type: "date", index: true, admin: { date: { pickerAppearance: "dayOnly" } } },
        { name: "deliveryLocation", type: "text", maxLength: 240 },
        { name: "cardMessage", type: "textarea", maxLength: 300 },
        { name: "specialInstructions", type: "textarea", maxLength: 2000 },
        {
          name: "inspirationImages",
          type: "array",
          maxRows: 12,
          /* Reuses the existing Media collection — no second upload path. */
          fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
        },
      ],
    },

    /* ---------------- EVENT ---------------- */
    {
      name: "relatedEvent",
      type: "relationship",
      relationTo: "events",
      index: true,
      admin: {
        condition: whenType("EVENT"),
        description:
          "Link to the Events record, which holds the venue, guest count, services and dates. Not duplicated here.",
      },
    },

    /* ---------------- MEMBERSHIP ---------------- */
    {
      name: "membership",
      type: "group",
      admin: {
        condition: whenType("MEMBERSHIP"),
        description:
          "Interest only. Submitting this never activates a membership — that requires a Membership record and a payment.",
      },
      fields: [
        {
          name: "status",
          type: "select",
          defaultValue: "interest",
          options: [{ label: "Interest expressed", value: "interest" }],
          access: { create: isStaffField, update: () => false },
          admin: { readOnly: true, description: "Always 'interest'. Guarded server-side." },
        },
        {
          name: "preferredPlan",
          type: "select",
          options: [
            { label: "Monthly", value: "MONTHLY" },
            { label: "Quarterly", value: "QUARTERLY" },
            { label: "Custom", value: "CUSTOM" },
          ],
        },
        {
          name: "frequency",
          type: "select",
          options: [
            { label: "Weekly", value: "WEEKLY" },
            { label: "Fortnightly", value: "FORTNIGHTLY" },
            { label: "Monthly", value: "MONTHLY" },
          ],
        },
        {
          name: "deliveryPreference",
          type: "select",
          options: [
            { label: "Home", value: "home" },
            { label: "Office", value: "office" },
            { label: "Gift to someone else", value: "gift" },
          ],
        },
        { name: "preferredStartDate", type: "date", admin: { date: { pickerAppearance: "dayOnly" } } },
        filsField({ name: "budgetFils", label: "Budget per delivery (fils)" }),
        { name: "notes", type: "textarea", maxLength: 2000 },
      ],
    },

    /* ---------------- CUSTOM REQUEST ---------------- */
    {
      name: "customRequest",
      type: "group",
      admin: { condition: whenType("CUSTOM_REQUEST") },
      fields: [
        {
          name: "category",
          type: "select",
          options: [
            { label: "Unusual flowers", value: "unusual-flowers" },
            { label: "Large order", value: "large-order" },
            { label: "Special gift", value: "special-gift" },
            { label: "Corporate", value: "corporate" },
            { label: "Last minute", value: "last-minute" },
            { label: "Custom decoration", value: "decoration" },
            { label: "Other", value: "other" },
          ],
        },
        { name: "description", type: "textarea", maxLength: 8000 },
        filsField({ name: "budgetFils", label: "Budget (fils)" }),
        { name: "requestedDate", type: "date", index: true, admin: { date: { pickerAppearance: "dayOnly" } } },
        {
          name: "attachments",
          type: "array",
          maxRows: 12,
          fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
        },
      ],
    },

    /* ---------------- Lead management ---------------- */
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "NEW",
      index: true,
      options: [
        { label: "New", value: "NEW" },
        { label: "In review", value: "IN_REVIEW" },
        { label: "Waiting for customer", value: "WAITING_FOR_CUSTOMER" },
        { label: "Quoted", value: "QUOTED" },
        { label: "Converted", value: "CONVERTED" },
        { label: "Resolved", value: "RESOLVED" },
        { label: "Spam", value: "SPAM" },
        { label: "Cancelled", value: "CANCELLED" },
      ],
      access: { create: isStaffField, update: isStaffField },
      admin: { position: "sidebar" },
    },
    {
      name: "priority",
      type: "select",
      required: true,
      defaultValue: "NORMAL",
      index: true,
      options: [
        { label: "Low", value: "LOW" },
        { label: "Normal", value: "NORMAL" },
        { label: "High", value: "HIGH" },
        { label: "Urgent", value: "URGENT" },
      ],
      access: { create: isStaffField, update: isStaffField },
      admin: { position: "sidebar" },
    },
    {
      name: "source",
      type: "select",
      required: true,
      defaultValue: "WEBSITE",
      index: true,
      options: [
        { label: "Website", value: "WEBSITE" },
        { label: "Instagram", value: "INSTAGRAM" },
        { label: "WhatsApp", value: "WHATSAPP" },
        { label: "Phone", value: "PHONE" },
        { label: "Admin", value: "ADMIN" },
        { label: "Other", value: "OTHER" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "assignedStaff",
      type: "relationship",
      relationTo: "users",
      index: true,
      /* Only internal users can own a lead — enforced as a query so a
         customer can never be assigned, whatever the client sends. */
      filterOptions: () => ({ role: { in: ["admin", "staff"] } }),
      access: { create: isStaffField, update: isStaffField },
      admin: { position: "sidebar", description: "Unassigned leads are the ones that get dropped." },
    },
    {
      name: "followUpAt",
      type: "date",
      index: true,
      access: { create: isStaffField, update: isStaffField },
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description: "Drives the 'follow-ups due' view. Cannot be set in the past.",
      },
    },
    {
      name: "resolvedAt",
      type: "date",
      index: true,
      /* Stamped from the status transition, never hand-typed, so "when did
         we close this?" always matches the status it describes. */
      access: { create: () => false, update: () => false },
      admin: { position: "sidebar", readOnly: true },
    },

    /* ---------------- Communication foundation ---------------- */
    {
      type: "collapsible",
      label: "Communication",
      admin: {
        description:
          "Recorded by hand for now. Nothing here sends anything — Resend arrives in a later phase.",
      },
      fields: [
        {
          name: "lastContactedAt",
          type: "date",
          access: { create: isStaffField, update: isStaffField },
          admin: { date: { pickerAppearance: "dayAndTime" } },
        },
        {
          name: "lastContactMethod",
          type: "select",
          options: [
            { label: "Email", value: "EMAIL" },
            { label: "WhatsApp", value: "WHATSAPP" },
            { label: "Phone", value: "PHONE" },
            { label: "Instagram", value: "INSTAGRAM" },
            { label: "In person", value: "IN_PERSON" },
          ],
          access: { create: isStaffField, update: isStaffField },
        },
        {
          name: "communicationNotes",
          type: "textarea",
          maxLength: 8000,
          access: { create: isStaffField, update: isStaffField },
          admin: { description: "What was said, and when. Internal only." },
        },
      ],
    },

    /* ---------------- Internal ---------------- */
    {
      name: "internalNotes",
      type: "textarea",
      maxLength: 8000,
      /* Read-restricted as well as write-restricted: if `read` is ever
         widened to customers, this must not travel with it. */
      access: { create: isStaffField, read: isStaffField, update: isStaffField },
      admin: { description: "Internal only. Never shown to the enquirer." },
    },
    {
      name: "convertedMembership",
      type: "relationship",
      relationTo: "memberships",
      access: { create: isAdminField, update: isAdminField },
      admin: {
        position: "sidebar",
        description: "Set when a membership enquiry becomes a real membership.",
      },
    },
  ],
};
