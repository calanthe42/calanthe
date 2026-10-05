import { describe, expect, it } from "vitest";
import { QUOTE_SOURCE } from "@backend/payments/pay-link";
import {
  QUOTE_ORDER_SOURCE,
  dailySeries,
  isAwaitingQuote,
  isOpen,
  isOverdue,
  isPaidQuoteToStart,
  isPlaced,
  quoteQueue,
  openStatusCounts,
  parsePeriod,
  percentChange,
  periodWindow,
  summariseOrders,
  topProducts,
  uaeDayStart,
  type OrderLike,
} from "./dashboard";

const order = (overrides: Partial<OrderLike>): OrderLike => ({
  createdAt: "2026-09-10T08:00:00.000Z",
  totalFils: 10_000,
  paymentStatus: "PENDING",
  fulfilmentStatus: "NEW",
  items: [],
  ...overrides,
});

describe("parsePeriod", () => {
  it("accepts 7, 30 and 90 and defaults everything else to 7", () => {
    expect(parsePeriod("30")).toBe(30);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("365")).toBe(7);
    expect(parsePeriod(undefined)).toBe(7);
    expect(parsePeriod("abc")).toBe(7);
  });
});

describe("UAE days", () => {
  it("puts 01:30 in Dubai on the Dubai day, not the previous UTC day", () => {
    /* 21:30 UTC on the 10th is 01:30 on the 11th in Dubai. */
    const start = uaeDayStart(new Date("2026-09-10T21:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-09-10T20:00:00.000Z");
  });

  it("builds a window that includes today and an equal previous window", () => {
    const window = periodWindow(new Date("2026-09-11T10:00:00.000Z"), 7);
    expect(window.todayStart.toISOString()).toBe("2026-09-10T20:00:00.000Z");
    expect(window.start.toISOString()).toBe("2026-09-04T20:00:00.000Z");
    expect(window.previousStart.toISOString()).toBe("2026-08-28T20:00:00.000Z");
  });
});

describe("summariseOrders", () => {
  it("counts placed orders, excludes cancelled ones, and reports paid money separately", () => {
    const summary = summariseOrders([
      order({ totalFils: 48_000 }),
      order({ totalFils: 25_000, paymentStatus: "PAID", fulfilmentStatus: "DELIVERED" }),
      order({ totalFils: 99_900, fulfilmentStatus: "CANCELLED" }),
      order({ totalFils: 10_000, paymentStatus: "PARTIALLY_REFUNDED", fulfilmentStatus: "DELIVERED" }),
    ]);
    expect(summary.orders).toBe(3);
    expect(summary.revenueFils).toBe(83_000);
    expect(summary.paidFils).toBe(35_000);
  });

  it("never lets a missing or negative amount corrupt a total", () => {
    const summary = summariseOrders([order({ totalFils: null }), order({ totalFils: -500 })]);
    expect(summary.revenueFils).toBe(0);
    expect(summary.orders).toBe(2);
  });

  it("is all zeros for a quiet period", () => {
    expect(summariseOrders([])).toEqual({ orders: 0, revenueFils: 0, paidFils: 0 });
  });
});

describe("dailySeries", () => {
  const window = periodWindow(new Date("2026-09-11T10:00:00.000Z"), 7);

  it("has one bucket per day, zeros included", () => {
    const series = dailySeries([], window);
    expect(series).toHaveLength(7);
    expect(series[0]?.day).toBe("2026-09-05");
    expect(series[6]?.day).toBe("2026-09-11");
    expect(series.every((p) => p.orders === 0 && p.revenueFils === 0)).toBe(true);
  });

  it("assigns an order to its Dubai day and skips cancelled orders", () => {
    const series = dailySeries(
      [
        order({ createdAt: "2026-09-10T21:00:00.000Z", totalFils: 30_000 }),
        order({ createdAt: "2026-09-10T21:00:00.000Z", fulfilmentStatus: "CANCELLED" }),
        order({ createdAt: "2026-08-01T08:00:00.000Z" }),
      ],
      window,
    );
    const today = series.find((p) => p.day === "2026-09-11");
    expect(today).toEqual({ day: "2026-09-11", orders: 1, revenueFils: 30_000 });
    expect(series.reduce((n, p) => n + p.orders, 0)).toBe(1);
  });
});

describe("percentChange", () => {
  it("is null when there is nothing to compare against", () => {
    expect(percentChange(5000, 0)).toBeNull();
  });
  it("rounds to a whole percent in either direction", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 150)).toBe(-67);
    expect(percentChange(100, 100)).toBe(0);
  });
});

