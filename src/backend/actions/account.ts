"use server";

import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { LIMITS, clientAddress, throttle, waitMessage } from "@backend/security/throttle";
import { randomBytes } from "node:crypto";
import { sendEmail } from "@backend/email/send";
import { verifyAddress } from "@backend/email/templates";
import { env } from "@/lib/env";
import { collidingFields } from "@backend/payload/validation-errors";

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

  /* Per network AND per address — see backend/security/throttle.ts for why
     one without the other stops only half of what it looks like it stops.
     Checked before payload.login so a refused attempt costs no bcrypt. */
  const [byNetwork, byIdentity] = await Promise.all([
    throttle(LIMITS.customerLogin, await clientAddress()),
    throttle(LIMITS.loginIdentity, `customer:${email}`),
  ]);
  const blocked = !byNetwork.allowed ? byNetwork : !byIdentity.allowed ? byIdentity : null;
  if (blocked) {
    return {
      ok: false,
      message: `Too many sign-in attempts. ${waitMessage(blocked.retryAfterSeconds)}`,
    };
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

/* ------------------------------------------------------------------ */
/* Registration, verification and password reset                       */
/* ------------------------------------------------------------------ */

/**
 * NO SECOND AUTH SYSTEM. Everything below drives Payload's own operations
 * on the same `users` collection: `create` (which sends the verification
 * email because Users sets `auth.verify: true`), `verifyEmail`,
 * `forgotPassword` and `resetPassword`. There are no home-made tokens, no
 * separate customer table and no parallel session.
 *
 * WHY overrideAccess IS USED. `users.create` is admin-only by design — an
 * openly writable users table is an open door. A visitor registering has no
 * permissions, so the write cannot run as them. It is safe here for the same
 * reason guest checkout is: `role` is pinned to "customer" by this function
 * and never read from the form, so nothing a stranger posts can escalate.
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 10;

export type RegisterResult =
  | { ok: true; email: string }
  | { ok: false; field?: string; message: string };

export async function customerRegister(form: FormData): Promise<RegisterResult> {
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(form.get("phone") ?? "").trim().slice(0, 40);
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  if (name.length < 2) return { ok: false, field: "name", message: "Please tell us your name." };
  if (!EMAIL_RE.test(email))
    return { ok: false, field: "email", message: "Please check your email address." };
  if (password.length < MIN_PASSWORD)
    return {
      ok: false,
      field: "password",
      message: `Please use at least ${MIN_PASSWORD} characters.`,
    };
  if (password !== confirm)
    return { ok: false, field: "confirmPassword", message: "Those passwords do not match." };

  /* Account creation is the one public write to the users table. Without a
     limit it is a script that fills the customer list — the business's most
     valuable asset — with thousands of rows the owner then has to sift. */
  const registrations = await throttle(LIMITS.register, await clientAddress());
  if (!registrations.allowed) {
    return {
      ok: false,
      message: `Too many accounts created from here. ${waitMessage(registrations.retryAfterSeconds)}`,
    };
  }

  const payload = await getPayload({ config });

  try {
    await payload.create({
      collection: "users",
      overrideAccess: true,
      /* Pinned here, never taken from the form. */
      data: {
        name,
        email,
        password,
        role: "customer",
        accountStatus: "active",
        ...(phone ? { phone } : {}),
      },
    });
    return { ok: true, email };
  } catch (error) {
    /*
     * WHICH FIELD ACTUALLY COLLIDED.
     *
     * This used to test the error MESSAGE against /duplicate|unique|already/.
     * Payload does not use any of those words: it says "The following field
     * is invalid: email" and puts the detail in `data.errors[].path`. So the
     * test never matched, every collision fell through to "We could not
     * create that account just now", and a customer was told to try again at
     * something that could never work.
     *
     * That is what happened on production on 2026-09-25: two registrations
     * rejected on `path: email`, no account, no email, and a message that
     * explained nothing.
     */
    const collided = collidingFields(error);

    if (collided.includes("email")) {
      /*
       * The address is already registered. If that account has never been
       * verified, the most likely person here is its owner, coming back
       * because the first email never arrived — so send it again. This is
       * the unlock for exactly that situation.
       *
       * If it IS verified, nothing is sent and the caller still shows the
       * same screen. Distinguishing the two would turn this form into a way
       * to test which addresses have accounts here.
       */
      await resendCustomerVerification(email).catch(() => undefined);
      return { ok: true, email };
    }

    if (collided.includes("phone")) {
      /* Nameable and fixable, unlike the generic message it replaces. The
         phone column is unique by deliberate design (see Users.phone — it
         becomes the OTP identity in B6), so the honest answer is to say so
         and offer the way through. */
      return {
        ok: false,
        field: "phone",
        message:
          "That phone number is already on an account. Sign in instead, or leave the phone blank and add it later.",
      };
    }

    console.error("customer registration failed", error);
    return {
      ok: false,
      message: "We could not create that account just now. Please try again.",
    };
  }
}



