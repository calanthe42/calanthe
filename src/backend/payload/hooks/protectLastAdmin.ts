import { APIError } from "payload";
import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook } from "payload";

/**
 * The client must never be able to lock herself out of her own shop.
 *
 * Nothing else in the system prevents the final admin being demoted to
 * staff/customer or deleted outright; one mis-click would leave zero
 * accounts able to administer the shop, with no recovery path short of a
 * manual database edit. Specified in docs/DATABASE.md §2 and listed as
 * design-review defect #2 in docs/ARCHITECTURE.md §8 — this is its
 * implementation.
 *
 * Both hooks count admins OTHER than the row being changed, with
 * `overrideAccess` so the guard holds regardless of who is asking.
 */

const LOCKOUT_MESSAGE =
  "This is the last admin account. Promote another user to admin before " +
  "changing or removing this one.";

const STATUS_MESSAGE =
  "This is the last admin account, and a suspended or closed account cannot " +
  "sign in. Promote another user to admin first.";

/**
 * Other admins who could actually sign in today.
 *
 * "Admin" alone is not the invariant. blockSuspendedLogin refuses a
 * suspended, closed or anonymised account at the door, so an admin in any of
 * those states is a row in a table, not a way back into the shop. Counting
 * them made the guard pass while leaving nobody able to administer anything:
 * with two admins, one already suspended, demoting the other was permitted.
 *
 * So the count is of admins who are active AND not anonymised — the same
 * conditions the login hook enforces, asked in advance.
 */
async function countOtherUsableAdmins(
  payload: Parameters<CollectionBeforeChangeHook>[0]["req"]["payload"],
  excludeId: string | number,
): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: "users",
    overrideAccess: true,
    where: {
      and: [
        { role: { equals: "admin" } },
        { id: { not_equals: excludeId } },
        { accountStatus: { equals: "active" } },
        { anonymisedAt: { exists: false } },
      ],
    },
  });
  return totalDocs;
}

/**
 * Refuses any update that would leave nobody able to administer the shop.
 *
 * THERE ARE TWO WAYS TO LOSE THE LAST ADMIN, and only one of them was
 * guarded. Demoting her was refused; SUSPENDING her was not — and
 * blockSuspendedLogin then turns her away at sign-in, which is the same
 * lockout by a different door and with no warning at all. Closing the
 * account does it too. Both are now refused on the same terms.
 */
export const protectLastAdminOnChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== "update") return data;
  if (originalDoc?.role !== "admin") return data;

  /* A field absent from the payload is unchanged — a partial update of
     something else entirely must not trip the guard. */
  const losingRole = data.role !== undefined && data.role !== "admin";
  const losingAccess =
    (data.accountStatus !== undefined && data.accountStatus !== "active") ||
    (data.anonymisedAt !== undefined && data.anonymisedAt !== null);

  if (!losingRole && !losingAccess) return data;

  /* Already unable to sign in: letting the row be edited further cannot make
     the situation worse, and refusing would trap an account that is now
     impossible to tidy up. */
  if (originalDoc.accountStatus !== "active" || originalDoc.anonymisedAt) return data;

  if ((await countOtherUsableAdmins(req.payload, originalDoc.id)) === 0) {
    throw new APIError(losingRole ? LOCKOUT_MESSAGE : STATUS_MESSAGE, 400);
  }

  return data;
};

/** Refuses deletion of the only remaining admin. */
export const protectLastAdminOnDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({
    collection: "users",
    id,
    overrideAccess: true,
    depth: 0,
  });

  if (doc?.role !== "admin") return;
  /* Already locked out of her own account: removing the row changes nothing
     about who can administer the shop, and blocking it would strand it. */
  if (doc.accountStatus !== "active" || doc.anonymisedAt) return;

  if ((await countOtherUsableAdmins(req.payload, id)) === 0) {
    throw new APIError(LOCKOUT_MESSAGE, 400);
  }
};
