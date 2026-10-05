import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/payload-types";
import type { CouponRule } from "@/lib/discounts";

/**
 * The free-delivery threshold is measured AFTER the discount code.
 *
 * Delivery is complimentary everywhere today, so with the real configuration
 * this rule could not be seen — and a rule that cannot be seen is the one
 * that is wrong on the day a delivery fee returns. This file swaps in a zone
 * that charges AED 25 below AED 350, and pins the rule against it.
 */
vi.mock("@/lib/data", async (original) => ({
  ...(await original<typeof import("@/lib/data")>()),
  deliveryZones: [{ id: "abu-dhabi", name: "Abu Dhabi", feeAed: 25 }],
  FREE_DELIVERY_THRESHOLD_AED: 350,
}));

const { priceOrder } = await import("./pricing");

const product = (priceFils: number): Product =>
  ({
    id: 1,
    name: "Amber Hour",
    slug: "amber-hour",
    priceFils,
    currency: "AED",
    category: "bouquet",
    available: true,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
  }) as Product;

const line = { productId: "1", quantity: 1, sizeId: "standard" as const, addonIds: [] as never[] };

const coupon = (amountOffFils: number): CouponRule => ({
  id: "9",
  title: "TAKE",
  code: "TAKE",
  active: true,
  valueType: "fixed",
  percentOff: 0,
  amountOffFils,
  minSubtotalFils: 0,
  usageLimit: null,
  timesUsed: 0,
  oncePerCustomer: false,
});

const NOW = new Date("2026-10-05T10:00:00.000Z");
const price = (priceFils: number, code: CouponRule | null) =>
  priceOrder([line], new Map([["1", product(priceFils)]]), "abu-dhabi", {
    sales: [],
    coupon: code,
    emailHasUsedCoupon: false,
    now: NOW,
  });

describe("delivery, with a fee and a threshold", () => {
  it("is free at the threshold and charged below it", () => {
    expect(price(35000, null).deliveryFeeFils).toBe(0);
    expect(price(34900, null).deliveryFeeFils).toBe(2500);
  });

  it("is charged when the code takes the order below the threshold", () => {
    /* AED 380 − 50 = 330: under 350, so delivery is no longer free. */
    const order = price(38000, coupon(5000));
    expect(order.deliveryFeeFils).toBe(2500);
    expect(order.totalFils).toBe(38000 - 5000 + 2500);
  });

  it("stays free when the order is still at the threshold after the code", () => {
    const order = price(40000, coupon(5000));
    expect(order.deliveryFeeFils).toBe(0);
    expect(order.totalFils).toBe(35000);
  });

  it("never discounts the delivery fee itself", () => {
    /* A code as large as the basket takes the basket, not the delivery. */
    const order = price(10000, coupon(10000));
    expect(order.couponDiscountFils).toBe(10000);
    expect(order.deliveryFeeFils).toBe(2500);
    expect(order.totalFils).toBe(2500);
  });
});
