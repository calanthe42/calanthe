import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Order } from "@/payload-types";
import type { SeriesPoint } from "@admin/components/Charts";

/**
 * The dashboard's data, read as the signed-in user.
 *
 * Everything is derived from real orders. A day with no orders is a zero, not
 * a gap and not an invention — the chart tells the truth about a quiet week.
 */

export type Period = 7 | 30 | 90;

export function parsePeriod(value: string | undefined): Period {
  const n = Number(value);
  return n === 30 || n === 90 ? n : 7;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isPaid(order: Order): boolean {
  return order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED";
}

export type DashboardData = {
  series: SeriesPoint[];
  ordersInPeriod: number;
  revenueInPeriodFils: number;
  previousRevenueFils: number;
  statusCounts: { label: string; value: number; className: string }[];
  statusTotal: number;
  bestSellers: { name: string; units: number; revenueFils: number }[];
  needsAttention: Order[];
  todaysDeliveries: Order[];
  recent: Order[];
};

const STATUS_STYLE: { key: string; label: string; className: string }[] = [
  { key: "NEW", label: "New", className: "bg-olive/70" },
  { key: "CONFIRMED", label: "Confirmed", className: "bg-olive/45" },
  { key: "PREPARING", label: "Preparing", className: "bg-[#b55b29]/80" },
  { key: "READY", label: "Ready", className: "bg-[#b55b29]/55" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", className: "bg-[#b55b29]/35" },
  { key: "DELIVERED", label: "Delivered", className: "bg-[#4a6741]/70" },
  { key: "CANCELLED", label: "Cancelled", className: "bg-burgundy/60" },
];

export async function getDashboardData(period: Period): Promise<DashboardData> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (period - 1));
  start.setHours(0, 0, 0, 0);

  /* The previous window of equal length, for the comparison. */
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - period);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [windowOrders, previousOrders, openOrders, todays, recent] = await Promise.all([
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
      where: { fulfilmentStatus: { in: ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] } },
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
  ]);

  /* One bucket per day so quiet days are visible rather than skipped. */
  const buckets = new Map<string, { orders: number; revenueFils: number }>();
  for (let i = 0; i < period; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.set(dayKey(d), { orders: 0, revenueFils: 0 });
  }

  for (const order of windowOrders.docs) {
    const key = dayKey(new Date(order.createdAt));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    if (isPaid(order)) bucket.revenueFils += Number(order.totalFils ?? 0);
  }

  const series: SeriesPoint[] = [...buckets.entries()].map(([iso, value]) => ({
    iso,
    label: new Date(iso).toLocaleDateString("en-AE", { day: "numeric", month: "short" }),
    orders: value.orders,
    revenueFils: value.revenueFils,
  }));

  const revenueInPeriodFils = series.reduce((sum, p) => sum + p.revenueFils, 0);
  const previousRevenueFils = previousOrders.docs
    .filter(isPaid)
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

  /* Needs attention: a delivery date that has passed while the order is
     still open. Nothing is invented — this is a real operational failure. */
  const needsAttention = openOrders.docs.filter(
    (o) => new Date(o.deliveryDate).getTime() < todayStart.getTime(),
  );

  return {
    series,
    ordersInPeriod: windowOrders.totalDocs,
    revenueInPeriodFils,
    previousRevenueFils,
    statusCounts,
    statusTotal: openOrders.docs.length,
    bestSellers,
    needsAttention,
    todaysDeliveries: todays.docs,
    recent: recent.docs,
  };
}
