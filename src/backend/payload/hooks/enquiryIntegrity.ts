import { APIError } from "payload";
import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook } from "payload";
import { formatReference, nextSequenceValue } from "./sequentialNumber";

export const ENQUIRY_NUMBER_SEQUENCE = "calanthe_enquiry_number_seq";
export const ENQUIRY_NUMBER_PREFIX = "CAL-E-";

/** Statuses that mean the enquiry is finished, one way or another. */
const TERMINAL_STATUSES = new Set(["CONVERTED", "RESOLVED", "SPAM", "CANCELLED"]);

/**
 * Assigns `CAL-E-000001` once, at creation, and never again.
 *
 * Immutability is enforced twice: this hook refuses to re-mint, and the
 * field itself is `update: () => false` so no role can edit it. A reference
 * a customer has quoted in an email must still resolve to the same enquiry
 * a year later.
 */
export const assignEnquiryNumber: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation === "update") {
    /* Defence in depth: field access already strips this, but if a future
       server path uses overrideAccess it must still not silently renumber. */
    if (
      typeof data.enquiryNumber === "string" &&
      originalDoc?.enquiryNumber &&
      data.enquiryNumber !== originalDoc.enquiryNumber
    ) {
      throw new APIError("An enquiry number cannot be changed once assigned.", 403);
    }
    return data;
  }

  if (typeof data.enquiryNumber === "string" && data.enquiryNumber.trim() !== "") return data;

  const value = await nextSequenceValue(req.payload, ENQUIRY_NUMBER_SEQUENCE);
  data.enquiryNumber = formatReference(ENQUIRY_NUMBER_PREFIX, value);
  return data;
};

/**
 * Keeps `resolvedAt` honest.
 *
 * A "resolved" date that nobody sets is useless for reporting; one that is
 * hand-typed drifts from the status it describes. Stamping it from the
 * status transition means "when did we close this?" always has an answer
 * that matches reality — and reopening an enquiry clears it, so a reopened
 * lead does not still look closed on the dashboard.
 */
export const stampResolvedAt: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (!data) return data;

  const nextStatus = data.status ?? originalDoc?.status;
  const previousStatus = operation === "update" ? originalDoc?.status : undefined;
  if (nextStatus === previousStatus) return data;

  if (TERMINAL_STATUSES.has(nextStatus)) {
    if (!data.resolvedAt && !originalDoc?.resolvedAt) {
      data.resolvedAt = new Date().toISOString();
    }
  } else {
    /* Reopened. */
    data.resolvedAt = null;
  }

  return data;
};

/**
 * A follow-up date must be a real date, and must not already be in the past
 * at the moment it is set — a follow-up scheduled for last Tuesday is a
 * silent way to lose a lead.
 */
export const validateEnquiryDates: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (!data) return data;

  if (data.followUpAt !== undefined && data.followUpAt !== null) {
    const followUp = new Date(data.followUpAt as string);
    if (Number.isNaN(followUp.getTime())) {
      throw new APIError("Follow-up date is not a valid date.", 400);
    }
    const changed = operation === "create" || data.followUpAt !== originalDoc?.followUpAt;
    if (changed && followUp.getTime() < Date.now() - 60_000) {
      throw new APIError("A follow-up date cannot be set in the past.", 400);
    }
  }

  return data;
};

/**
 * A membership ENQUIRY is not a membership.
 *
 * Someone filling in a form has expressed interest and paid nothing. The
 * only thing that makes a membership active is a confirmed payment, which
 * does not exist yet. This guard keeps the two apart at the data layer so no
 * future code path can mistake a lead for a paying customer.
 */
export const preventMembershipAutoActivation: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data;
  if (data.membership?.status && data.membership.status !== "interest") {
    throw new APIError(
      "An enquiry only ever records membership interest. Create a Membership record to activate one.",
      400,
    );
  }
  return data;
};
