"use server";

import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { LIMITS, clientAddress, throttle, waitHint } from "@backend/security/throttle";
import { getDictionary } from "@/lib/i18n/server";
import { isPlausiblePhone } from "@/lib/phone-countries";
import { waitText, withWait } from "@/lib/i18n/wait";
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

/** The same session cookie Payload's own login sets, for a customer. */
async function setCustomerSession(token: string): Promise<void> {
  const jar = await nextCookies();
  jar.set("payload-token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function customerLogin(form: FormData): Promise<AuthResult> {
  /*
   * Refusals are read by whoever is trying to sign in, so they are written
   * in the language she is reading. Every message in this file used to be an
   * English string at the point of failure — an Arabic customer met an
   * Arabic form and an English reason for being turned away.
   */
  const { locale, t } = await getDictionary();
  const m = t.server.account;

  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: m.credentialsRequired };
  }

  /* Per network AND per address — see backend/security/throttle.ts for why
     one without the other stops only half of what it looks like it stops.
     Checked before payload.login so a refused attempt costs no bcrypt. */
  const [byNetwork, byIdentity] = await Promise.all([
    throttle(LIMITS.customerLogin, await clientAddress()),
    throttle(LIMITS.loginIdentity, `customer:${email}`),
  ]);
  const blocked = !byNetwork.allowed
    ? byNetwork
    : !byIdentity.allowed
      ? byIdentity
      : null;
  if (blocked) {
    return {
      ok: false,
      message: withWait(
        locale,
        t,
        m.signInRateLimited,
        waitHint(blocked.retryAfterSeconds),
      ),
    };
  }

  const payload = await getPayload({ config });

  try {
    const result = await payload.login({
      collection: "users",
      data: { email, password },
    });

    if (!result.token) {
      return { ok: false, message: m.signInFailed };
    }

    /* Staff and the owner belong in /admin. Signing them in here would give
       them a storefront session they have no use for and muddle which
       identity is acting. */
    if (result.user?.role !== "customer") {
      return { ok: false, message: m.staffAccount };
    }

    await setCustomerSession(result.token);
    return { ok: true };
  } catch {
    /* Deliberately one message for wrong password, unknown address, locked
       and unverified accounts alike: distinguishing them tells a stranger
       which email addresses have accounts here. */
    return { ok: false, message: m.signInRejected };
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

/**
 * ACCOUNTS WORK AT ONCE. A new customer is signed in the moment the account
 * exists; the email we send is how she CONFIRMS the address, and only the
 * welcome gift waits for that (Users.emailConfirmedAt, backend/data/welcome.ts).
 * `_verified` is therefore set true here, so Payload lets her sign in, and
 * Payload still sends its verification email with the link.
 *
 * The price of signing her in is that a taken address can no longer look
 * like a fresh sign-up: someone who already has an account is told so, and
 * offered sign-in. Registration stays throttled per network.
 */
export type RegisterResult =
  { ok: true; email: string; signedIn: boolean } | { ok: false; field?: string; message: string };

export async function customerRegister(form: FormData): Promise<RegisterResult> {
  const { locale, t } = await getDictionary();
  const m = t.server.account;

  const name = String(form.get("name") ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  const phone = String(form.get("phone") ?? "")
    .trim()
    .slice(0, 40);
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  if (name.length < 2) return { ok: false, field: "name", message: m.nameRequired };
  if (phone && !isPlausiblePhone(phone)) return { ok: false, field: "phone", message: m.phoneInvalid };
  if (!EMAIL_RE.test(email))
    return { ok: false, field: "email", message: m.emailInvalid };
  if (password.length < MIN_PASSWORD)
    return {
      ok: false,
      field: "password",
      message: m.passwordTooShort.replace("{min}", String(MIN_PASSWORD)),
    };
  if (password !== confirm)
    return { ok: false, field: "confirmPassword", message: m.passwordMismatch };
  /* The box is required, and the moment it was ticked is kept. */
  if (form.get("terms") !== "on") return { ok: false, field: "terms", message: m.termsRequired };

  /* Account creation is the one public write to the users table. Without a
     limit it is a script that fills the customer list — the business's most
     valuable asset — with thousands of rows the owner then has to sift. */
  const registrations = await throttle(LIMITS.register, await clientAddress());
  if (!registrations.allowed) {
    return {
      ok: false,
      message: withWait(
        locale,
        t,
        m.registerRateLimited,
        waitHint(registrations.retryAfterSeconds),
      ),
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
        /* Signs in now; the emailed link confirms the address later. */
        _verified: true,
        termsAcceptedAt: new Date().toISOString(),
        ...(phone ? { phone } : {}),
      } as never,
    });
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
       * The address is already registered. Nobody is signed in to an
       * account they did not just create: she is told the address has an
       * account and offered sign-in. If it was never confirmed, the link is
       * sent again quietly — the likeliest person here is its owner, back
       * because the first email never arrived.
       */
      await resendCustomerVerification(email).catch(() => undefined);
      return { ok: false, field: "email", message: m.emailTaken };
    }

    if (collided.includes("phone")) {
      /* Nameable and fixable, unlike the generic message it replaces. The
         phone column is unique by deliberate design (see Users.phone — it
         becomes the OTP identity in B6), so the honest answer is to say so
         and offer the way through. */
      return { ok: false, field: "phone", message: m.phoneTaken };
    }

    console.error("customer registration failed", error);
    return { ok: false, message: m.registerFailed };
  }

  /* ---------- signed in at once ---------- */
  try {
    const session = await payload.login({ collection: "users", data: { email, password } });
    if (session.token) {
      await setCustomerSession(session.token);
      return { ok: true, email, signedIn: true };
    }
  } catch (error) {
    console.error("new account could not be signed in", error);
  }
  /* The account exists either way; she can sign in from the form. */
  return { ok: true, email, signedIn: false };
}

