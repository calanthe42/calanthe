"use server";

import { headers as nextHeaders } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPayload } from "payload";
import config from "@payload-config";
import { temporaryPassword } from "@backend/domain/temporary-password";
import type { UserAuthOperations } from "@/payload-types";
import type { ActionResult } from "./admin";

/**
 * Staff administration — who works here, what they may do, and how they get
 * back in when they cannot.
 *
 * WHY THIS SCREEN EXISTS. Until now the only way to add a florist was for a
 * developer to open the Payload CMS and create a row, and the only way to
 * deal with a locked-out one was to wait ten minutes and hope. Neither is
 * something a business owner should need a developer for, and "ring the
 * developer" is not an access-control policy.
 *
 * NO overrideAccess ANYWHERE HERE. Every call runs as the signed-in person,
 * so the collection's own rules decide: `create` and the `role` field are
 * admin-only, `protectLastAdmin` refuses anything that would lock the shop
 * out of itself, and a staff member who somehow reached these functions gets
 * the same refusal the API would give them. The explicit owner check below is
 * defence in depth and a better message — not the security boundary.
 *
 * THE OWNER CANNOT ACT ON HERSELF HERE. Demoting, suspending or deleting your
 * own account is never a thing someone means to do from a staff list, and
 * every one of them ends with the person holding the session locked out of
 * the screen they are looking at. The account page is where you change your
 * own details; this screen is for everyone else.
 */

const ROLES = ["admin", "staff"] as const;
type InternalRole = (typeof ROLES)[number];

const STATUSES = ["active", "suspended"] as const;
type Status = (typeof STATUSES)[number];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type InviteResult =
  | (Extract<ActionResult, { ok: true }> & {
      /**
       * Shown to the owner ONCE, on the screen, because there is no email
       * provider yet (backend/domain/temporary-password.ts explains the
       * choice). It is never stored in readable form — Payload hashes it on
       * write — so this response is the only time it exists as text.
       */
      temporaryPassword: string;
      email: string;
    })
  | Extract<ActionResult, { ok: false }>;

async function owner() {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  return { payload, user, isOwner: user?.role === "admin" };
}

const NOT_OWNER = {
  ok: false as const,
  message: "Only the owner can manage staff accounts.",
  code: "team.errors.ownerOnly",
};

const NOT_SELF = {
  ok: false as const,
  message: "You cannot change your own role or access from this screen.",
  code: "team.errors.notSelf",
};

/**
 * Turns anything thrown into a sentence the owner can act on.
 *
 * The last-admin guard's messages are already written for people and say
 * exactly what to do instead, so they are passed through untouched rather
 * than flattened into "something went wrong".
 */
function failure(error: unknown, fallback: string, fallbackCode: string): Extract<ActionResult, { ok: false }> {
  const raw = error instanceof Error ? error.message : "";
  const details = (error as { data?: { errors?: { message?: unknown }[] } } | null)?.data?.errors;
  const detail = typeof details?.[0]?.message === "string" ? details[0].message : "";

  if (/last admin account/i.test(raw)) return { ok: false, message: raw };
  /* Payload reports a taken email as "The following field is invalid: email"
     on the top line and "Value must be unique" in the detail. Reading only
     the top line missed it, and the owner saw the database's sentence. */
  if (/duplicate|unique|already exists|already registered/i.test(`${raw} ${detail}`)) {
    return {
      ok: false,
      message: "An account with that email address already exists.",
      code: "team.errors.duplicate",
    };
  }
  if (/not allowed|forbidden|unauthori[sz]ed/i.test(raw)) {
    return { ok: false, message: "You do not have permission to do that.", code: "actions.permission" };
  }

  if (detail && detail.length < 200) return { ok: false, message: detail };

  console.error(fallbackCode, error);
  return { ok: false, message: fallback, code: fallbackCode };
}

