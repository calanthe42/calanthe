import type { CollectionConfig } from "payload";
import {
  canAccessAdminPanel,
  isAdmin,
  isAdminField,
  isAdminOrSelf,
  serverOnlyField,
} from "@backend/payload/access";
import {
  protectLastAdminOnChange,
  protectLastAdminOnDelete,
} from "@backend/payload/hooks/protectLastAdmin";
import { stampMarketingConsent } from "@backend/payload/hooks/stampMarketingConsent";

/** The seven emirates — the only values a UAE address may carry. */
const EMIRATES = [
  { label: "Abu Dhabi", value: "abu-dhabi" },
  { label: "Dubai", value: "dubai" },
  { label: "Sharjah", value: "sharjah" },
  { label: "Ajman", value: "ajman" },
  { label: "Umm Al Quwain", value: "umm-al-quwain" },
  { label: "Ras Al Khaimah", value: "ras-al-khaimah" },
  { label: "Fujairah", value: "fujairah" },
] as const;

/**
 * One identity table for everyone, discriminated by `role`
 * (docs/DATABASE.md §1 explains why not two).
 *
 * Staff and customers being separate tables would mean two auth paths, two
 * access surfaces, and a permanent "which row is the real person" bug the
 * first time a florist buys flowers.
 *
 * IMPORTANT — this collection is NOT how customers get accounts.
 * `create` is admin-only on purpose: a public create on the customer table
 * is an unbounded account-spam vector on the most valuable data in the
 * business. Customer registration goes through a rate-limited server route
 * that verifies an OTP first and then writes with `overrideAccess` (B6).
 * Guest checkout requires no account at all and touches this table not at
 * all — a guest order carries its own immutable contact snapshot.
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000, // 10 minutes
  },
  admin: {
    group: "People",
    useAsTitle: "email",
    defaultColumns: ["email", "name", "role"],
  },
  access: {
    /* Deny-by-default. All four operations are declared explicitly;
       nothing here relies on "unset means allowed". */
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
    /* Who may open the Payload admin panel at all. Customers never can,
       even though they are rows in this same collection. */
    admin: canAccessAdminPanel,
  },
  hooks: {
    beforeChange: [protectLastAdminOnChange, stampMarketingConsent],
    beforeDelete: [protectLastAdminOnDelete],
  },
  fields: [
    {
      name: "name",
      type: "text",
      maxLength: 120,
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "customer",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Staff", value: "staff" },
        { label: "Customer", value: "customer" },
      ],
      access: {
        /* Privilege escalation defence. A customer may update their own
           row (isAdminOrSelf), so without a field-level rule they could
           PATCH themselves to admin. Only an admin may set or change a
           role; for anyone else the field is stripped from the write and
           `defaultValue` applies. */
        create: isAdminField,
        update: isAdminField,
      },
      saveToJWT: true,
      index: true,
    },
    {
      name: "phone",
      type: "text",
      /* Postgres unique indexes permit many NULLs, so this is "unique
         where not null" — guests and staff without a phone coexist.
         Becomes required for customers when OTP auth lands (B6). */
      unique: true,
      index: true,
      validate: (value: string | null | undefined) => {
        if (!value) return true;
        return /^\+[1-9]\d{7,14}$/.test(value)
          ? true
          : "Enter the number in international format, e.g. +971501234567";
      },
      admin: { description: "International format, e.g. +971501234567" },
    },
    {
      name: "addresses",
      type: "array",
      /* Embedded, not a collection: owned by exactly one user, never
         shared, never queried independently (docs/DATABASE.md §1).
         `zone` (→ delivery_zones) is added when that collection exists. */
      labels: { singular: "Address", plural: "Addresses" },
      fields: [
        { name: "label", type: "text", admin: { description: "e.g. Home, Office" } },
        { name: "line1", type: "text", required: true },
        { name: "line2", type: "text" },
        { name: "area", type: "text" },
        { name: "city", type: "text", required: true },
        { name: "emirate", type: "select", required: true, options: [...EMIRATES] },
        { name: "isDefault", type: "checkbox", defaultValue: false },
      ],
    },
    {
      name: "marketing",
      type: "group",
      admin: {
        description:
          "Consent is given by a deliberate action, never by placing an order.",
      },
      fields: [
        { name: "subscribed", type: "checkbox", defaultValue: false },
        {
          name: "consentAt",
          type: "date",
          /* Stamped by stampMarketingConsent. Server-only so the evidence
             of when consent was given cannot be back-dated by an editor. */
          access: { create: serverOnlyField, update: serverOnlyField },
          admin: { readOnly: true },
        },
        {
          name: "source",
          type: "select",
          options: [
            { label: "Account settings", value: "account" },
            { label: "Footer sign-up", value: "footer" },
            { label: "Checkout opt-in", value: "checkout" },
            { label: "Imported", value: "import" },
          ],
        },
        {
          name: "unsubscribedAt",
          type: "date",
          access: { create: serverOnlyField, update: serverOnlyField },
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: "stripeCustomerId",
      type: "text",
      unique: true,
      index: true,
      /* Server-write-only for EVERY role. A customer may edit their own
         row, so without this they could paste another person's Stripe id
         onto their account and inherit that person's saved cards.
         Design-review defect #1 (docs/ARCHITECTURE.md §8). */
      access: {
        read: isAdminField,
        create: serverOnlyField,
        update: serverOnlyField,
      },
      admin: { readOnly: true, description: "Set by the payment provider. Never edited by hand." },
    },
    {
      name: "notes",
      type: "textarea",
      /* Internal notes about a customer. Staff have no access to this
         collection at all; this keeps the field admin-only even so. */
      access: {
        read: isAdminField,
        create: isAdminField,
        update: isAdminField,
      },
    },
    {
      name: "anonymisedAt",
      type: "date",
      /* A customer with order history is anonymised, never deleted —
         orders must survive for accounting (docs/DATABASE.md §2). */
      access: { create: serverOnlyField, update: serverOnlyField },
      admin: { readOnly: true },
    },
  ],
};
