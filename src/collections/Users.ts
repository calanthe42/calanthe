import type { Access, CollectionConfig } from "payload";

/** True only for a logged-in admin. Deny-by-default building block. */
const isAdmin: Access = ({ req: { user } }) => user?.role === "admin";

/** Admins see everyone; any other authenticated user sees only self. */
const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  return { id: { equals: user.id } };
};

/**
 * Staff/admin accounts use email+password (Payload auth). Customers
 * become passwordless OTP users in Phase B5 — the role exists now so
 * access rules are written against the final shape from day one.
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000, // 10 minutes
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "role"],
  },
  access: {
    /* Deny-by-default: only admins manage users; users may read/update
       themselves. Nobody self-registers (first user is created via the
       admin bootstrap screen; customers arrive via OTP in B5). */
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
    admin: ({ req: { user } }) => user?.role === "admin" || user?.role === "staff",
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
        /* Only admins may grant or change roles — a staff member can
           never escalate themselves. */
        create: ({ req: { user } }) => user?.role === "admin",
        update: ({ req: { user } }) => user?.role === "admin",
      },
      saveToJWT: true,
    },
  ],
};