export async function resendCustomerVerification(email: string): Promise<AuthResult> {
  const address = email.trim().toLowerCase();
  if (!EMAIL_RE.test(address)) return { ok: false, message: "Please check your email address." };

  /* Per address, not per network: this endpoint sends mail to whoever is
     named, so an unlimited one is a way to use Calanthe to bombard somebody
     else's inbox. Three is more than anyone needs and far short of abuse. */
  const resends = await throttle(LIMITS.verifyResend, address);
  if (!resends.allowed) {
    return { ok: false, message: waitMessage(resends.retryAfterSeconds) };
  }

  const payload = await getPayload({ config });
  try {
    const { docs } = await payload.find({
      collection: "users",
      where: { email: { equals: address } },
      limit: 1,
      overrideAccess: true,
    });
    const user = docs[0] as
      | { id: number | string; _verified?: boolean; firstName?: string; name?: string }
      | undefined;
    /* Already verified, or no such account: say the same thing either way. */
    if (user && !user._verified) {
      /*
       * MINT A NEW TOKEN AND SEND IT OURSELVES.
       *
       * This used to re-save the user with `_verified: false` and trust
       * Payload to notice. Payload sends its verification email on CREATE,
       * and the field was already false, so the write was a no-op: the
       * action returned ok, the throttle counted a use, and nothing was
       * ever sent. "Resend" that sends nothing is worse than no button —
       * the customer waits instead of asking for help.
       */
      const token = randomBytes(32).toString("hex");
      await payload.update({
        collection: "users",
        id: user.id,
        overrideAccess: true,
        data: { _verified: false, _verificationToken: token } as never,
      });

      await sendEmail(payload, {
        to: address,
        type: "verify-address",
        rendered: verifyAddress({
          name: user.firstName ?? user.name,
          url: `${env.NEXT_PUBLIC_SERVER_URL}/account/verify?token=${token}`,
        }),
      });
    }
  } catch (error) {
    console.error("resend verification failed", error);
  }
  return { ok: true };
}

export async function verifyCustomerEmail(token: string): Promise<AuthResult> {
  if (!token) return { ok: false, message: "That verification link is not valid." };
  const payload = await getPayload({ config });
  try {
    await payload.verifyEmail({ collection: "users", token });
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "That link has expired or has already been used.",
    };
  }
}

export async function requestCustomerPasswordReset(form: FormData): Promise<AuthResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Please check your email address." };

  /*
   * Both counts happen BEFORE the lookup, so neither reveals anything: a
   * known and an unknown address are throttled identically, and the only
   * thing the response can tell a stranger is how often they themselves
   * have asked.
   *
   * Per address stops Calanthe being used to bombard one person's inbox.
   * Per network stops a script walking a list of addresses to find which
   * ones the shop knows.
   */
  const [byEmail, byNetwork] = await Promise.all([
    throttle(LIMITS.passwordResetEmail, email),
    throttle(LIMITS.passwordResetIp, await clientAddress()),
  ]);
  const blocked = !byEmail.allowed ? byEmail : !byNetwork.allowed ? byNetwork : null;
  if (blocked) {
    return { ok: false, message: waitMessage(blocked.retryAfterSeconds) };
  }

  const payload = await getPayload({ config });
  try {
    await payload.forgotPassword({
      collection: "users",
      data: { email },
      disableEmail: false,
    });
  } catch {
    /* Swallowed on purpose. An unknown address must produce exactly the
       same response as a known one, or this becomes an account-enumeration
       oracle. The caller always shows "if that address has an account…". */
  }
  return { ok: true };
}

export type ResetResult = { ok: true } | { ok: false; field?: string; message: string };

export async function resetCustomerPassword(form: FormData): Promise<ResetResult> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  if (!token) return { ok: false, message: "That reset link is not valid." };
  if (password.length < MIN_PASSWORD)
    return {
      ok: false,
      field: "password",
      message: `Please use at least ${MIN_PASSWORD} characters.`,
    };
  if (password !== confirm)
    return { ok: false, field: "confirmPassword", message: "Those passwords do not match." };

  /* The token is long and random, so guessing it is not a realistic attack —
     but an endpoint that will check an unlimited number of guesses is one
     tired algorithm away from becoming one, and the limit costs nothing. */
  const attempts = await throttle(LIMITS.passwordResetIp, await clientAddress());
  if (!attempts.allowed) {
    return { ok: false, message: waitMessage(attempts.retryAfterSeconds) };
  }

  const payload = await getPayload({ config });
  try {
    await payload.resetPassword({
      collection: "users",
      data: { token, password },
      overrideAccess: true,
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "That link has expired or has already been used." };
  }
}
