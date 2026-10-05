import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import type { Order } from "@/payload-types";
import { getAdminSession } from "@backend/data/admin-session";
import {
  QUOTE_SOURCE,
  isPayLinkSource,
  payLinkOrigin,
  payRequestState,
  payToken,
  payUrl,
  type PayRequestState,
} from "@backend/payments/pay-link";
import { env } from "@/lib/env";
import { SITE_ORIGIN } from "@/lib/site";
import { describeLines } from "@backend/domain/manual-order";

/**
 * A payment request, as the admin shows it.
 *
 * SESSION FIRST, THEN overrideAccess. The pay link is rebuilt from the
 * order's salt, and the salt is a server-only field no role can read through
 * the API. So these readers check that an owner or staff member is signed in
 * (getAdminSession) and only then read with overrideAccess. A customer
 * session gets null from every function here.
 *
 * WHAT LEAVES THIS MODULE is the summary below — the link, never the salt or
 * the hash.
 *
 * The payment STATE is derived from the order every time (payRequestState).
 * It is not stored on the enquiry: a second copy is a second thing to be
 * wrong.
 */

export type QuoteSummary = {
  orderId: number;
  orderNumber: string;
  enquiryId: number | null;
  state: PayRequestState;
  totalFils: number;
  locale: "en" | "ar";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** What the florist called the arrangement — to prefill "confirm again". */
  description: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryAddress: string;
  recipientName: string | null;
  recipientPhone: string | null;
  cardMessage: string | null;
  customerNote: string | null;
  createdAt: string;
  payLinkExpiresAt: string | null;
  paidAt: string | null;
  invoiceNumber: string | null;
  /** The customer's link. Null only if the row has no salt. */
  payUrl: string | null;
  /** The most recent payment-request email, whatever became of it. */
  lastEmail: { status: string; createdAt: string } | null;
  /** How many times the payment-request email has been attempted. */
  sendCount: number;
};

const relationId = (value: number | { id: number } | null | undefined): number | null =>
  typeof value === "number" ? value : (value?.id ?? null);

function linkOf(order: Order): string | null {
  if (!order.payTokenSalt) return null;
  const origin = payLinkOrigin(SITE_ORIGIN, {
    env: process.env.VERCEL_ENV,
    branchUrl: process.env.VERCEL_BRANCH_URL,
  });
  return payUrl(
    origin,
    payToken(env.PAYLOAD_SECRET, order.payTokenSalt),
    order.locale === "ar" ? "ar" : "en",
  );
}

async function summarise(payload: Payload, order: Order, now: Date): Promise<QuoteSummary> {
  const emails = await payload
    .find({
      collection: "email-log",
      where: { and: [{ order: { equals: order.id } }, { type: { equals: "payment-request" } }] },
      sort: "-createdAt",
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  const last = emails?.docs[0];

  return {
    orderId: order.id,
    orderNumber: String(order.orderNumber ?? order.id),
    enquiryId: relationId(order.enquiry),
    state: payRequestState(order, now),
    totalFils: order.totalFils,
    locale: order.locale === "ar" ? "ar" : "en",
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    description: describeLines(order.items),
    deliveryDate: order.deliveryDate,
    deliveryTimeSlot: order.deliveryTimeSlot,
    deliveryAddress: order.deliveryAddress,
    recipientName: order.recipientName ?? null,
    recipientPhone: order.recipientPhone ?? null,
    cardMessage: order.cardMessage ?? null,
    customerNote: order.customerNote ?? null,
    createdAt: order.createdAt,
    payLinkExpiresAt: order.payLinkExpiresAt ?? null,
    paidAt: order.paidAt ?? null,
    invoiceNumber: order.invoiceNumber ?? null,
    payUrl: linkOf(order),
    lastEmail: last ? { status: String(last.status), createdAt: last.createdAt } : null,
    sendCount: emails?.totalDocs ?? 0,
  };
}

/**
 * The enquiry's payment request: the newest order confirmed from it, which
 * is the live one if there is one and the last cancelled one otherwise.
 * Null when the enquiry has never been confirmed.
 */
export async function getQuoteForEnquiry(enquiryId: number): Promise<QuoteSummary | null> {
  if (!(await getAdminSession())) return null;
  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "orders",
    where: { and: [{ enquiry: { equals: enquiryId } }, { source: { equals: QUOTE_SOURCE } }] },
    sort: "-createdAt",
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const order = found.docs[0];
  return order ? summarise(payload, order, new Date()) : null;
}

/** The same summary by order. Null for anything that is not a payment request. */
export async function getQuoteForOrder(orderId: number): Promise<QuoteSummary | null> {
  if (!(await getAdminSession())) return null;
  const payload = await getPayload({ config });
  const order = await payload
    .findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
    .catch(() => null);
  if (!order || !isPayLinkSource(order.source)) return null;
  return summarise(payload, order, new Date());
}

/**
 * Payment state for a page of enquiries, in ONE query — for the badge beside
 * each row of the enquiries list. Enquiries with no request are absent from
 * the map. The newest request wins, as in getQuoteForEnquiry.
 */
export async function getQuoteStatesForEnquiries(
  enquiryIds: readonly number[],
): Promise<Map<number, PayRequestState>> {
  const states = new Map<number, PayRequestState>();
  if (enquiryIds.length === 0 || !(await getAdminSession())) return states;
  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "orders",
    where: { and: [{ enquiry: { in: [...enquiryIds] } }, { source: { equals: QUOTE_SOURCE } }] },
    sort: "-createdAt",
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: { enquiry: true, paymentStatus: true, fulfilmentStatus: true, payLinkExpiresAt: true },
  });
  const now = new Date();
  for (const order of found.docs) {
    const id = relationId(order.enquiry);
    if (id !== null && !states.has(id)) states.set(id, payRequestState(order, now));
  }
  return states;
}