function refresh() {
  revalidatePath("/admin/team");
  /* The dashboard and the order screens name whoever an order is assigned
     to, and the assignee picker is built from this same list. */
  revalidatePath("/admin", "layout");
}

/** Reads a trimmed, length-capped string from the form. */
function text(form: FormData, key: string, max: number): string {
  return String(form.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Inviting                                                            */
/* ------------------------------------------------------------------ */

export async function inviteTeamMember(form: FormData): Promise<InviteResult> {
  const { payload, user, isOwner } = await owner();
  if (!isOwner) return NOT_OWNER;

  const firstName = text(form, "firstName", 80);
  const lastName = text(form, "lastName", 80);
  const email = text(form, "email", 200).toLowerCase();
  const phone = text(form, "phone", 40);
  const role = text(form, "role", 10) as InternalRole;

  if (firstName.length < 2) {
    return { ok: false, message: "Enter the person's first name.", code: "team.errors.firstName" };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "Check the email address.", code: "team.errors.email" };
  }
  if (!ROLES.includes(role)) {
    return { ok: false, message: "Choose whether this person is an owner or staff.", code: "team.errors.role" };
  }

  /* Generated, not chosen. See backend/domain/temporary-password.ts. */
  const password = temporaryPassword();

  try {
    await payload.create({
      collection: "users",
      user,
      overrideAccess: false,
      data: {
        firstName,
        lastName: lastName || undefined,
        email,
        password,
        role,
        accountStatus: "active",
        ...(phone ? { phone } : {}),
      },
    });
  } catch (error) {
    return failure(error, "That account could not be created.", "team.errors.inviteFailed");
  }

  refresh();
  return {
    ok: true,
    message: `${firstName} can now sign in.`,
    code: "team.result.invited",
    vars: { name: firstName },
    temporaryPassword: password,
    email,
  };
}

/* ------------------------------------------------------------------ */
/* Changing what someone may do                                        */
/* ------------------------------------------------------------------ */

export async function updateTeamMemberRole(id: number, role: string): Promise<ActionResult> {
  const { payload, user, isOwner } = await owner();
  if (!isOwner) return NOT_OWNER;
  if (user?.id === id) return NOT_SELF;
  if (!ROLES.includes(role as InternalRole)) {
    return { ok: false, message: "That is not a role.", code: "team.errors.role" };
  }

  try {
    await payload.update({
      collection: "users",
      id,
      user,
      overrideAccess: false,
      data: { role: role as InternalRole },
    });
  } catch (error) {
    return failure(error, "That role could not be changed.", "team.errors.roleFailed");
  }

  refresh();
  return {
    ok: true,
    message: role === "admin" ? "They are now an owner." : "They are now staff.",
    code: role === "admin" ? "team.result.promoted" : "team.result.demoted",
  };
}

export async function setTeamMemberStatus(id: number, status: string): Promise<ActionResult> {
  const { payload, user, isOwner } = await owner();
  if (!isOwner) return NOT_OWNER;
  if (user?.id === id) return NOT_SELF;
  if (!STATUSES.includes(status as Status)) {
    return { ok: false, message: "That is not an account status.", code: "team.errors.status" };
  }

  try {
    await payload.update({
      collection: "users",
      id,
      user,
      overrideAccess: false,
      data: { accountStatus: status as Status },
    });
  } catch (error) {
    return failure(error, "That account could not be changed.", "team.errors.statusFailed");
  }

  refresh();
  return {
    ok: true,
    message: status === "suspended" ? "That account can no longer sign in." : "That account can sign in again.",
    code: status === "suspended" ? "team.result.suspended" : "team.result.restored",
  };
}

/* ------------------------------------------------------------------ */
/* Getting someone back in                                             */
/* ------------------------------------------------------------------ */

/**
 * Clears Payload's five-strike lock.
 *
 * Without this the only remedy for a florist who mistyped her password five
 * times is to wait ten minutes — during which she cannot take an order. The
 * lock is doing its job; the owner simply knows it is not an attacker.
 *
 * `payload.unlock` is Payload's own operation, so the lock is cleared the
 * same way the CMS clears it. This does NOT change the password: someone who
 * has merely forgotten which of two passwords they used gets to try again,
 * and does not have to be issued a new one they will then have to store.
 */
export async function unlockTeamMember(id: number): Promise<ActionResult> {
  const { payload, user, isOwner } = await owner();
  if (!isOwner) return NOT_OWNER;

  try {
    const member = await payload.findByID({
      collection: "users",
      id,
      user,
      overrideAccess: false,
      depth: 0,
    });
    await payload.unlock({
      collection: "users",
      /* Payload's GENERATED types declare a `password` on the unlock payload,
         but the operation itself reads only the address (see
         auth/operations/unlock.js) — it is an artefact of type generation,
         not a value to supply. Naming the type is better than inventing a
         password that would look as though it meant something. */
      data: { email: member.email } as UserAuthOperations["unlock"],
      overrideAccess: false,
      /* unlock takes `req`, not `user`, unlike every other local operation.
         The access rule (Users.access.unlock) reads req.user. */
      req: { user },
    });
  } catch (error) {
    return failure(error, "That account could not be unlocked.", "team.errors.unlockFailed");
  }

  refresh();
  return { ok: true, message: "They can try signing in again.", code: "team.result.unlocked" };
}

/**
 * Issues a fresh one-time password.
 *
 * THE ONLY PASSWORD RECOVERY THAT WORKS TODAY. Payload's own "forgot
 * password" sends a link by email, and there is no email provider wired yet,
 * so that link currently goes to the server console — i.e. nowhere a florist
 * can reach. Until the provider lands, the owner resets it and passes the new
 * one on, which is how a five-person atelier does this anyway.
 *
 * Writing a new password also clears any lock, so a locked-out person does
 * not need both actions.
 */
export async function issueTemporaryPassword(id: number): Promise<InviteResult> {
  const { payload, user, isOwner } = await owner();
  if (!isOwner) return NOT_OWNER;

  const password = temporaryPassword();

  try {
    const updated = await payload.update({
      collection: "users",
      id,
      user,
      overrideAccess: false,
      data: { password },
    });

    /* Best-effort: a password reset is meaningless if the account stays
       locked for another nine minutes, but a failure to unlock must not
       report the reset itself as failed — the new password is already live. */
    await payload
      .unlock({
        collection: "users",
        data: { email: updated.email } as UserAuthOperations["unlock"],
        overrideAccess: false,
        req: { user },
      })
      .catch(() => undefined);

    refresh();
    return {
      ok: true,
      message: "New password issued. It is shown once — pass it on now.",
      code: "team.result.passwordIssued",
      temporaryPassword: password,
      email: updated.email,
    };
  } catch (error) {
    return failure(error, "That password could not be reset.", "team.errors.passwordFailed");
  }
}

/* ------------------------------------------------------------------ */
/* Removing                                                            */
/* ------------------------------------------------------------------ */

/**
 * Deletes an internal account outright.
 *
 * Safe to delete, unlike a customer: a staff member owns no records that
 * must survive for accounting. Orders they worked on keep their own snapshot
 * of who did what, so history does not change.
 *
 * Suspending is offered first and more prominently in the UI, because it is
 * reversible and covers the usual case — someone leaving, or on a long
 * break. Deleting is for an address typed wrongly, or a person who was never
 * meant to have access.
 */
export async function removeTeamMember(id: number): Promise<ActionResult> {
  const { payload, user, isOwner } = await owner();
  if (!isOwner) return NOT_OWNER;
  if (user?.id === id) return NOT_SELF;

  try {
    await payload.delete({ collection: "users", id, user, overrideAccess: false });
  } catch (error) {
    return failure(error, "That account could not be removed.", "team.errors.removeFailed");
  }

  refresh();
  return { ok: true, message: "That account has been removed.", code: "team.result.removed" };
}
