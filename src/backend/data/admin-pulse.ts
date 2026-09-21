import { getPayload } from "payload";
import config from "@payload-config";
import type { Enquiry, Order } from "@/payload-types";

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
 * Read-only, small (two bounded queries), and shaped for the screen: a title,
 * a line of detail and a link, in whichever order they arrived.
 */
export type PulseItem = {
  kind: "order" | "enquiry";
  id: number;
  href: string;
  /** "CAL-000031" / the enquiry's subject */
  title: string;
  /** "Nati Ahmed · AED 480" / "Build your own · Nati Ahmed" */
  detail: string;
  amountFils?: number;
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

const byNewest = (a: PulseItem, b: PulseItem) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

export async function getAdminPulse(since: Date | null): Promise<AdminPulse> {
  const payload = await getPayload({ config });
  const now = new Date();

  const [orders, enquiries] = await Promise.all([
    payload.find({ collection: "orders", sort: "-createdAt", limit: LIMIT, depth: 0, overrideAccess: true }),
    payload.find({ collection: "enquiries", sort: "-createdAt", limit: LIMIT, depth: 0, overrideAccess: true }),
  ]);

  const recent = [...orders.docs.map(orderItem), ...enquiries.docs.map(enquiryItem)].sort(byNewest).slice(0, LIMIT);
  const fresh = since ? recent.filter((item) => new Date(item.at) > since) : [];

  return { now: now.toISOString(), fresh, recent };
}
