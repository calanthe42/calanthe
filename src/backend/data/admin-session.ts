import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { User } from "@/payload-types";

/**
 * Who is looking at the admin application.
 *
 * This is NOT a second authentication system. It reads the same
 * `payload-token` cookie Payload already issues, through Payload's own
 * `auth()`, so there is one login, one session, one set of access rules. The
 * business admin is a different interface onto the same backend, not a
 * different backend.
 *
 * Customers are rows in `users` too, so "signed in" is never sufficient — the
 * gate is the role, exactly as `canAccessAdminPanel` gates the CMS.
 */

export type AdminSession = {
  user: User;
  isAdmin: boolean;
  isStaff: boolean;
};

/** The current session, or null when nobody is signed in. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  if (!user) return null;

  const role = (user as User).role;
  /* A customer signing in on the storefront must never reach this interface,
     even though their session is valid. */
  if (role !== "admin" && role !== "staff") return null;

  return {
    user: user as User,
    isAdmin: role === "admin",
    isStaff: role === "admin" || role === "staff",
  };
}

/** Display name for the sidebar, falling back through what we actually have. */
export function displayName(user: User): string {
  const composed = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return composed || user.name || user.email;
}

export function roleLabel(user: User): string {
  return user.role === "admin" ? "Owner" : user.role === "staff" ? "Staff" : "Customer";
}
