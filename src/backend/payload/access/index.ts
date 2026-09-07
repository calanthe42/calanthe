import type { Access, FieldAccess, PayloadRequest } from "payload";

/**
 * The single definition of every access rule in the system.
 *
 * Copy-pasted access rules drift, and drift is how data leaks
 * (docs/PROJECT-STRUCTURE.md §3). Import from here; never re-implement.
 *
 * NOTE: this file is loaded by the Payload CLI in plain Node, so it must
 * NOT `import "server-only"` — that package resolves to a module which
 * throws under every export condition except `react-server`, which the
 * CLI does not set. See docs/PROJECT-STRUCTURE.md §5.
 *
 * Rules that return a **query constraint** rather than `true`/`false`
 * (isSelf, isOwnerOf) are filtered by Payload at the database level, so
 * a customer listing their own rows cannot page into someone else's.
 */

/* --- Collection-level --- */

/** Nobody, ever. Used where a row must be immutable (audit log, orders). */
export const nobody: Access = () => false;

export const isAdmin: Access = ({ req: { user } }) => user?.role === "admin";

/** Internal staff: florists and drivers. Admin is always also staff. */
export const isStaff: Access = ({ req: { user } }) =>
  user?.role === "admin" || user?.role === "staff";

/** Admins see everyone; anyone else sees only their own row. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  return { id: { equals: user.id } };
};

/**
 * Ownership by relationship field — e.g. isOwnerOf("customer") on orders.
 * Guest rows have a null owner and are therefore invisible to every
 * authenticated customer, which is the intended behaviour: a guest order
 * is reachable only by the server or an admin.
 */
export const isOwnerOf =
  (field: string): Access =>
  ({ req: { user } }) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return { [field]: { equals: user.id } };
  };

/** Catalogue only. Spelled out at each use site, never inherited. */
export const publicRead: Access = () => true;

/**
 * Who may open the Payload admin panel.
 *
 * Separate from `isStaff` because Payload types this one gate as
 * boolean-only — it cannot accept the query constraint that the ordinary
 * Access signature allows. Same rule, narrower return type.
 */
export const canAccessAdminPanel = ({ req }: { req: PayloadRequest }): boolean =>
  req.user?.role === "admin" || req.user?.role === "staff";

/**
 * Catalogue read rule: internal users see every row, the public sees only
 * rows whose live-flag is true.
 *
 * Returns a query constraint rather than a boolean, so Payload filters at
 * the database level — a draft or unavailable product cannot be reached by
 * guessing its id, and a public list cannot be paged into.
 */
export const publicReadWhenLive =
  (liveField: string): Access =>
  ({ req: { user } }) => {
    if (user?.role === "admin" || user?.role === "staff") return true;
    return { [liveField]: { equals: true } };
  };

/* --- Field-level --- */

/** Internal staff may write this field; customers and the public may not. */
export const isStaffField: FieldAccess = ({ req: { user } }) =>
  user?.role === "admin" || user?.role === "staff";

/**
 * Server-only field. Denies every request that arrives through the API or
 * admin panel, for every role including admin. Server code writes these
 * with `overrideAccess: true` inside a trusted path.
 *
 * Used for values a user must never author: stripeCustomerId (writing
 * someone else's would inherit their saved cards), order amounts,
 * consent timestamps.
 */
export const serverOnlyField: FieldAccess = () => false;

export const isAdminField: FieldAccess = ({ req: { user } }) => user?.role === "admin";
