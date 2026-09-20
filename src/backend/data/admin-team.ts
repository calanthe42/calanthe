import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { User } from "@/payload-types";

/**
 * Who can get into the admin, and whether they can get in right now.
 *
 * Runs under normal access control, as the signed-in person. `users.read` is
 * isAdminOrSelf, so a staff member calling this sees exactly one row — their
 * own — which is why the screen above it shows staff a short "ask the owner"
 * panel rather than a list. Nothing here is privileged by being in a data
 * module.
 */

/**
 * Payload's auth collections carry `loginAttempts` and `lockUntil`, and both
 * are declared `hidden`, so an ordinary `find` does not return them at all.
 *
 * THIS IS NOT A TYPE PROBLEM, IT IS A DATA PROBLEM. Reading them off the
 * documents a normal query returns gives `undefined` for every row, so every
 * account reads as unlocked and the one piece of information the screen
 * exists to surface — she is active and still cannot get in — is silently
 * always false. It looked correct in code and in the browser; only locking a
 * real account and watching the badge fail to appear showed it.
 *
 * `showHiddenFields: true` returns them, but it also returns `salt` and
 * `hash`. Password hashes have no business being loaded into a page's props,
 * so the lock state is fetched by a SECOND query that selects those two
 * fields and nothing else.
 */
type LockState = { loginAttempts: number; lockUntil: string | null };

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "staff";
  accountStatus: User["accountStatus"];
  createdAt: string;
  /** True while Payload's five-strike lock is still in force. */
  locked: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
};

function toMember(user: User, lock: LockState | undefined): TeamMember | null {
  if (user.role !== "admin" && user.role !== "staff") return null;

  const lockUntil = lock?.lockUntil ?? null;
  const lockedUntilMs = lockUntil ? Date.parse(lockUntil) : NaN;

  return {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    /* A lock in the past is not a lock. Payload leaves the timestamp behind
       after it expires, so comparing to now is the only honest reading. */
    locked: Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now(),
    lockedUntil: lockUntil,
    failedAttempts: lock?.loginAttempts ?? 0,
  };
}

/**
 * The lock state of every internal account, and nothing else.
 *
 * `select` narrows the query to these two columns, so `showHiddenFields`
 * cannot drag `salt` and `hash` along with them. Runs as the caller, like
 * everything else here.
 */
async function getLockStates(
  payload: Awaited<ReturnType<typeof getPayload>>,
  user: unknown,
): Promise<Map<number, LockState>> {
  const result = await payload.find({
    collection: "users",
    where: { role: { in: ["admin", "staff"] } },
    limit: 200,
    depth: 0,
    user: user as never,
    overrideAccess: false,
    showHiddenFields: true,
    select: { lockUntil: true, loginAttempts: true } as never,
  });

  const states = new Map<number, LockState>();
  for (const doc of result.docs) {
    const row = doc as { id: number; lockUntil?: string | null; loginAttempts?: number | null };
    states.set(row.id, { loginAttempts: row.loginAttempts ?? 0, lockUntil: row.lockUntil ?? null });
  }
  return states;
}

/**
 * Every internal account, owners first, then staff, each alphabetical.
 *
 * Sorted by role rather than by creation date because the question this
 * screen answers is "who has which powers", and grouping the two owners
 * together answers it at a glance.
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const [result, locks] = await Promise.all([
    payload.find({
      collection: "users",
      where: { role: { in: ["admin", "staff"] } },
      limit: 200,
      depth: 0,
      user,
      overrideAccess: false,
    }),
    getLockStates(payload, user),
  ]);

  return result.docs
    .map((doc) => toMember(doc, locks.get(doc.id)))
    .filter((member): member is TeamMember => member !== null)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
