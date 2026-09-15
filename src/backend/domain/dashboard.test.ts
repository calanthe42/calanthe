import { describe, expect, it } from "vitest";
import {
  dailySeries,
  isOverdue,
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
