import type { Tone } from "@admin/ui/Badge";
import type { LabelGroup } from "@admin/i18n/translate";

/**
 * What colour a stored status is shown in.
 *
 * The words come from the dictionary (`labels`); the tone comes from here, so
 * "Cancelled" is quiet in every language and "Payment failed" is alarming in
 * every language.
 */

const TONES: Partial<Record<LabelGroup, Record<string, Tone>>> = {
  fulfilment: {
    NEW: "info",
    CONFIRMED: "info",
    PREPARING: "warning",
    READY: "warning",
    OUT_FOR_DELIVERY: "warning",
    DELIVERED: "success",
    CANCELLED: "neutral",
  },
  payment: {
    PENDING: "warning",
    AUTHORIZED: "info",
    PAID: "success",
    FAILED: "danger",
    REFUNDED: "neutral",
    PARTIALLY_REFUNDED: "neutral",
  },
  enquiryStatus: {
    NEW: "info",
    IN_REVIEW: "warning",
    WAITING_FOR_CUSTOMER: "warning",
    QUOTED: "info",
    CONVERTED: "success",
    RESOLVED: "success",
    SPAM: "neutral",
    CANCELLED: "neutral",
  },
  eventStatus: {
    NEW: "info",
    CONTACTED: "warning",
    QUOTED: "info",
    CONFIRMED: "success",
    IN_PROGRESS: "warning",
    COMPLETED: "success",
    CANCELLED: "neutral",
  },
  payRequest: {
    awaiting: "warning",
    expired: "neutral",
    cancelled: "neutral",
    paid: "success",
  },
  /* Derived, never stored (lib/discounts.ts `discountStatus`). Draft and
     Expired are both quiet — neither means something is wrong; the word
     tells them apart. */
  discountStatus: {
    active: "success",
    scheduled: "info",
    expired: "neutral",
    draft: "neutral",
  },
  priority: {
    URGENT: "danger",
    HIGH: "warning",
    NORMAL: "neutral",
    LOW: "neutral",
  },
};

export function toneFor(group: LabelGroup, value: string | null | undefined): Tone {
  if (!value) return "neutral";
  return TONES[group]?.[value] ?? "neutral";
}

/** Fulfilment statuses that still need work. */
export const OPEN_FULFILMENT = ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const;

/** Enquiry statuses still waiting on the business. */
export const WAITING_ENQUIRY = ["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER"] as const;

/** Enquiry statuses in which a follow-up date still matters. */
export const OPEN_ENQUIRY = ["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER", "QUOTED"] as const;

/** How an order arrived, as a key into `labels.source`. */
export function orderSourceKey(
  source: string | null | undefined,
): "cod" | "checkout" | "quote" | "manual" | "unknown" {
  if (!source) return "unknown";
  /* An order written by hand in the admin (a WhatsApp or phone sale). */
  if (source === "admin-manual") return "manual";
  /* Before "checkout": a payment request is "admin-quote", and must never be
     mistaken for a website order if the two words ever meet in one value. */
  if (/quote/i.test(source)) return "quote";
  if (/cod/i.test(source)) return "cod";
  if (/checkout/i.test(source)) return "checkout";
  return "unknown";
}
