import { dubaiDateInputValue, uaeMidnight } from "@backend/domain/dates";

/**
 * The dashboard's arithmetic.
 *
 * PURE — orders in, numbers out, no database and no clock (the current time is
 * passed in) — so every figure the owner reads is unit tested.
 *
 * NOTHING IS SYNTHESISED. A quiet day is a zero, not a gap and not an
 * estimate. Money is integer fils throughout and only formatted at the edge.
 *
 * DAYS ARE UAE DAYS. The server runs in UTC; an order placed at 02:00 in Dubai
 * belongs to that Dubai day, not the previous UTC one.
 *
 * REVENUE COUNTS PLACED ORDERS, cancelled excluded. Every order today is cash
 * on delivery, and cash is not yet recorded as paid in the system, so a
 * paid-only figure would read zero forever. Paid money is reported alongside
 * it, separately, so the two are never confused.
 */

export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DAY_MS = 86_400_000;

export function parsePeriod(value: string | undefined): DashboardPeriod {
  const n = Number(value);
  return n === 30 || n === 90 ? n : 7;
}

export type OrderItemLike = {
  productName: string;
  quantity?: number | null;
  lineTotalFils?: number | null;
  product?: number | { id: number } | null;
};

export type OrderLike = {
  createdAt: string;
  totalFils?: number | null;
  paymentStatus?: string | null;
  fulfilmentStatus?: string | null;
  deliveryDate?: string | null;
  items?: readonly OrderItemLike[] | null;
};

export const OPEN_STATUSES = ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] as const;
const OPEN = new Set<string>(OPEN_STATUSES);
const PAID = new Set(["PAID", "PARTIALLY_REFUNDED"]);

export const isPlaced = (order: OrderLike): boolean => order.fulfilmentStatus !== "CANCELLED";
export const isPaid = (order: OrderLike): boolean => PAID.has(order.paymentStatus ?? "");
export const isOpen = (order: OrderLike): boolean => OPEN.has(order.fulfilmentStatus ?? "");

/** A stored amount as safe, non-negative integer fils. */
function fils(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Midnight in the UAE at the start of the day containing `at`. The UAE has no DST. */
export function uaeDayStart(at: Date): Date {
  return uaeMidnight(dubaiDateInputValue(at.toISOString()));
}

export type PeriodWindow = {
  days: DashboardPeriod;
  /** First UAE midnight inside the period (today counts as one of its days). */
  start: Date;
  /** The start of the equally long period immediately before. */
  previousStart: Date;
  todayStart: Date;
};

export function periodWindow(now: Date, days: DashboardPeriod): PeriodWindow {
  const todayStart = uaeDayStart(now);
  const start = new Date(todayStart.getTime() - (days - 1) * DAY_MS);
  return { days, start, previousStart: new Date(start.getTime() - days * DAY_MS), todayStart };
}

export type OrderSummary = { orders: number; revenueFils: number; paidFils: number };

export function summariseOrders(orders: readonly OrderLike[]): OrderSummary {
  let count = 0;
  let revenueFils = 0;
  let paidFils = 0;
  for (const order of orders) {
    if (isPlaced(order)) {
      count += 1;
      revenueFils += fils(order.totalFils);
    }
    if (isPaid(order)) paidFils += fils(order.totalFils);
  }
  return { orders: count, revenueFils, paidFils };
}

export type DailyPoint = { day: string; orders: number; revenueFils: number };

/** One bucket per UAE day in the window, so quiet days are drawn as zero. */
export function dailySeries(orders: readonly OrderLike[], window: PeriodWindow): DailyPoint[] {
  const buckets = new Map<string, DailyPoint>();
  for (let i = 0; i < window.days; i += 1) {
    const day = dubaiDateInputValue(new Date(window.start.getTime() + i * DAY_MS).toISOString());
    buckets.set(day, { day, orders: 0, revenueFils: 0 });
  }
  for (const order of orders) {
    if (!isPlaced(order)) continue;
    const bucket = buckets.get(dubaiDateInputValue(order.createdAt));
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenueFils += fils(order.totalFils);
  }
  return [...buckets.values()];
}

/** Whole-percent change, or null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type ProductRank = { key: string; name: string; units: number; revenueFils: number };

/**
 * Best-selling products, counted from each order's own snapshot.
 *
 * Grouped by product id where the order kept one, by the snapshot name
 * otherwise, and shown under the most recent name — so a renamed product is
 * still one line, and a deleted one still counts.
 */
export function topProducts(orders: readonly OrderLike[], limit = 5): ProductRank[] {
  const ranks = new Map<string, ProductRank>();
  for (const order of orders) {
    if (!isPlaced(order)) continue;
    for (const item of order.items ?? []) {
      const id = typeof item.product === "object" && item.product ? item.product.id : item.product;
      const key = typeof id === "number" ? `id:${id}` : `name:${item.productName}`;
      const entry = ranks.get(key) ?? { key, name: item.productName, units: 0, revenueFils: 0 };
      entry.name = item.productName;
      entry.units += Math.max(0, Math.round(Number(item.quantity ?? 0)));
      entry.revenueFils += fils(item.lineTotalFils);
      ranks.set(key, entry);
    }
  }
  return [...ranks.values()]
    .sort((a, b) => b.units - a.units || b.revenueFils - a.revenueFils || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Still open after its delivery day (UAE) has passed — a real operational failure. */
export function isOverdue(order: OrderLike, todayStart: Date): boolean {
  if (!isOpen(order) || !order.deliveryDate) return false;
  const due = new Date(order.deliveryDate).getTime();
  return Number.isFinite(due) && due < todayStart.getTime();
}

/** Open orders by fulfilment status, in workflow order, zeros included. */
export function openStatusCounts(orders: readonly OrderLike[]): { status: string; count: number }[] {
  return OPEN_STATUSES.map((status) => ({
    status,
    count: orders.filter((order) => order.fulfilmentStatus === status).length,
  }));
}
