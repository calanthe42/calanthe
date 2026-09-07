import type { CollectionConfig } from "payload";
import {
  canAccessAdminPanel,
  isAdmin,
  isAdminField,
  isAdminOrSelf,
  serverOnlyField,
} from "@backend/payload/access";
import {
  autoVerifyInvitedStaff,
  blockSuspendedLogin,
  deriveDisplayName,
  enforceSingleDefaultAddress,
} from "@backend/payload/hooks/customerAccount";
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

/** E.164, e.g. +971501234567. */
const phoneValidator =
  (required: boolean) =>
  (value: string | null | undefined): true | string => {
    if (!value) return required ? "A phone number is required." : true;
    return /^\+[1-9]\d{7,14}$/.test(value)
      ? true
      : "Enter the number in international format, e.g. +971501234567";
  };

/**
 * One identity table for everyone, discriminated by `role`
 * (docs/DATABASE.md §1 explains why not two).
 *
 * Staff and customers as separate tables would mean two auth paths, two
 * access surfaces, and a permanent "which row is the real person" bug the
 * first time a florist buys flowers for her own mother.
 *
 * WHERE EACH ROLE LIVES
 *   admin / staff  → /admin (Payload). `canAccessAdminPanel` gates entry.
 *   customer       → the storefront /login. NEVER the admin panel, even
 *                    though they are rows in this same collection.
 *
 * ACCOUNTS ARE NOT SELF-SERVICE HERE. `create` is admin-only on purpose: a
 * public create on the customer table is an unbounded account-spam vector on
 * the most valuable data in the business. Customer registration goes through
 * a rate-limited server route that verifies the address first and then writes
 * with `overrideAccess` (B6). Guest checkout requires no account at all and
 * does not touch this table — a guest order carries its own immutable
 * contact snapshot.
 *
 * NO DERIVED COMMERCE DATA. There is deliberately no `totalSpent`,
 * `orderCount` or `lastOrderAt` here. Each is a query against `orders`, and a
 * stored copy is a number that silently goes wrong after the first refund.
 * Order history is read from `orders` filtered by `customer`.
 *
 * NO PAYMENT DATA. Cards live with the payment provider; this table holds
 * only `stripeCustomerId`, a reference.
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000, // 10 minutes
    /* Payload's own verification, not a home-made flag. Customers must
       confirm their address; internally invited admin/staff are verified at
       creation by autoVerifyInvitedStaff because their identity was
       established out of band.
       Until the email provider lands (B3), Payload writes the verification
       link to the server console — a real mechanism with a console
       transport, not a stub. */
    verify: true,
  },
  admin: {
    group: "People",
    useAsTitle: "email",
    defaultColumns: ["email", "name", "role", "accountStatus"],
    description: "Customers, staff and owners. One table, separated by role.",
    listSearchableFields: ["email", "name", "firstName", "lastName", "phone"],
  },
  access: {
    /* Deny-by-default. All four operations declared explicitly.
       Admins see everyone; every other role — staff included — sees only
       their own row, as a database-level query constraint. Staff having no
       access to the customer list is deliberate (docs/SECURITY.md §3): every
       name, phone and address needed to fulfil an order already travels in
       that order's own snapshot, so there is no operational reason to expose
       the business's most valuable asset to every account. */
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
    admin: canAccessAdminPanel,
  },
  hooks: {
    beforeChange: [
      protectLastAdminOnChange,
      autoVerifyInvitedStaff,
      deriveDisplayName,
      enforceSingleDefaultAddress,
      stampMarketingConsent,
    ],
    beforeDelete: [protectLastAdminOnDelete],
    beforeLogin: [blockSuspendedLogin],
  },
  fields: [
    /* ---------------- Identity ---------------- */
    {
      name: "firstName",
      type: "text",
      maxLength: 80,
      index: true,
      admin: { description: "Used to address the customer personally." },
    },
    {
      name: "lastName",
      type: "text",
      maxLength: 80,
      index: true,
    },
    {
      name: "name",
      type: "text",
      maxLength: 160,
      /* Derived from firstName + lastName by deriveDisplayName. Kept as a
         real column because every email, order and admin list wants one
         string, and deriving it once means the two can never disagree. An
         existing name with no first/last set is left untouched. */
      admin: {
        readOnly: true,
        description: "Display name, built from the first and last name.",
      },
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
        /* THE privilege-escalation defence. A user may update their own row
           (isAdminOrSelf), so without a field-level rule a customer could
           PATCH themselves to admin. Only an admin may set or change a role;
           for anyone else the field is stripped from the write and the
           existing value (or `defaultValue`) stands. Staff cannot promote
           anyone because they cannot reach another user's row at all. */
        create: isAdminField,
        update: isAdminField,
      },
      saveToJWT: true,
      index: true,
    },
    {
      name: "phone",
      type: "text",
      /* Postgres unique indexes permit many NULLs, so this is "unique where
         not null". Becomes required for customers when OTP auth lands (B6). */
      unique: true,
      index: true,
      validate: phoneValidator(false),
      admin: { description: "International format, e.g. +971501234567" },
    },
    {
      name: "birthday",
      type: "date",
      /* A florist's most useful single date. Personal data: it exists to
         serve the customer, and any marketing use of it still requires
         marketing.subscribed to be true. */
      admin: {
        date: { pickerAppearance: "dayOnly", displayFormat: "d MMMM" },
        description: "Optional. Marketing use still requires consent.",
      },
    },

    /* ---------------- Account state ---------------- */
    {
      name: "accountStatus",
      type: "select",
      required: true,
      defaultValue: "active",
      index: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Closed", value: "closed" },
      ],
      /* Enforced at login by blockSuspendedLogin, not merely displayed. A
         status that does not stop authentication is decoration. */
      access: { create: isAdminField, update: isAdminField },
      admin: {
        position: "sidebar",
        description: "Suspended and closed accounts cannot log in.",
      },
    },
    {
      name: "anonymisedAt",
      type: "date",
      /* A customer with order history is anonymised, never deleted — orders
         must survive for accounting (docs/DATABASE.md §2). */
      access: { create: serverOnlyField, update: serverOnlyField },
      admin: { position: "sidebar", readOnly: true },
    },

    /* ---------------- Saved addresses ---------------- */
    {
      name: "addresses",
      type: "array",
      /* Embedded, not a collection: owned by exactly one user, never shared,
         never queried independently (docs/DATABASE.md §1).
         `zone` (→ delivery_zones) joins when that collection exists. */
      labels: { singular: "Address", plural: "Addresses" },
      admin: { description: "Saved delivery addresses. Exactly one is the default." },
      fields: [
        {
          name: "label",
          type: "text",
          maxLength: 60,
          admin: { description: "e.g. Home, Office, Mum" },
        },
        {
          name: "recipientName",
          type: "text",
          maxLength: 140,
          admin: { description: "Who receives it here. Often not the account holder." },
        },
        { name: "recipientPhone", type: "text", validate: phoneValidator(false) },
        { name: "emirate", type: "select", required: true, options: [...EMIRATES] },
        {
          name: "area",
          type: "text",
          maxLength: 120,
          admin: { description: "e.g. Al Reem Island" },
        },
        {
          name: "street",
          type: "text",
          required: true,
          maxLength: 200,
          label: "Street / building",
        },
        {
          name: "apartment",
          type: "text",
          maxLength: 100,
          label: "Apartment / villa",
        },
        {
          name: "deliveryInstructions",
          type: "textarea",
          maxLength: 500,
          admin: { description: "Gate codes, landmarks, when to call." },
        },
        {
          name: "isDefault",
          type: "checkbox",
          defaultValue: false,
          admin: { description: "Only one address can be the default." },
        },
      ],
    },

    /* ---------------- Wishlist ---------------- */
    {
      name: "wishlist",
      type: "relationship",
      relationTo: "products",
      hasMany: true,
      /* Backend foundation only — no storefront UI in this step. Lives on the
         user for the same reason addresses do: it belongs to exactly one
         person and is never queried on its own. A guest wishlist stays in
         localStorage and merges into this on login. */
      admin: { description: "Products this customer saved. Storefront UI comes later." },
    },

    /* ---------------- Marketing consent ---------------- */
    {
      name: "marketing",
      type: "group",
      admin: {
        description: "Consent is given by a deliberate action, never by placing an order.",
      },
      fields: [
        { name: "subscribed", type: "checkbox", defaultValue: false, index: true },
        {
          name: "consentAt",
          type: "date",
          /* Stamped by stampMarketingConsent. Server-only so the evidence of
             when consent was given cannot be back-dated by an editor. */
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

    /* ---------------- Internal only ---------------- */
    {
      name: "tags",
      type: "select",
      hasMany: true,
      /* A curated vocabulary rather than free text. Free-text tags become
         "VIP", "vip" and "V.I.P." within a month and then segment nothing.
         Admin-only: a tag decides who gets which offer, which is a business
         decision, not an operational one. */
      options: [
        { label: "VIP", value: "vip" },
        { label: "Corporate", value: "corporate" },
        { label: "Wedding client", value: "wedding-client" },
        { label: "Event client", value: "event-client" },
        { label: "Wholesale", value: "wholesale" },
        { label: "Repeat customer", value: "repeat" },
        { label: "Do not contact", value: "do-not-contact" },
        { label: "Payment issue", value: "payment-issue" },
      ],
      access: { create: isAdminField, read: isAdminField, update: isAdminField },
      admin: { position: "sidebar", description: "Admin only. Never shown to the customer." },
    },
    {
      name: "notes",
      type: "textarea",
      maxLength: 8000,
      /* Internal notes about a person. Admin-only at field level as well as
         collection level — defence in depth if `read` is ever widened. */
      access: { create: isAdminField, read: isAdminField, update: isAdminField },
      admin: { description: "Internal only. Never shown to the customer." },
    },
    {
      name: "stripeCustomerId",
      type: "text",
      unique: true,
      index: true,
      /* Server-write-only for EVERY role. A customer may edit their own row,
         so without this they could paste another person's Stripe id onto
         their account and inherit that person's saved cards.
         Design-review defect #1 (docs/ARCHITECTURE.md §8).
         A REFERENCE, not payment data — no card details exist in this
         database. */
      access: {
        read: isAdminField,
        create: serverOnlyField,
        update: serverOnlyField,
      },
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Reference to the payment provider. No card data is stored here.",
      },
    },
  ],
};