describe("topProducts", () => {
  it("groups by product id, keeps the latest name, and ignores cancelled orders", () => {
    const ranks = topProducts([
      order({ items: [{ productName: "Amber Hour", product: 1, quantity: 2, lineTotalFils: 96_000 }] }),
      order({ items: [{ productName: "Amber Hour (new name)", product: { id: 1 }, quantity: 1, lineTotalFils: 48_000 }] }),
      order({ items: [{ productName: "Quiet Devotion", product: 2, quantity: 5, lineTotalFils: 150_000 }], fulfilmentStatus: "CANCELLED" }),
      order({ items: [{ productName: "Deleted bouquet", product: null, quantity: 1, lineTotalFils: 20_000 }] }),
    ]);
    expect(ranks).toEqual([
      { key: "id:1", name: "Amber Hour (new name)", units: 3, revenueFils: 144_000 },
      { key: "name:Deleted bouquet", name: "Deleted bouquet", units: 1, revenueFils: 20_000 },
    ]);
  });
});

describe("isOverdue", () => {
  const todayStart = new Date("2026-09-10T20:00:00.000Z");

  it("flags an open order whose delivery day has passed", () => {
    expect(isOverdue(order({ fulfilmentStatus: "PREPARING", deliveryDate: "2026-09-09T20:00:00.000Z" }), todayStart)).toBe(true);
  });
  it("does not flag delivered, cancelled or today's orders", () => {
    expect(isOverdue(order({ fulfilmentStatus: "DELIVERED", deliveryDate: "2026-09-01T20:00:00.000Z" }), todayStart)).toBe(false);
    expect(isOverdue(order({ fulfilmentStatus: "CANCELLED", deliveryDate: "2026-09-01T20:00:00.000Z" }), todayStart)).toBe(false);
    expect(isOverdue(order({ fulfilmentStatus: "NEW", deliveryDate: "2026-09-10T20:00:00.000Z" }), todayStart)).toBe(false);
    expect(isOverdue(order({ fulfilmentStatus: "NEW", deliveryDate: null }), todayStart)).toBe(false);
  });
});

describe("openStatusCounts", () => {
  it("lists every open status in workflow order, zeros included", () => {
    const counts = openStatusCounts([order({ fulfilmentStatus: "NEW" }), order({ fulfilmentStatus: "NEW" }), order({ fulfilmentStatus: "READY" })]);
    expect(counts).toEqual([
      { status: "NEW", count: 2 },
      { status: "CONFIRMED", count: 0 },
      { status: "PREPARING", count: 0 },
      { status: "READY", count: 1 },
      { status: "OUT_FOR_DELIVERY", count: 0 },
    ]);
  });
});

/**
 * AN UNPAID PAYMENT REQUEST IS NOT AN ORDER YET.
 *
 * Confirming an enquiry creates an order row so the customer has something
 * to pay. Until they do, it must not look like a sale, like work waiting for
 * the florist, or like a delivery — a florist who reads "Today's deliveries"
 * would otherwise prepare flowers nobody has paid for.
 */
