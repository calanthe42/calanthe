"use server";

import { cookies as nextCookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPayload } from "payload";
import config from "@payload-config";

/**
 * Signing in to, and out of, the Calanthe admin.
 *
 * NOT A SECOND AUTHENTICATION SYSTEM. This calls Payload's own `login` and
 * sets the same `payload-token` cookie Payload issues everywhere else, so the
 * session, the lockout after five failed attempts, account verification and
 * every access rule are exactly the ones already in force. What changes is
 * only the screen: the owner signs in on a Calanthe page instead of being
 * sent to the developer CMS to do it.
 *
 * Only `admin` and `staff` accounts are given a session here. A customer who
 * types a correct password receives no cookie at all — the role gate in
 * (panel)/layout.tsx would refuse them anyway, but not issuing the session is
 * the cleaner refusal.
 */

/* `code` is a path into the admin dictionary, so the sign-in screen can show
   the message in the reader's language; `message` is the English fallback. */
export type AdminAuthResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string; code: string };

/* One message for a wrong password, an unknown address, a locked account
   and an unverified one. Distinguishing them tells a stranger which email
   addresses belong to the business. */
const GENERIC_FAILURE = {
  ok: false,
  message: "That email and password did not match an admin account.",
  code: "auth.failed",
} as const;

/**
 * Where to go after signing in.
 *
 * Only paths inside the admin are honoured. Without this check,
 * `/admin/login?next=//evil.example` would turn the sign-in page into an
 * open redirect that forwards a freshly signed-in owner anywhere.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const insideAdmin = raw === "/admin" || raw.startsWith("/admin/");
  const smuggled = raw.includes("//") || raw.includes("\\") || /[\s]/.test(raw);
  if (!insideAdmin || smuggled || raw.startsWith("/admin/login")) return "/admin";
  return raw;
}

export async function adminLogin(form: FormData): Promise<AdminAuthResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Enter your email and password.", code: "auth.missing" };
  }

  const payload = await getPayload({ config });

  let token: string | undefined;
  let role: string | undefined;
  try {
    const result = await payload.login({ collection: "users", data: { email, password } });
    token = result.token;
    role = (result.user as { role?: string } | undefined)?.role;
  } catch {
    return GENERIC_FAILURE;
  }

  if (!token) return GENERIC_FAILURE;

  /* The password was right, so saying why they cannot enter reveals
     nothing a stranger could use. */
  if (role !== "admin" && role !== "staff") {
    return {
      ok: false,
      message: "This account does not have access to the Calanthe admin.",
      code: "auth.noAccess",
    };
  }

  const jar = await nextCookies();
  jar.set("payload-token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return { ok: true, redirectTo: safeNext(form.get("next")) };
}

export async function adminLogout(): Promise<void> {
  const jar = await nextCookies();
  jar.delete("payload-token");
  redirect("/admin/login?signedOut=1");
}
