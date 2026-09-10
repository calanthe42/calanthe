import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Enquiry, Order } from "@/payload-types";
import type { SeriesPoint } from "@admin/components/Charts";
import { dubaiDateInputValue } from "@backend/domain/dates";

/**
 * The dashboard's data, read as the signed-in user.
 *
 * Everything is derived from real orders. A day with no orders is a zero, not
 * a gap and not an invention — the chart tells the truth about a quiet week.
 *
 * DAYS ARE UAE DAYS. The server runs in UTC, so "today" computed from the
 * server's clock started at 04:00 in Dubai: an order placed at 02:00 on a
 * Tuesday landed on Monday's bar, and "today's deliveries" missed the first
 * four hours of the morning. Day boundaries are now midnight Asia/Dubai.
 */

export type Period = 7 | 30 | 90;

export function parsePeriod(value: string | undefined): Period {
  const n = Number(value);
  return n === 30 || n === 90 ? n : 7;
}

const DAY_MS = 86_400_000;

/** Midnight in the UAE on the day containing `date`. The UAE has no DST. */
function uaeDayStart(date: Date): Date {
  return new Date(`${dubaiDateInputValue(date.toISOString())}T00:00:00+04:00`);
}

function isPaid(order: Order): boolean {
  return order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED";
}

export type DashboardData = {
  series: SeriesPoint[];
  ordersInPeriod: number;
  revenueInPeriodFils: number;
  previousRevenueFils: number;
  /** Placed, not cancelled, not yet paid — cash on delivery included. */
  awaitingPaymentFils: number;
  statusCounts: { label: string; value: number; className: string }[];
  statusTotal: number;
  bestSellers: { name: string; units: number; revenueFils: number }[];
  needsAttention: Order[];
  todaysDeliveries: Order[];
  recent: Order[];
  recentEnquiries: Enquiry[];
};

const STATUS_STYLE: { key: string; label: string; className: string }[] = [
  { key: "NEW", label: "New", className: "bg-olive/70" },
  { key: "CONFIRMED", label: "Confirmed", className: "bg-olive/45" },
  { key: "PREPARING", label: "Being prepared", className: "bg-[#b55b29]/80" },
  { key: "READY", label: "Ready to go", className: "bg-[#b55b29]/55" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", className: "bg-[#b55b29]/35" },
  { key: "DELIVERED", label: "Delivered", className: "bg-[#4a6741]/70" },
  { key: "CANCELLED", label: "Cancelled", className: "bg-burgundy/60" },
];

export async function getDashboardData(period: Period): Promise<DashboardData> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const now = new Date();
  const todayStart = uaeDayStart(now);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const start = new Date(todayStart.getTime() - (period - 1) * DAY_MS);
  /* The previous window of equal length, for the comparison. */
  const prevStart = new Date(start.getTime() - period * DAY_MS);

  const [windowOrders, previousOrders, openOrders, todays, recent, recentEnquiries] =
    await Promise.all([
      payload.find({
        collection: "orders",
        where: { createdAt: { greater_than_equal: start.toISOString() } },
        limit: 1000,
        depth: 0,
        sort: "createdAt",
        user,
      }),
      payload.find({
        collection: "orders",
        where: {
          and: [
            { createdAt: { greater_than_equal: prevStart.toISOString() } },
            { createdAt: { less_than: start.toISOString() } },
          ],
        },
        limit: 1000,
        depth: 0,
        user,
      }),
      payload.find({
        collection: "orders",
        where: {
          fulfilmentStatus: { in: ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] },
        },
        limit: 200,
        depth: 0,
        sort: "deliveryDate",
        user,
      }),
      payload.find({
        collection: "orders",
        where: {
          and: [
            { deliveryDate: { greater_than_equal: todayStart.toISOString() } },
            { deliveryDate: { less_than: todayEnd.toISOString() } },
          ],
        },
        limit: 100,
        depth: 0,
        sort: "deliveryTimeSlot",
        user,
      }),
      payload.find({ collection: "orders", sort: "-createdAt", limit: 6, depth: 0, user }),
      payload
        .find({ collection: "enquiries", sort: "-createdAt", limit: 5, depth: 0, user })
        .then((r) => r.docs)
        .catch(() => [] as Enquiry[]),
    ]);

  /* One bucket per UAE day so quiet days are visible rather than skipped. */
  const buckets = new Map<string, { orders: number; revenueFils: number }>();
  for (let i = 0; i < period; i += 1) {
    const key = dubaiDateInputValue(new Date(start.getTime() + i * DAY_MS).toISOString());
    buckets.set(key, { orders: 0, revenueFils: 0 });
  }

  for (const order of windowOrders.docs) {
    const bucket = buckets.get(dubaiDateInputValue(order.createdAt));
    if (!bucket) continue;
    bucket.orders += 1;
    if (isPaid(order)) bucket.revenueFils += Number(order.totalFils ?? 0);
  }

  const series: SeriesPoint[] = [...buckets.entries()].map(([iso, value]) => ({
    iso,
    label: new Date(`${iso}T12:00:00+04:00`).toLocaleDateString("en-AE", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Dubai",
    }),
    orders: value.orders,
    revenueFils: value.revenueFils,
  }));

  const revenueInPeriodFils = series.reduce((sum, p) => sum + p.revenueFils, 0);
  const previousRevenueFils = previousOrders.docs
    .filter(isPaid)
    .reduce((sum, o) => sum + Number(o.totalFils ?? 0), 0);

  const awaitingPaymentFils = windowOrders.docs
    .filter(
      (o) =>
        !isPaid(o) &&
        o.fulfilmentStatus !== "CANCELLED" &&
        (o.paymentStatus === "PENDING" || o.paymentStatus === "AUTHORIZED"),
    )
    .reduce((sum, o) => sum + Number(o.totalFils ?? 0), 0);

  /* Status distribution across every open order, not just this window —
     a job started three weeks ago still needs finishing. */
  const statusCounts = STATUS_STYLE.map((s) => ({
    label: s.label,
    className: s.className,
    value: openOrders.docs.filter((o) => o.fulfilmentStatus === s.key).length,
  }));

  /* Best sellers, counted from the order snapshots so the ranking stays
     correct even after a product is renamed or removed. */
  const sales = new Map<string, { units: number; revenueFils: number }>();
  for (const order of windowOrders.docs) {
    if (!isPaid(order)) continue;
    for (const item of order.items ?? []) {
      const entry = sales.get(item.productName) ?? { units: 0, revenueFils: 0 };
      entry.units += Number(item.quantity ?? 0);
      entry.revenueFils += Number(item.lineTotalFils ?? 0);
      sales.set(item.productName, entry);
    }
  }
  const bestSellers = [...sales.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  /* Overdue: a delivery date before today (UAE) while the order is still
     open. Nothing is invented — this is a real operational failure. */
  const needsAttention = openOrders.docs.filter(
    (o) => new Date(o.deliveryDate).getTime() < todayStart.getTime(),
  );

  return {
    series,
    ordersInPeriod: windowOrders.totalDocs,
    revenueInPeriodFils,
    previousRevenueFils,
    awaitingPaymentFils,
    statusCounts,
    statusTotal: openOrders.docs.length,
    bestSellers,
    needsAttention,
    todaysDeliveries: todays.docs,
    recent: recent.docs,
    recentEnquiries,
  };
}
