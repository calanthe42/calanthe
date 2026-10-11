"use server";

import { cookies as nextCookies, headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { recordActivity } from "@backend/activity/record";
import { actorOf } from "@backend/actions/admin-shared";
import { activeRole } from "@backend/payload/access";
import { LIMITS, clientAddress, throttle, waitMessage } from "@backend/security/throttle";
import { passwordProblem } from "@backend/domain/password-policy";

/**
 * THE ADMIN'S OWN PASSWORD — change it, forget it, reset it.
 *
 * Three rules hold for all of them:
 *
 * 1. NOTHING REVEALS WHO HAS AN ACCOUNT. "Forgot password" answers the same
 *    way for a known and an unknown address, and is throttled before the
 *    lookup, so it cannot be used to discover the shop's staff list.
 * 2. A NEW PASSWORD ENDS EVERY OTHER SESSION. Changing or resetting a
 *    password is what someone does when they think it leaked; leaving the
 *    old sessions alive would defeat the point. The device that made the
 *    change gets a fresh session and stays signed in.
 * 3. A TEMPORARY PASSWORD IS ONLY A KEY TO THE DOOR. An account given one
 *    (by an invite or by "issue temporary password") carries
 *    `mustChangePassword`, and the admin sends it here before anything else.
 *    Choosing a password clears it.
 */

export type PasswordResult =
  | { ok: true; message: string; code: string }
  | { ok: false; message: string; code: string; field?: string };

const COOKIE = "payload-token";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

async function setSessionCookie(token: string) {
  const jar = await nextCookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
}

/** The session id inside a Payload token, to keep this device's session. */
function sessionIdOf(token: string): string | null {
  try {
    const body = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { sid?: string };
    return typeof body.sid === "string" ? body.sid : null;
  } catch {
    return null;
  }
}

/**
 * After a new password: sign this device in again with it, and drop every
 * other session the account had.
 */
async function startFreshSession(email: string, password: string): Promise<void> {
  const payload = await getPayload({ config });
  const { token, user } = await payload.login({ collection: "users", data: { email, password } });
  if (!token || !user) return;
  await setSessionCookie(token);
  const keep = sessionIdOf(token);
  const sessions = ((user as { sessions?: { id: string }[] }).sessions ?? []).filter((s) => s.id === keep);
  await payload.update({
    collection: "users",
    id: user.id,
    overrideAccess: true,
    data: { sessions } as never,
  });
}

/* ------------------------------------------------------------------ */
/* Change my password (signed in)                                      */
/* ------------------------------------------------------------------ */

export async function changeOwnPassword(form: FormData): Promise<PasswordResult> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const role = activeRole(user);
  if (!user || (role !== "admin" && role !== "staff")) {
    return { ok: false, message: "Sign in again to change your password.", code: "password.signedOut" };
  }

  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const email = String(user.email ?? "").toLowerCase();

  const problem = passwordProblem(next, { email, previous: current });
  if (problem) return { ok: false, ...problem, field: "password" };
  if (next !== confirm) {
    return { ok: false, message: "The two new passwords are not the same.", code: "password.mismatch", field: "confirm" };
  }

  /* The same throttle as signing in: this form also checks a password. */
  const gate = await throttle(LIMITS.loginIdentity, `admin:${email}`);
  if (!gate.allowed) {
    return { ok: false, message: `Too many attempts. ${waitMessage(gate.retryAfterSeconds)}`, code: "password.throttled" };
  }

  /* Prove the current password. A failure counts toward the account's
     five-strike lock, exactly like a failed sign-in. */
  try {
    await payload.login({ collection: "users", data: { email, password: current } });
  } catch {
    return { ok: false, message: "Your current password is not right.", code: "password.currentWrong", field: "current" };
  }

  await payload.update({
    collection: "users",
    id: user.id,
    overrideAccess: true,
    data: { password: next, mustChangePassword: false } as never,
  });
  await startFreshSession(email, next);

  await recordActivity(payload, {
    actor: actorOf(user),
    action: "update",
    area: "other",
    collection: "users",
    itemId: user.id,
    itemLabel: email,
    summary: `${email} chose a new password; other devices were signed out`,
  });

  return { ok: true, message: "Your password is changed. Other devices have been signed out.", code: "password.changed" };
}

/* ------------------------------------------------------------------ */
/* Forgot password (signed out)                                        */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestAdminPasswordReset(form: FormData): Promise<PasswordResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "Check the email address.", code: "password.emailInvalid", field: "email" };
  }

  const [byEmail, byNetwork] = await Promise.all([
    throttle(LIMITS.passwordResetEmail, email),
    throttle(LIMITS.passwordResetIp, await clientAddress()),
  ]);
  const blocked = !byEmail.allowed ? byEmail : !byNetwork.allowed ? byNetwork : null;
  if (blocked) {
    return { ok: false, message: `Too many requests. ${waitMessage(blocked.retryAfterSeconds)}`, code: "password.throttled" };
  }

  const payload = await getPayload({ config });
  try {
    /* Only staff and owners are sent the admin link; anyone else gets the
       same answer and no email. */
    const found = await payload.find({
      collection: "users",
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });
    const account = found.docs[0] as { role?: string; accountStatus?: string } | undefined;
    if (account && activeRole(account) && (account.role === "admin" || account.role === "staff")) {
      await payload.forgotPassword({ collection: "users", data: { email }, disableEmail: false });
    }
  } catch {
    /* Same answer either way. */
  }
  return {
    ok: true,
    message: "If that address belongs to a Calanthe admin account, a link to choose a new password is on its way. It works for one hour.",
    code: "password.resetSent",
  };
}

/* ------------------------------------------------------------------ */
/* Reset password from the emailed link                                */
/* ------------------------------------------------------------------ */

export async function resetAdminPassword(form: FormData): Promise<PasswordResult> {
  const token = String(form.get("token") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!token) return { ok: false, message: "This link is not complete. Ask for a new one.", code: "password.linkInvalid" };

  const problem = passwordProblem(next, {});
  if (problem) return { ok: false, ...problem, field: "password" };
  if (next !== confirm) {
    return { ok: false, message: "The two new passwords are not the same.", code: "password.mismatch", field: "confirm" };
  }

  /* Its own bucket, so asking for a link and using it never share a count. */
  const gate = await throttle(LIMITS.passwordResetIp, `use:${await clientAddress()}`);
  if (!gate.allowed) {
    return { ok: false, message: `Too many attempts. ${waitMessage(gate.retryAfterSeconds)}`, code: "password.throttled" };
  }

  const payload = await getPayload({ config });
  let email = "";
  try {
    const result = await payload.resetPassword({ collection: "users", data: { token, password: next }, overrideAccess: true });
    const user = result.user as { id: number; email?: string; role?: string; accountStatus?: string } | undefined;
    if (!user) throw new Error("no user");
    email = String(user.email ?? "").toLowerCase();
    await payload.update({ collection: "users", id: user.id, overrideAccess: true, data: { mustChangePassword: false } as never });
    if (activeRole(user) === "admin" || activeRole(user) === "staff") {
      await startFreshSession(email, next);
      await recordActivity(payload, {
        actor: actorOf(user as never),
        action: "update",
        area: "other",
        collection: "users",
        itemId: user.id,
        itemLabel: email,
        summary: `${email} reset their password from the emailed link`,
      });
    }
  } catch {
    return { ok: false, message: "This link has been used or has expired. Ask for a new one.", code: "password.linkExpired" };
  }
  return { ok: true, message: "Your new password is set.", code: "password.resetDone" };
}


