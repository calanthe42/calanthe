import type { CollectionBeforeChangeHook } from "payload";

/**
 * Marketing consent must be explicit, and separate from the act of buying.
 *
 * Buying flowers is not consent to be marketed to. The schema keeps
 * `marketing.subscribed` on the user and nothing in the order path may set
 * it — consent is only ever given by a deliberate action (an account
 * setting, a footer sign-up, a ticked box that defaults to unticked).
 *
 * This hook supplies the *evidence*: the moment consent was given or
 * withdrawn, stamped server-side. `consentAt` and `unsubscribedAt` are
 * field-level server-only (see Users.ts) precisely so that the timestamp
 * cannot be back-dated by whoever is editing the record.
 *
 * History — needed to prove consent later — belongs in `audit_log`, which
 * does not exist yet (docs/DATABASE.md §1). Current state lives here.
 */
export const stampMarketingConsent: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
}) => {
  const next = data?.marketing;
  if (!next) return data;

  const wasSubscribed = operation === "update" ? Boolean(originalDoc?.marketing?.subscribed) : false;
  const isSubscribed = Boolean(next.subscribed);

  if (isSubscribed && !wasSubscribed) {
    next.consentAt = new Date().toISOString();
    next.unsubscribedAt = null;
  }

  if (!isSubscribed && wasSubscribed) {
    next.unsubscribedAt = new Date().toISOString();
  }

  return data;
};
