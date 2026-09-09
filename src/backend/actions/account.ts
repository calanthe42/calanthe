"use server";

import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";

/**
 * The customer's own account.
 *
 * Same authentication system as everything else — Payload's `login`, the same
 * `payload-token` cookie, the same `users` collection. There is no second
 * auth path, and a customer session grants exactly what the customer role
 * grants: their own record and their own orders. `canAccessAdminPanel` and
 * the admin layout's role gate both refuse it, so signing in here can never
 * open /admin or /cms.
 */

export type AuthResult = { ok: true } | { ok: false; message: string };

export async function customerLogin(form: FormData): Promise<AuthResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Enter your email and password." };
  }

  const payload = await getPayload({ config });

  try {
    const result = await payload.login({
      collection: "users",
      data: { email, password },
    });

    if (!result.token) {
      return { ok: false, message: "We could not sign you in. Please try again." };
    }

    /* Staff and the owner belong in /admin. Signing them in here would give
       them a storefront session they have no use for and muddle which
       identity is acting. */
    if (result.user?.role !== "customer") {
      return {
        ok: false,
        message: "This is a staff account. Please use the admin sign-in.",
      };
    }

    const jar = await nextCookies();
    jar.set("payload-token", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return { ok: true };
  } catch {
    /* Deliberately one message for wrong password, unknown address, locked
       and unverified accounts alike: distinguishing them tells a stranger
       which email addresses have accounts here. */
    return {
      ok: false,
      message: "That email and password did not match, or the account is not yet verified.",
    };
  }
}

export async function customerLogout(): Promise<AuthResult> {
  const jar = await nextCookies();
  jar.delete("payload-token");
  return { ok: true };
}

/** The signed-in customer, or null. Never returns staff or the owner. */
export async function getCustomerSession() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  if (!user || (user as { role?: string }).role !== "customer") return null;
  return user;
}
