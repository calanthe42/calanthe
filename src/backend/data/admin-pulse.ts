import { getPayload } from "payload";
import config from "@payload-config";
import type { Where } from "payload";
import type { Enquiry, Order } from "@/payload-types";
import { PAY_LINK_SOURCES, isPayLinkSource } from "@backend/payments/pay-link";

/**
 * WHAT JUST ARRIVED.
 *
 * The admin's bell polls this: everything that came in after a moment the
 * reader last looked, plus the handful of most recent arrivals so the panel
 * is never empty. Orders and enquiries are the two things a florist has to
 * act on the minute they land — an order has a delivery date, an enquiry has
 * a person waiting for a reply — and nothing else in the business is that
 * urgent, so nothing else is here.
 *
 * Read-only, small (three bounded queries), and shaped for the screen: a
 * title, a line of detail and a link, in whichever order they arrived.
 *
 * PAYMENT REQUESTS RING AT THE RIGHT MOMENT. Confirming an enquiry creates
 * an order row, but that is the florist's own action — ringing the bell for
 * it as a "new order" would announce something she just did, for flowers
 * nobody has paid for. So an order created as a payment request is left out
 * of the "order" items entirely, and a third kind, "payment", appears when
 * the customer actually pays: keyed on `paidAt`, not on `createdAt`. That is
 * the "paid — go" signal in the admin; the owner's email is the other.
 */
export type PulseItem = {
  kind: "order" | "enquiry" | "payment";
  id: number;
  href: string;
  /** "CAL-000031" / the enquiry's subject */
  title: string;
  /** "Nati Ahmed · AED 480" / "Build your own · Nati Ahmed" */
  detail: string;
  amountFils?: number;
  /** When it arrived: created for an order or enquiry, PAID for a payment. */
  at: string;
};

export type AdminPulse = {
  now: string;
  /** Arrived after `since`, newest first. What the bell counts and alerts on. */
  fresh: PulseItem[];
  /** The most recent arrivals regardless, newest first. What the panel lists. */
  recent: PulseItem[];
};

const LIMIT = 8;

function orderItem(order: Order): PulseItem {
  const name = order.customerName?.trim() || order.recipientName?.trim() || "";
  return {
    kind: "order",
    id: order.id,
    href: `/admin/orders/${encodeURIComponent(order.orderNumber ?? String(order.id))}`,
    title: order.orderNumber ?? `#${order.id}`,
    detail: name,
    amountFils: order.totalFils ?? undefined,
    at: order.createdAt,
  };
}

function enquiryItem(enquiry: Enquiry): PulseItem {
  const contact = enquiry.contactName?.trim() || "";
  return {
    kind: "enquiry",
    id: enquiry.id,
    href: `/admin/enquiries/${enquiry.id}`,
    title: enquiry.subject || enquiry.enquiryNumber || `#${enquiry.id}`,
    detail: contact,
    at: enquiry.createdAt,
  };
}

/** A payment request that has been paid. `at` is the moment of payment. */
function paymentItem(order: Order): PulseItem {
  return { ...orderItem(order), kind: "payment", at: order.paidAt ?? order.updatedAt };
}

/* Orders that arrived as orders: everything except payment requests. */
const SHOP_ORDERS: Where = {
  or: [{ source: { exists: false } }, { source: { not_in: [...PAY_LINK_SOURCES] } }],
};

const PAID_REQUESTS: Where = {
  and: [{ source: { in: [...PAY_LINK_SOURCES] } }, { paidAt: { exists: true } }],
};

/**
 * Compared as instants, not as strings: `paidAt` is written by the database
 * and by Payload in two different ISO spellings of the same moment.
 */
const byNewest = (a: PulseItem, b: PulseItem) => new Date(b.at).getTime() - new Date(a.at).getTime();

/** Pure: what the three queries returned, merged, newest first. */
export function mergePulse(
  shopOrders: readonly Order[],
  paidRequests: readonly Order[],
  enquiries: readonly Enquiry[],
  since: Date | null,
  limit: number = LIMIT,
): { fresh: PulseItem[]; recent: PulseItem[] } {
  const recent = [
    ...shopOrders.filter((order) => !isPayLinkSource(order.source)).map(orderItem),
    ...paidRequests.filter((order) => isPayLinkSource(order.source) && order.paidAt).map(paymentItem),
    ...enquiries.map(enquiryItem),
  ]
    .sort(byNewest)
    .slice(0, limit);
  const fresh = since ? recent.filter((item) => new Date(item.at) > since) : [];
  return { fresh, recent };
}

export async function getAdminPulse(since: Date | null): Promise<AdminPulse> {
  const payload = await getPayload({ config });
  const now = new Date();

  const [orders, paid, enquiries] = await Promise.all([
    payload.find({
      collection: "orders",
      where: SHOP_ORDERS,
      sort: "-createdAt",
      limit: LIMIT,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: "orders",
      where: PAID_REQUESTS,
      sort: "-paidAt",
      limit: LIMIT,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({ collection: "enquiries", sort: "-createdAt", limit: LIMIT, depth: 0, overrideAccess: true }),
  ]);

  return { now: now.toISOString(), ...mergePulse(orders.docs, paid.docs, enquiries.docs, since) };
}
