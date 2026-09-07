import type { CollectionConfig } from "payload";
import {
  isAdmin,
  isAdminField,
  isStaffOrOwnerOf,
  nobody,
  serverOnlyField,
} from "@backend/payload/access";
import { filsField } from "@backend/payload/fields/money";

/**
 * A real, paid membership — as distinct from someone who filled in a form.
 *
 * WHY THIS IS A SEPARATE COLLECTION, and not a status on Enquiries:
 * the two have genuinely different lifecycles. An enquiry is worked once and
 * closed; a membership recurs, pauses, resumes, lapses and bills on a
 * schedule for years. Modelling a recurring commercial relationship as a
 * terminal lead state would mean an enquiry that never resolves, and a
 * billing job that has to filter the customer-service queue to find its
 * subscribers. It is also the shape docs/DATABASE.md §13 already specifies.
 *
 * INTEREST IS NOT MEMBERSHIP. Nothing creates a row here automatically. A
 * membership enquiry records interest; converting it is a deliberate act by
 * the owner, and `status` starts at PENDING because nothing has been paid.
 *
 * BILLING IS NOT IMPLEMENTED. `providerCustomerId` and
 * `providerSubscriptionId` exist so the schema is ready for Stripe, and are
 * server-write-only. There are no credentials, no API calls and no
 * subscription logic in this step — a membership marked ACTIVE today means
 * a human confirmed it, and the field descriptions say so.
 *
 * PLANS ARE CONTROLLED VALUES for now. A membership_plans collection
 * (docs/DATABASE.md §13) becomes worthwhile when the client needs to price
 * and describe tiers herself; a select is the honest model until then.
 */
export const Memberships: CollectionConfig = {
  slug: "memberships",
  labels: { singular: "Membership", plural: "Memberships" },
  admin: {
    group: "People",
    useAsTitle: "id",
    defaultColumns: ["customer", "plan", "status", "startDate", "nextBillingDate"],
    description: "Active and pending subscriptions. Billing is not connected yet.",
  },
  access: {
    /* Staff can see subscriptions to fulfil the deliveries; a customer sees
       only their own, as a database constraint. */
    read: isStaffOrOwnerOf("customer"),
    /* Converting an enquiry into a paying relationship is an owner decision,
       not an operational one. */
    create: isAdmin,
    update: isAdmin,
    /* Cancelling is a status. A deleted subscription is a customer who
       silently stops receiving flowers with no record of why. */
    delete: nobody,
  },
  defaultSort: "-createdAt",
  timestamps: true,
  fields: [
    {
      name: "customer",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      filterOptions: () => ({ role: { equals: "customer" } }),
      admin: { description: "A membership always belongs to a registered account." },
    },
    {
      name: "plan",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Monthly", value: "MONTHLY" },
        { label: "Quarterly", value: "QUARTERLY" },
        { label: "Custom", value: "CUSTOM" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "PENDING",
      index: true,
      options: [
        { label: "Pending", value: "PENDING" },
        { label: "Active", value: "ACTIVE" },
        { label: "Paused", value: "PAUSED" },
        { label: "Cancelled", value: "CANCELLED" },
        { label: "Expired", value: "EXPIRED" },
      ],
      admin: {
        position: "sidebar",
        description:
          "Starts PENDING. Until billing is connected, ACTIVE means a human confirmed payment.",
      },
    },
    {
      name: "deliveryFrequency",
      type: "select",
      required: true,
      options: [
        { label: "Weekly", value: "WEEKLY" },
        { label: "Fortnightly", value: "FORTNIGHTLY" },
        { label: "Monthly", value: "MONTHLY" },
      ],
    },
    filsField({
      name: "pricePerDeliveryFils",
      label: "Price per delivery (fils)",
      admin: { description: "What this customer pays per delivery, in fils (AED × 100)." },
    }),
    {
      name: "startDate",
      type: "date",
      index: true,
      admin: { date: { pickerAppearance: "dayOnly" } },
    },
    {
      name: "nextBillingDate",
      type: "date",
      index: true,
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description: "Maintained by hand until the billing provider is connected.",
      },
    },
    { name: "notes", type: "textarea", maxLength: 4000 },
    {
      name: "providerCustomerId",
      type: "text",
      index: true,
      /* Server-write-only for every role: writing another person's provider
         id here would attach their payment method to this subscription.
         Same class of defect as users.stripeCustomerId
         (docs/ARCHITECTURE.md §8, defect #1). */
      access: { read: isAdminField, create: serverOnlyField, update: serverOnlyField },
      admin: {
        position: "sidebar",
        readOnly: true,
        description: "Set by the payment provider. Empty until billing is connected.",
      },
    },
    {
      name: "providerSubscriptionId",
      type: "text",
      unique: true,
      index: true,
      access: { read: isAdminField, create: serverOnlyField, update: serverOnlyField },
      admin: { position: "sidebar", readOnly: true },
    },
  ],
};
