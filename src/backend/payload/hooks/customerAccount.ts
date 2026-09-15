import { APIError } from "payload";
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeLoginHook,
} from "payload";

/**
 * Account-lifecycle rules for the single `users` identity table.
 *
 * Staff, customers and the owner are all rows here, discriminated by `role`
 * (docs/DATABASE.md §1). These hooks enforce the parts of that model that
 * access control cannot express.
 */

/**
 * `name` stays the display name, derived from the structured parts.
 *
 * The storefront and every email want one string; the admin and any future
 * "Dear Sara" personalisation want the parts. Deriving rather than asking
 * twice means the two can never disagree. A pre-existing `name` with no
 * first/last set is left alone, so nothing already in the database is lost.
 */
export const deriveDisplayName: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (!data) return data;

  const first = data.firstName ?? originalDoc?.firstName;
  const last = data.lastName ?? originalDoc?.lastName;

  const composed = [first, last]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" ")
    .trim();

  if (composed !== "") data.name = composed;
  return data;
};

/**
 * Exactly one default address, enforced server-side.
 *
 * Two defaults is not a cosmetic problem: checkout picks one arbitrarily and
 * the customer's flowers go to last year's address. Marking a new default
 * silently clears the others, which is what the person clicking it meant.
 */
export const enforceSingleDefaultAddress: CollectionBeforeChangeHook = ({ data }) => {
  if (!Array.isArray(data?.addresses)) return data;

  const defaults = data.addresses.filter((a: { isDefault?: boolean }) => a?.isDefault === true);

  if (defaults.length > 1) {
    /* Keep the LAST one marked — in the admin panel and in any UI, the one
       just ticked is the one the user intends. */
    let seenLast = false;
    for (let i = data.addresses.length - 1; i >= 0; i -= 1) {
      if (data.addresses[i]?.isDefault === true) {
        if (seenLast) data.addresses[i].isDefault = false;
        seenLast = true;
      }
    }
  }

  /* A customer with addresses always has a default; otherwise checkout has
     nothing to pre-select and every order starts with an empty form. */
  if (data.addresses.length > 0 && !data.addresses.some((a: { isDefault?: boolean }) => a?.isDefault)) {
    data.addresses[0].isDefault = true;
  }

  return data;
};

/**
 * Internal accounts are invited, not self-registered.
 *
 * Email verification is enabled on this collection so that customer
 * self-registration (B6) is real rather than assumed. But an admin or staff
 * account created *by an existing admin* has already had its identity
 * established out of band — the owner typed the address of someone she
 * employs. Forcing a verification email for those would mean no staff member
 * could log in until the email provider exists, which is a lockout with no
 * upside.
 *
 * So: an internal account created by an admin is marked verified at
 * creation. A customer is not, and must confirm their address.
 */
export const autoVerifyInvitedStaff: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== "create") return data;
  if (data?._verified === true) return data;

  const createdByAdmin = req.user?.role === "admin";
  const isInternalRole = data?.role === "admin" || data?.role === "staff";

  if (createdByAdmin && isInternalRole) {
    data._verified = true;
  }

  return data;
};

/**
 * A suspended or anonymised account cannot authenticate.
 *
 * Access rules govern what a session may read; they do not stop a session
 * being created in the first place. Without this, "suspended" would be a
 * label in the admin panel that changes nothing — the account would keep
 * working, which is the worst kind of security control: one that looks
 * enforced and is not.
 */
export const blockSuspendedLogin: CollectionBeforeLoginHook = ({ user }) => {
  const account = user as { accountStatus?: string; anonymisedAt?: string | null };

  if (account.anonymisedAt) {
    throw new APIError("This account has been closed.", 403);
  }
  if (account.accountStatus === "suspended") {
    throw new APIError("This account is suspended. Please contact Calanthe.", 403);
  }
  if (account.accountStatus === "closed") {
    throw new APIError("This account has been closed.", 403);
  }

  return user;
};
