import { cache } from "react";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Enquiry, Order } from "@/payload-types";
import {
  DAY_MS,
  OPEN_STATUSES,
  dailySeries,
  isOverdue,
  isPlaced,
  openStatusCounts,
  periodWindow,
  summariseOrders,
  topProducts,
  type DailyPoint,
  type DashboardPeriod,
  type OrderSummary,
  type PeriodWindow,
  type ProductRank,
} from "@backend/domain/dashboard";

/**
 * The dashboard's data, read as the signed-in user.
 *
 * Every query runs under NORMAL access control — no overrideAccess — so a
 * staff member's dashboard shows what the permission model lets staff see:
 * customer figures come back empty for them, and the screen says so.
 *
 * The arithmetic is not here; it is in backend/domain/dashboard.ts, pure and
 * unit tested. This file only fetches, and fetches each thing once.
 */

const WAITING_ENQUIRY = ["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER"];
const FOLLOW_UP_OPEN = ["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER", "QUOTED"];

export type ProductHealth = { total: number; live: number; hidden: number; noPhoto: number; outOfStock: number };

export type DashboardData = {
  window: PeriodWindow;
  current: OrderSummary;
  previous: OrderSummary;
  series: DailyPoint[];
  openStatus: { status: string; count: number }[];
  openTotal: number;
  newOrders: number;
  overdue: number;
  top: ProductRank[];
  todaysDeliveries: Order[];
  recentOrders: Order[];
  recentEnquiries: Enquiry[];
  ordersAllTime: number;
  enquiriesWaiting: number;
  followUpsDue: number;
  products: ProductHealth;
  /** Null when the viewer may not read customer accounts (staff). */
  customers: { total: number; newInPeriod: number } | null;
};

export const getDashboardData = cache(async (period: DashboardPeriod): Promise<DashboardData> => {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const opts = { user, overrideAccess: false } as const;
  const isOwner = (user as { role?: string } | null)?.role === "admin";

  const now = new Date();
  const window = periodWindow(now, period);
  const tomorrow = new Date(window.todayStart.getTime() + DAY_MS);

  const [
    windowOrders,
    openOrders,
    todays,
    recent,
    recentEnquiries,
    ordersAllTime,
    enquiriesWaiting,
    followUpsDue,
    products,
    customersTotal,
    customersNew,
  ] = await Promise.all([
    /* The current AND previous period in one read. */
    payload.find({
      collection: "orders",
      where: { createdAt: { greater_than_equal: window.previousStart.toISOString() } },
      sort: "createdAt",
      limit: 5000,
      depth: 0,
      ...opts,
    }),
    payload.find({
      collection: "orders",
      where: { fulfilmentStatus: { in: [...OPEN_STATUSES] } },
      sort: "deliveryDate",
      limit: 1000,
      depth: 0,
      ...opts,
    }),
    payload.find({
      collection: "orders",
      where: {
        and: [
          { deliveryDate: { greater_than_equal: window.todayStart.toISOString() } },
          { deliveryDate: { less_than: tomorrow.toISOString() } },
        ],
      },
      sort: "deliveryTimeSlot",
      limit: 100,
      depth: 0,
      ...opts,
    }),
    payload.find({ collection: "orders", sort: "-createdAt", limit: 6, depth: 0, ...opts }),
    payload
      .find({ collection: "enquiries", sort: "-createdAt", limit: 5, depth: 0, ...opts })
      .then((r) => r.docs)
      .catch(() => [] as Enquiry[]),
    payload.count({ collection: "orders", ...opts }).then((r) => r.totalDocs),
    payload
      .count({ collection: "enquiries", where: { status: { in: WAITING_ENQUIRY } }, ...opts })
      .then((r) => r.totalDocs)
      .catch(() => 0),
    payload
      .count({
        collection: "enquiries",
        where: {
          and: [{ status: { in: FOLLOW_UP_OPEN } }, { followUpAt: { less_than_equal: now.toISOString() } }],
        },
        ...opts,
      })
      .then((r) => r.totalDocs)
      .catch(() => 0),
    payload.find({
      collection: "products",
      limit: 1000,
      depth: 0,
      select: { available: true, images: true, trackStock: true, stock: true },
      ...opts,
    }),
    isOwner
      ? payload
          .count({ collection: "users", where: { role: { equals: "customer" } }, ...opts })
          .then((r) => r.totalDocs)
          .catch(() => null)
      : Promise.resolve(null),
    isOwner
      ? payload
          .count({
            collection: "users",
            where: {
              and: [{ role: { equals: "customer" } }, { createdAt: { greater_than_equal: window.start.toISOString() } }],
            },
            ...opts,
          })
          .then((r) => r.totalDocs)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const startMs = window.start.getTime();
  const inPeriod = windowOrders.docs.filter((o) => new Date(o.createdAt).getTime() >= startMs);
  const before = windowOrders.docs.filter((o) => new Date(o.createdAt).getTime() < startMs);

  const health: ProductHealth = { total: 0, live: 0, hidden: 0, noPhoto: 0, outOfStock: 0 };
  for (const product of products.docs) {
    const photos = (product.images ?? []).length;
    health.total += 1;
    if (product.available && photos > 0) health.live += 1;
    else health.hidden += 1;
    if (photos === 0) health.noPhoto += 1;
    if (product.available && product.trackStock && Number(product.stock ?? 0) <= 0) health.outOfStock += 1;
  }

  return {
    window,
    current: summariseOrders(inPeriod),
    previous: summariseOrders(before),
    series: dailySeries(inPeriod, window),
    openStatus: openStatusCounts(openOrders.docs),
    openTotal: openOrders.docs.length,
    newOrders: openOrders.docs.filter((o) => o.fulfilmentStatus === "NEW").length,
    overdue: openOrders.docs.filter((o) => isOverdue(o, window.todayStart)).length,
    top: topProducts(inPeriod),
    todaysDeliveries: todays.docs.filter(isPlaced),
    recentOrders: recent.docs,
    recentEnquiries,
    ordersAllTime,
    enquiriesWaiting,
    followUpsDue,
    products: health,
    customers: customersTotal === null ? null : { total: customersTotal, newInPeriod: customersNew ?? 0 },
  };
});
