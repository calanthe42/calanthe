import type { CollectionConfig } from "payload";
import { isAdmin } from "@backend/payload/access";

/**
 * Who did what, and what it was before.
 *
 * WHY "WHAT IT WAS BEFORE" IS THE POINT. A log that says "Layla edited Amber
 * Hour" answers nothing the owner actually asks. The questions are "who
 * changed this price, and what was it?" and "who hid this product?" — so
 * every entry carries the field, the old value and the new one, as words a
 * florist reads rather than a JSON diff.
 *
 * APPEND-ONLY, AND THAT INCLUDES THE OWNER. `update` and `delete` are false
 * for everyone. A record the owner can quietly edit is not a record of
 * anything — its only value is that nobody could have changed it, and an
 * exception for the person most able to abuse it is the exception that
 * matters. If an entry is wrong, the correction is another entry.
 *
 * OWNER-ONLY TO READ. The log names staff and what they did. Staff reading
 * each other's entries changes the atmosphere of a small workshop, and it is
 * the owner's tool for a question only the owner asks.
 */
export const ActivityLog: CollectionConfig = {
  slug: "activity-log",
  labels: { singular: "Activity", plural: "Activity" },
  admin: {
    group: "System",
    useAsTitle: "summary",
    defaultColumns: ["createdAt", "actorName", "action", "summary"],
    description: "Every action by staff and the owner. Append-only.",
    listSearchableFields: ["actorName", "actorEmail", "summary", "itemLabel"],
  },
  access: {
    read: isAdmin,
    /* Written by the server through overrideAccess, never by a request. */
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  timestamps: true,
  fields: [
    {
      name: "actorEmail",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Kept as text so the entry survives the account being removed." },
    },
    { name: "actorName", type: "text", index: true },
    {
      name: "actorRole",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Owner", value: "admin" },
        { label: "Staff", value: "staff" },
      ],
    },
    {
      name: "action",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Created", value: "create" },
        { label: "Updated", value: "update" },
        { label: "Deleted", value: "delete" },
        { label: "Status changed", value: "status" },
        { label: "Email resent", value: "email" },
        { label: "Signed in", value: "login" },
      ],
    },
    {
      name: "area",
      type: "select",
      required: true,
      index: true,
      /* The three groups the owner filters by, as asked. */
      options: [
        { label: "Orders", value: "orders" },
        { label: "Products", value: "products" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "collection",
      type: "text",
      index: true,
      admin: { description: "Which table the item lives in." },
    },
    { name: "itemId", type: "text", index: true },
    {
      name: "itemLabel",
      type: "text",
      admin: { description: 'What the item is called, e.g. "Amber Hour" or "CAL-000021".' },
    },
    {
      name: "summary",
      type: "text",
      required: true,
      admin: {
        description:
          'One readable line, e.g. "price AED 480 → 520" or "CAL-000021 NEW → PREPARING".',
      },
    },
    {
      name: "changes",
      type: "array",
      admin: { description: "One row per field that actually changed." },
      fields: [
        { name: "field", type: "text", required: true },
        { name: "label", type: "text", admin: { description: "The field in the owner's words." } },
        { name: "before", type: "text" },
        { name: "after", type: "text" },
      ],
    },
    {
      name: "notable",
      type: "checkbox",
      defaultValue: false,
      index: true,
      admin: {
        description:
          "Price changes, hides and deletions. Flagged so they can be found without reading everything.",
      },
    },
  ],
  hooks: {
    /* Access already forbids both; these make the reason explicit if a
       future change loosens it by accident. */
    beforeDelete: [
      () => {
        throw new Error("The activity log is append-only and cannot be deleted.");
      },
    ],
  },
};
