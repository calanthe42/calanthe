import type { CollectionConfig } from "payload";
import { isAdmin, isStaff } from "@backend/payload/access";

/**
 * Every email the shop tried to send, and what happened to it.
 *
 * WHY IT EXISTS. "Did the customer get their confirmation?" must have an
 * answer that is not a shrug. Before this, a failed send was a line in a
 * server log nobody reads, and the owner's only evidence was the customer
 * saying nothing arrived. A row per attempt — with the provider's own
 * message id — turns that into something checkable against Resend.
 *
 * NOBODY WRITES THESE BY HAND. Rows are created by the send path
 * (backend/email/send.ts) and are read-only in the admin: an email log that
 * can be edited is not evidence of anything. Staff may resend, which writes
 * a NEW row rather than mutating the old one, because the history of what
 * was attempted is the point.
 */
export const EmailLog: CollectionConfig = {
  slug: "email-log",
  labels: { singular: "Email", plural: "Emails" },
  admin: {
    group: "Orders",
    useAsTitle: "subject",
    defaultColumns: ["subject", "to", "type", "status", "createdAt"],
    description: "Every email attempted, with the provider's id and outcome.",
    listSearchableFields: ["to", "subject", "orderNumber", "providerId"],
  },
  access: {
    read: isStaff,
    /* Written by the server only. overrideAccess is used by the send path. */
    create: () => false,
    update: () => false,
    /* An audit trail nobody can delete. Not even the owner — if a row is
       wrong, the fix is another row. */
    delete: () => false,
  },
  timestamps: true,
  fields: [
    {
      name: "to",
      type: "text",
      required: true,
      index: true,
      admin: { description: "The address as it was given to the provider." },
    },
    {
      name: "type",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Verify address", value: "verify-address" },
        { label: "Password reset", value: "password-reset" },
        { label: "Order confirmation", value: "order-confirmation" },
        { label: "Order status", value: "order-status" },
        { label: "Owner — new order", value: "owner-new-order" },
        { label: "Florist — job sheet", value: "florist-job-sheet" },
        { label: "Enquiry received", value: "enquiry-received" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      index: true,
      options: [
        /* Accepted by the provider. NOT the same as delivered — only the
           provider can say that, which is why providerId is kept. */
        { label: "Sent", value: "sent" },
        { label: "Failed", value: "failed" },
        /* No provider configured: the app ran, the email did not. */
        { label: "Skipped", value: "skipped" },
        /* Blocked by the non-production allowlist. */
        { label: "Suppressed", value: "suppressed" },
      ],
    },
    { name: "subject", type: "text", required: true },
    {
      name: "providerId",
      type: "text",
      index: true,
      admin: {
        description:
          "The provider's message id. This is what proves delivery — look it up in Resend.",
      },
    },
    {
      name: "error",
      type: "text",
      admin: { description: "Why it failed, or why it was suppressed." },
    },
    {
      name: "environment",
      type: "text",
      index: true,
      admin: { description: "Which deployment sent it: production, preview, local." },
    },
    {
      name: "orderNumber",
      type: "text",
      index: true,
      admin: { description: "Set for order emails, so a row can be found by order." },
    },
    {
      name: "order",
      type: "relationship",
      relationTo: "orders",
      admin: { description: "The order this email belongs to, when there is one." },
    },
    {
      name: "resentFrom",
      type: "relationship",
      relationTo: "email-log",
      access: { update: () => false },
      admin: {
        description: "If this was a resend, the row it was resent from.",
        readOnly: true,
      },
    },
  ],
  hooks: {
    /* Belt and braces: access already forbids it, and this makes the reason
       explicit if a future change loosens that by accident. */
    beforeDelete: [
      () => {
        throw new Error("The email log is an audit trail and cannot be deleted.");
      },
    ],
  },
};

/** Exported for the admin's resend action, which is owner-and-staff only. */
export const canResendEmail = isStaff;
/** Exported so a future purge tool, if one is ever justified, is owner-only. */
export const canAdministerEmailLog = isAdmin;
