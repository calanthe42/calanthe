import "server-only";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import type { Order } from "@/payload-types";
import { buildInvoiceSheet, type InvoiceSheetView } from "@backend/domain/invoice";
import {
  PAY_LINK_SOURCES,
  hashPayToken,
  isPayTokenShape,
  payRequestState,
  type PayRequestState,
} from "@backend/payments/pay-link";
import { getStripe } from "@backend/payments/stripe";
import { describeLines } from "@backend/domain/manual-order";
import { BUSINESS } from "@/lib/business";

/**
 * Reading an order by its payment link — for the /pay page and its actions.
 *
 * THE BROWSER SENDS ONLY THE TOKEN. There is no amount, order id or email
 * parameter anywhere on this path; everything else is loaded here, from the
 * order the token's hash points at.
 *
 * WHY overrideAccess. The visitor is, by design, not signed in — the link is
 * the whole of their authority, and it is 256 bits. The lookup is by the
 * SHA-256 of the token against a unique index, restricted to payment
 * requests, so a token cannot be used to read an ordinary shop order.
 *
 * NOT A "use server" FILE, on purpose: an exported function in one of those
 * becomes an endpoint a browser can call, and `findOrderByPayToken` takes a
 * Payload instance.
 *
 * READING HAS NO SIDE EFFECTS. Mail scanners and link previews fetch the URL
 * before the customer does; nothing here creates an intent or writes a row.
 */

export async function findOrderByPayToken(payload: Payload, token: unknown): Promise<Order | null> {
  /* Anything that cannot be a token is refused before a query is made. */
  if (!isPayTokenShape(token)) return null;
  const found = await payload.find({
    collection: "orders",
    where: {
      and: [{ payTokenHash: { equals: hashPayToken(token) } }, { source: { in: [...PAY_LINK_SOURCES] } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return found.docs[0] ?? null;
}

/**
 * What the /pay page may show. An allow-list, built field by field: internal
 * notes, the salt, who is making it, the customer's phone and the Stripe
 * intent id are not on it, so they cannot reach the page by accident.
 */
export type PayRequestView = {
  orderNumber: string;
  locale: "en" | "ar";
  customerName: string;
  description: string;
  /** ISO. */
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryAddress: string;
  customerNote: string | null;
  totalFils: number;
  /** ISO, or null on a row that never had a link. */
  payLinkExpiresAt: string | null;
};

export type PayRequest =
  | { state: "invalid" }
  | {
      state: PayRequestState;
      view: PayRequestView;
      /** Present once paid and invoiced. Rendered by the page and the email alike. */
      invoice: InvoiceSheetView | null;
    };

function viewOf(order: Order): PayRequestView {
  return {
    orderNumber: String(order.orderNumber ?? ""),
    locale: order.locale === "ar" ? "ar" : "en",
    customerName: order.customerName,
    description: describeLines(order.items),
    deliveryDate: order.deliveryDate,
    deliveryTimeSlot: order.deliveryTimeSlot,
    deliveryAddress: order.deliveryAddress,
    customerNote: order.customerNote ?? null,
    totalFils: order.totalFils,
    payLinkExpiresAt: order.payLinkExpiresAt ?? null,
  };
}

/** Everything the /pay page renders, for one token. One generic "invalid". */
export async function loadPayRequest(token: unknown, now: Date = new Date()): Promise<PayRequest> {
  const payload = await getPayload({ config });
  const order = await findOrderByPayToken(payload, token);
  /* Malformed, unknown, another environment's, or not a payment request:
     one answer, with no detail about which — there is nothing to probe. */
  if (!order) return { state: "invalid" };

  const state = payRequestState(order, now);
  let invoice: InvoiceSheetView | null = null;
  if (state === "paid" && order.invoiceNumber) {
    try {
      invoice = buildInvoiceSheet(order, BUSINESS);
    } catch (error) {
      payload.logger.error(
        `pay page: invoice for ${order.orderNumber} could not be built: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }
  return { state, view: viewOf(order), invoice };
}

/**
 * The browser came back from Stripe (3-D Secure, a wallet) with
 * `?payment_intent=…`. Is that THIS order's intent, and has the customer
 * finished paying? Read-only: the webhook, not this, marks the order paid.
 * The page uses it to show "confirming" instead of the pay form.
 */
export async function isPayIntentSettling(token: unknown, paymentIntentId: unknown): Promise<boolean> {
  if (typeof paymentIntentId !== "string" || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) return false;
  const stripe = getStripe();
  if (!stripe) return false;
  const payload = await getPayload({ config });
  const order = await findOrderByPayToken(payload, token);
  if (!order || order.stripePaymentIntentId !== paymentIntentId) return false;
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return intent.status === "succeeded" || intent.status === "processing";
  } catch {
    return false;
  }
}
