import { describe, expect, it } from "vitest";
import type { Product } from "@/payload-types";
import { deliveryFeeFils, priceLine, priceOrder } from "./pricing";

/**
 * These tests exist to prove one thing: the browser cannot change what a
 * customer is charged.
 *
 * Every case sends a request that lies — about the price, the total, the
 * availability of a product — and asserts the server ignores it or refuses.
 */

function product(over: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: "Amber Hour",
    slug: "amber-hour",
    priceFils: 48000,
    currency: "AED",
    category: "bouquet",
    available: true,
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z",
    ...over,
  } as Product;
}

const line = (over = {}) => ({
  productId: "1",
  quantity: 1,
  sizeId: "standard" as const,
  addonIds: [] as never[],
  ...over,
});

describe("prices come from the database, never the request", () => {
  it("uses the stored price, whatever the client claims", () => {
    const priced = priceLine(line(), product({ priceFils: 48000 }));
    expect(priced.unitPriceFils).toBe(48000);
  });

  it("ignores any price-shaped field smuggled into the line", () => {
    const tampered = { ...line(), unitPriceFils: 1, lineTotalFils: 1, priceAed: 0.01 };
    const priced = priceLine(tampered, product({ priceFils: 48000 }));
    expect(priced.unitPriceFils).toBe(48000);
    expect(priced.lineTotalFils).toBe(48000);
  });

  it("computes the total from the catalogue, not from a claimed subtotal", () => {
    const products = new Map([["1", product({ priceFils: 95000 })]]);
    const order = priceOrder([line({ quantity: 2 })], products, "dubai");
    /* 950 x 2 = 1900 AED, over the free-delivery threshold. */
    expect(order.subtotalFils).toBe(190000);
    expect(order.deliveryFeeFils).toBe(0);
    expect(order.totalFils).toBe(190000);
  });

  it("adds size and add-on prices from configuration", () => {
    const priced = priceLine(
      line({ sizeId: "deluxe", addonIds: ["vase"] }),
      product({ priceFils: 48000 }),
    );
    /* 480 + 140 (deluxe) + 60 (vase) = 680 AED */
    expect(priced.unitPriceFils).toBe(68000);
  });
});

describe("refusals", () => {
  it("refuses an unavailable product", () => {
    expect(() => priceLine(line(), product({ available: false }))).toThrow(/PRODUCT_UNAVAILABLE/);
  });

  it("refuses an unknown product id", () => {
    expect(() => priceOrder([line({ productId: "999" })], new Map(), "dubai")).toThrow(
      /INVALID_PRODUCT/,
    );
  });

  it("refuses an unknown size", () => {
    expect(() => priceLine(line({ sizeId: "enormous" }), product())).toThrow(/INVALID_OPTION/);
  });

  it("refuses an unknown add-on", () => {
    expect(() => priceLine(line({ addonIds: ["diamond"] }), product())).toThrow(/INVALID_OPTION/);
  });

  it("refuses a quantity outside 1-20", () => {
    expect(() => priceLine(line({ quantity: 0 }), product())).toThrow(/INVALID_QUANTITY/);
    expect(() => priceLine(line({ quantity: 21 }), product())).toThrow(/INVALID_QUANTITY/);
    expect(() => priceLine(line({ quantity: 1.5 }), product())).toThrow(/INVALID_QUANTITY/);
  });

  it("refuses an empty basket", () => {
    expect(() => priceOrder([], new Map(), "dubai")).toThrow(/INVALID_ORDER/);
  });

  it("refuses an unsupported emirate", () => {
    expect(() => deliveryFeeFils("mars", 1000)).toThrow(/INVALID_DELIVERY/);
  });
});

describe("delivery fees", () => {
  it("charges the emirate's fee below the threshold", () => {
    /* Abu Dhabi is 35 AED; 100 AED subtotal is under the 350 threshold. */
    expect(deliveryFeeFils("abu-dhabi", 10000)).toBe(3500);
  });

  it("waives delivery at exactly the threshold", () => {
    expect(deliveryFeeFils("abu-dhabi", 35000)).toBe(0);
  });

  it("still charges one fils under the threshold", () => {
    expect(deliveryFeeFils("abu-dhabi", 34999)).toBe(3500);
  });
});

describe("totals reconcile exactly", () => {
  it("total equals subtotal plus delivery", () => {
    const products = new Map([["1", product({ priceFils: 10000 })]]);
    const order = priceOrder([line()], products, "dubai");
    expect(order.subtotalFils).toBe(10000);
    expect(order.deliveryFeeFils).toBe(2500);
    expect(order.totalFils).toBe(order.subtotalFils + order.deliveryFeeFils - order.discountFils);
  });

  it("every amount is a whole number of fils", () => {
    const products = new Map([["1", product({ priceFils: 39050 })]]);
    const order = priceOrder([line({ quantity: 3 })], products, "sharjah");
    for (const value of [order.subtotalFils, order.deliveryFeeFils, order.totalFils]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