export async function resendCustomerVerification(email: string): Promise<AuthResult> {
  const { locale, t } = await getDictionary();
  const m = t.server.account;

  const address = email.trim().toLowerCase();
  if (!EMAIL_RE.test(address)) return { ok: false, message: m.emailInvalid };

  /* Per address, not per network: this endpoint sends mail to whoever is
     named, so an unlimited one is a way to use Calanthe to bombard somebody
     else's inbox. Three is more than anyone needs and far short of abuse. */
  const resends = await throttle(LIMITS.verifyResend, address);
  if (!resends.allowed) {
    return {
      ok: false,
      message: waitText(locale, t, waitHint(resends.retryAfterSeconds)),
    };
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
      | {
          id: number | string;
          role?: string;
          emailConfirmedAt?: string | null;
          firstName?: string;
          name?: string;
        }
      | undefined;
    /* Already confirmed, the team, or no such account: say the same thing
       either way. Confirming is a customer's step (Users.emailConfirmedAt). */
    if (user && user.role === "customer" && !user.emailConfirmedAt) {
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
      /* Only the token. `_verified` stays as it is: accounts sign in before
         they are confirmed, and setting it false would lock her out. */
      await payload.update({
        collection: "users",
        id: user.id,
        overrideAccess: true,
        data: { _verificationToken: token } as never,
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
  const { t } = await getDictionary();
  const m = t.server.account;

  if (!token) return { ok: false, message: m.verifyLinkInvalid };
  const payload = await getPayload({ config });
  try {
    /* Whose link this is, read before Payload spends the token. */
    const owner = (await payload.db.findOne({
      collection: "users",
      where: { _verificationToken: { equals: token } },
    })) as { id: number | string; emailConfirmedAt?: string | null } | null;

    await payload.verifyEmail({ collection: "users", token });

    /* The address is confirmed: this is what unlocks the welcome gift. */
    if (owner && !owner.emailConfirmedAt) {
      await payload.update({
        collection: "users",
        id: owner.id,
        overrideAccess: true,
        data: { emailConfirmedAt: new Date().toISOString() },
      });
    }
    return { ok: true };
  } catch {
    return { ok: false, message: m.linkUsedOrExpired };
  }
}

export async function requestCustomerPasswordReset(form: FormData): Promise<AuthResult> {
  const { locale, t } = await getDictionary();
  const m = t.server.account;

  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, message: m.emailInvalid };

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
    return {
      ok: false,
      message: waitText(locale, t, waitHint(blocked.retryAfterSeconds)),
    };
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
  const { locale, t } = await getDictionary();
  const m = t.server.account;

  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");

  if (!token) return { ok: false, message: m.resetLinkInvalid };
  if (password.length < MIN_PASSWORD)
    return {
      ok: false,
      field: "password",
      message: m.passwordTooShort.replace("{min}", String(MIN_PASSWORD)),
    };
  if (password !== confirm)
    return { ok: false, field: "confirmPassword", message: m.passwordMismatch };

  /* The token is long and random, so guessing it is not a realistic attack —
     but an endpoint that will check an unlimited number of guesses is one
     tired algorithm away from becoming one, and the limit costs nothing. */
  const attempts = await throttle(LIMITS.passwordResetIp, await clientAddress());
  if (!attempts.allowed) {
    return {
      ok: false,
      message: waitText(locale, t, waitHint(attempts.retryAfterSeconds)),
    };
  }

  const payload = await getPayload({ config });
  let userId: number | string | undefined;
  try {
    const result = await payload.resetPassword({
      collection: "users",
      data: { token, password },
      overrideAccess: true,
    });
    userId = (result.user as { id?: number | string } | undefined)?.id;
  } catch {
    return { ok: false, message: m.linkUsedOrExpired };
  }

  /*
   * A NEW PASSWORD ENDS EVERY SESSION, as it does for the team
   * (actions/admin-password.ts). A reset is how the owner of an inbox takes
   * an account back: from a lost phone, or from someone who registered her
   * address before she did and has been signed in ever since, because
   * accounts work before they are confirmed. Payload's resetPassword only
   * ADDS a session; every login made with the old password stays valid, and
   * can be refreshed for as long as its holder likes. So all of them go,
   * including the one the reset itself made, which no device holds: she
   * signs in with the new password next (ResetPasswordForm sends her there).
   *
   * The password has changed by now, so a failure here is logged rather than
   * reported as a dead link.
   */
  if (userId !== undefined) {
    try {
      await payload.update({
        collection: "users",
        id: userId,
        overrideAccess: true,
        data: { sessions: [] } as never,
      });
    } catch (error) {
      console.error(`user ${userId}: password reset, but the old sessions could not be ended`, error);
    }
  }
  return { ok: true };
}