describe("unpaid payment requests", () => {
  const unpaidQuote = (overrides: Partial<OrderLike> = {}): OrderLike =>
    order({ source: "admin-quote", totalFils: 65_000, paymentStatus: "PENDING", fulfilmentStatus: "NEW", ...overrides });
  const paidQuote = (overrides: Partial<OrderLike> = {}): OrderLike =>
    unpaidQuote({ paymentStatus: "PAID", fulfilmentStatus: "CONFIRMED", ...overrides });
  const todayStart = new Date("2026-09-10T20:00:00.000Z");

  it("uses the same source value the payments code writes", () => {
    expect(QUOTE_ORDER_SOURCE).toBe(QUOTE_SOURCE);
  });

  it("recognises one — and stops recognising it the moment it is paid", () => {
    expect(isAwaitingQuote(unpaidQuote())).toBe(true);
    expect(isAwaitingQuote(unpaidQuote({ paymentStatus: "FAILED" }))).toBe(true);
    expect(isAwaitingQuote(paidQuote())).toBe(false);
    expect(isAwaitingQuote(unpaidQuote({ paymentStatus: "REFUNDED" }))).toBe(false);
    expect(isAwaitingQuote(order({ source: "web-checkout-card" }))).toBe(false);
    expect(isAwaitingQuote(order({}))).toBe(false);
  });

  it("is not revenue and not an order in the summary", () => {
    const summary = summariseOrders([order({ totalFils: 48_000 }), unpaidQuote()]);
    expect(summary.orders).toBe(1);
    expect(summary.revenueFils).toBe(48_000);
    expect(summary.paidFils).toBe(0);
  });

  it("becomes revenue once it is paid", () => {
    const summary = summariseOrders([order({ totalFils: 48_000 }), paidQuote()]);
    expect(summary.orders).toBe(2);
    expect(summary.revenueFils).toBe(113_000);
    expect(summary.paidFils).toBe(65_000);
  });

  it("is absent from the daily chart", () => {
    const window = periodWindow(new Date("2026-09-11T10:00:00.000Z"), 7);
    const createdAt = "2026-09-11T06:00:00.000Z";
    const series = dailySeries([order({ createdAt, totalFils: 48_000 }), unpaidQuote({ createdAt })], window);
    const today = series.at(-1)!;
    expect(today.orders).toBe(1);
    expect(today.revenueFils).toBe(48_000);
  });

  it("is absent from the best-sellers", () => {
    const items = [{ productName: "Bespoke arrangement", quantity: 1, lineTotalFils: 65_000 }];
    expect(topProducts([unpaidQuote({ items })])).toEqual([]);
    expect(topProducts([paidQuote({ items })])).toHaveLength(1);
  });

  it("is not placed, so it is not on today's delivery list", () => {
    expect(isPlaced(unpaidQuote())).toBe(false);
    expect(isPlaced(paidQuote())).toBe(true);
  });

  it("is not open work and not a new order waiting to be confirmed", () => {
    expect(isOpen(unpaidQuote())).toBe(false);
    const counts = openStatusCounts([order({}), unpaidQuote()]);
    expect(counts.find((c) => c.status === "NEW")?.count).toBe(1);
  });

  it("is never overdue, however long the link has been dead", () => {
    const deliveryDate = "2026-09-01T08:00:00.000Z";
    expect(isOverdue(unpaidQuote({ deliveryDate }), todayStart)).toBe(false);
    /* A paid one is real work, and can be late like any other. */
    expect(isOverdue(paidQuote({ deliveryDate }), todayStart)).toBe(true);
  });

  it("is counted as paid-and-waiting-to-start once it is paid, until someone starts it", () => {
    expect(isPaidQuoteToStart(paidQuote())).toBe(true);
    expect(isPaidQuoteToStart(paidQuote({ fulfilmentStatus: "PREPARING" }))).toBe(false);
    expect(isPaidQuoteToStart(unpaidQuote())).toBe(false);
    expect(isPaidQuoteToStart(order({ paymentStatus: "PAID", fulfilmentStatus: "CONFIRMED" }))).toBe(false);
  });

  it("sorts requests into awaiting, expired and paid-to-start", () => {
    const now = new Date("2026-09-11T10:00:00.000Z");
    const queue = quoteQueue(
      [
        { ...unpaidQuote(), payLinkExpiresAt: "2026-09-12T10:00:00.000Z" },
        { ...unpaidQuote(), payLinkExpiresAt: "2026-09-13T10:00:00.000Z" },
        { ...unpaidQuote(), payLinkExpiresAt: "2026-09-10T10:00:00.000Z" },
        { ...unpaidQuote(), payLinkExpiresAt: null },
        { ...unpaidQuote({ fulfilmentStatus: "CANCELLED" }), payLinkExpiresAt: "2026-09-12T10:00:00.000Z" },
        paidQuote(),
        order({}),
      ],
      now,
    );
    expect(queue).toEqual({ awaiting: 2, expired: 2, paidToStart: 1 });
  });
});
