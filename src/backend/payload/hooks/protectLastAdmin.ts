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

async function countOtherAdmins(
  payload: Parameters<CollectionBeforeChangeHook>[0]["req"]["payload"],
  excludeId: string | number,
): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: "users",
    overrideAccess: true,
    where: {
      and: [{ role: { equals: "admin" } }, { id: { not_equals: excludeId } }],
    },
  });
  return totalDocs;
}

/** Refuses an update that would demote the only remaining admin. */
export const protectLastAdminOnChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== "update") return data;
  if (originalDoc?.role !== "admin") return data;

  /* `role` absent from the payload means it is unchanged — a partial
     update of some other field must not trip the guard. */
  if (data.role === undefined || data.role === "admin") return data;

  if ((await countOtherAdmins(req.payload, originalDoc.id)) === 0) {
    throw new APIError(LOCKOUT_MESSAGE, 400);
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

  if ((await countOtherAdmins(req.payload, id)) === 0) {
    throw new APIError(LOCKOUT_MESSAGE, 400);
  }
};
