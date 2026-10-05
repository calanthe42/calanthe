import { describe, expect, it } from "vitest";
import { summariseDiscountUsage, type UsageOrder } from "./discount-usage";

/**
 * The Performance card and the list's "Used" column, from order snapshots.
 */

const SALE = 7;
const CODE = 9;

const line = (over: Partial<NonNullable<UsageOrder["items"]>[number]> = {}) => ({
  quantity: 1,
  unitPriceFils: 38400,
  compareAtUnitPriceFils: 48000,
  sale: SALE,
  ...over,
});

describe("summariseDiscountUsage", () => {
  it("counts nothing when no order used a discount", () => {
    const usage = summariseDiscountUsage([
      { totalFils: 48000, items: [{ quantity: 1, unitPriceFils: 48000 }] },
    ]);
    expect(usage.size).toBe(0);
  });

  it("adds up what a sale took off, per unit and quantity", () => {
    const usage = summariseDiscountUsage([
      { totalFils: 76800, items: [line({ quantity: 2 })] },
    ]);
    expect(usage.get(SALE)).toEqual({ orders: 1, discountFils: 19200, salesFils: 76800 });
  });

  it("counts an order once however many of its lines were on the sale", () => {
    const usage = summariseDiscountUsage([
      { totalFils: 76800, items: [line(), line()] },
      { totalFils: 38400, items: [line()] },
    ]);
    expect(usage.get(SALE)).toEqual({ orders: 2, discountFils: 28800, salesFils: 115200 });
  });

  it("reports a code from the amount stored on the order", () => {
    const usage = summariseDiscountUsage([
      {
        totalFils: 43000,
        couponDiscount: CODE,
        couponDiscountFils: 5000,
        items: [{ quantity: 1, unitPriceFils: 48000 }],
      },
    ]);
    expect(usage.get(CODE)).toEqual({ orders: 1, discountFils: 5000, salesFils: 43000 });
  });

  it("counts an order for both its sale and the code on top", () => {
    const usage = summariseDiscountUsage([
      { totalFils: 34400, couponDiscount: CODE, couponDiscountFils: 4000, items: [line()] },
    ]);
    expect(usage.get(SALE)).toEqual({ orders: 1, discountFils: 9600, salesFils: 34400 });
    expect(usage.get(CODE)).toEqual({ orders: 1, discountFils: 4000, salesFils: 34400 });
  });

  it("reads a populated relationship as well as a bare id", () => {
    const usage = summariseDiscountUsage([
      {
        totalFils: 34400,
        couponDiscount: { id: CODE },
        couponDiscountFils: 4000,
        items: [line({ sale: { id: SALE } })],
      },
    ]);
    expect(usage.get(SALE)?.orders).toBe(1);
    expect(usage.get(CODE)?.orders).toBe(1);
  });

  it("never reports a negative saving for a line whose regular price is not higher", () => {
    const usage = summariseDiscountUsage([
      { totalFils: 48000, items: [line({ compareAtUnitPriceFils: null, unitPriceFils: 48000 })] },
      { totalFils: 48000, items: [line({ compareAtUnitPriceFils: 40000, unitPriceFils: 48000 })] },
    ]);
    expect(usage.get(SALE)).toEqual({ orders: 2, discountFils: 0, salesFils: 96000 });
  });

  it("keeps separate discounts apart", () => {
    const usage = summariseDiscountUsage([
      { totalFils: 38400, items: [line()] },
      { totalFils: 20000, items: [line({ sale: 8, unitPriceFils: 20000, compareAtUnitPriceFils: 25000 })] },
    ]);
    expect(usage.get(SALE)).toEqual({ orders: 1, discountFils: 9600, salesFils: 38400 });
    expect(usage.get(8)).toEqual({ orders: 1, discountFils: 5000, salesFils: 20000 });
  });
});
