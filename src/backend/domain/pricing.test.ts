import { describe, expect, it } from "vitest";
import type { Product } from "@/payload-types";
import type { CouponRule, SaleRule } from "@/lib/discounts";
import { deliveryFeeFils, priceLine, priceOrder, type OrderDiscounts } from "./pricing";

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
    const order = priceOrder([line({ quantity: 2 })], products, "abu-dhabi");
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
    expect(() => priceOrder([line({ productId: "999" })], new Map(), "abu-dhabi")).toThrow(
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
    expect(() => priceOrder([], new Map(), "abu-dhabi")).toThrow(/INVALID_ORDER/);
  });

  it("refuses an unsupported emirate", () => {
    expect(() => deliveryFeeFils("mars", 1000)).toThrow(/INVALID_DELIVERY/);
  });

  it("refuses an emirate the atelier does not serve, even when delivery would be free", () => {
    /* Abu Dhabi only. Dubai used to slip through above the free threshold. */
    expect(() => deliveryFeeFils("dubai", 1000)).toThrow(/INVALID_DELIVERY/);
    expect(() => deliveryFeeFils("dubai", 1_000_000)).toThrow(/INVALID_DELIVERY/);
  });
});

describe("delivery fees", () => {
  /* Abu Dhabi delivery is free on every order (client, 2026-10-03). */
  it("delivers free in Abu Dhabi, whatever the basket", () => {
    expect(deliveryFeeFils("abu-dhabi", 100)).toBe(0);
    expect(deliveryFeeFils("abu-dhabi", 10000)).toBe(0);
    expect(deliveryFeeFils("abu-dhabi", 34999)).toBe(0);
    expect(deliveryFeeFils("abu-dhabi", 35000)).toBe(0);
  });
});

describe("totals reconcile exactly", () => {
  it("total equals subtotal plus delivery", () => {
    const products = new Map([["1", product({ priceFils: 10000 })]]);
    const order = priceOrder([line()], products, "abu-dhabi");
    expect(order.subtotalFils).toBe(10000);
    expect(order.deliveryFeeFils).toBe(0);
    expect(order.totalFils).toBe(order.subtotalFils + order.deliveryFeeFils - order.discountFils);
  });

  it("every amount is a whole number of fils", () => {
    const products = new Map([["1", product({ priceFils: 39050 })]]);
    const order = priceOrder([line({ quantity: 3 })], products, "abu-dhabi");
    for (const value of [order.subtotalFils, order.deliveryFeeFils, order.totalFils]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Discounts                                                           */
/* ------------------------------------------------------------------ */

const NOW = new Date("2026-10-05T10:00:00.000Z");

const sale = (over: Partial<SaleRule> = {}): SaleRule => ({
  id: "3",
  title: "Internal name",
  labelEn: "Eid offer",
  labelAr: "عرض العيد",
  appliesTo: "all",
  productIds: [],
  occasionIds: [],
  categories: [],
  active: true,
  valueType: "percentage",
  percentOff: 20,
  amountOffFils: 0,
  ...over,
});

const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  id: "9",
  title: "EID10",
  code: "EID10",
  active: true,
  valueType: "percentage",
  percentOff: 10,
  amountOffFils: 0,
  minSubtotalFils: 0,
  usageLimit: null,
  timesUsed: 0,
  oncePerCustomer: false,
  ...over,
});

const discounts = (over: Partial<OrderDiscounts> = {}): OrderDiscounts => ({
  sales: [],
  coupon: null,
  emailHasUsedCoupon: false,
  now: NOW,
  ...over,
});

const catalogue = (...items: Product[]) => new Map(items.map((p) => [String(p.id), p]));

describe("no discounts: the regression lock", () => {
  it("prices exactly as before when the 4th argument is absent", () => {
    const products = catalogue(product({ priceFils: 48000 }));
    const order = priceOrder([line({ quantity: 2, sizeId: "deluxe", addonIds: ["vase"] })], products, "abu-dhabi");
    expect(order).toMatchObject({
      subtotalFils: 136000,
      deliveryFeeFils: 0,
      discountFils: 0,
      totalFils: 136000,
      saleSavingsFils: 0,
      couponDiscountFils: 0,
      coupon: null,
      couponRefusal: null,
    });
    expect(order.lines[0]).toMatchObject({
      unitPriceFils: 68000,
      lineTotalFils: 136000,
      compareAtUnitPriceFils: null,
      sale: null,
    });
  });

  it("prices identically with an empty set of discounts", () => {
    const products = catalogue(product({ priceFils: 48000 }));
    const lines = [line({ quantity: 2, sizeId: "deluxe", addonIds: ["vase"] })];
    expect(priceOrder(lines, products, "abu-dhabi", discounts())).toEqual(priceOrder(lines, products, "abu-dhabi"));
  });
});

describe("an automatic sale", () => {
  it("reduces the arrangement and its size uplift, never an add-on", () => {
    /* 480 + 140 (deluxe) = 620 → 20% → 496; + vase 60 = 556. Regular: 680. */
    const priced = priceLine(
      line({ sizeId: "deluxe", addonIds: ["vase"] }),
      product({ priceFils: 48000 }),
      sale(),
    );
    expect(priced.unitPriceFils).toBe(55600);
    expect(priced.compareAtUnitPriceFils).toBe(68000);
    expect(priced.sale).toEqual({
      id: "3",
      title: "Internal name",
      labelEn: "Eid offer",
      labelAr: "عرض العيد",
      valueType: "percentage",
      percentOff: 20,
      amountOffFils: 0,
    });
  });

  it("keeps line total = unit × quantity in every sale case", () => {
    const cases = [
      { rule: sale(), size: "standard", addons: [], qty: 1 },
      { rule: sale({ percentOff: 33 }), size: "deluxe", addons: ["vase"], qty: 3 },
      { rule: sale({ valueType: "fixed", percentOff: 0, amountOffFils: 5050 }), size: "premium", addons: [], qty: 7 },
      { rule: sale({ percentOff: 90 }), size: "standard", addons: ["vase"], qty: 20 },
    ] as const;
    for (const c of cases) {
      const priced = priceLine(
        line({ sizeId: c.size, addonIds: [...c.addons], quantity: c.qty }),
        product({ priceFils: 39050 }),
        c.rule,
      );
      expect(priced.lineTotalFils).toBe(priced.unitPriceFils * c.qty);
      expect(Number.isInteger(priced.unitPriceFils)).toBe(true);
      expect(priced.compareAtUnitPriceFils).toBeGreaterThan(priced.unitPriceFils);
    }
  });

  it("is chosen on the base price and reused for every size", () => {
    /* On the base price (480) the fixed AED 100 wins: 380 against 384. On
       the premium size (800) the percentage would be cheaper — 640 against
       700 — but the sale was already chosen, and one product has one sale. */
    const twenty = sale({ id: "1" });
    const hundred = sale({ id: "2", valueType: "fixed", percentOff: 0, amountOffFils: 10000 });
    const products = catalogue(product({ priceFils: 48000 }));
    const order = priceOrder(
      [line({ sizeId: "standard" }), line({ sizeId: "premium" })],
      products,
      "abu-dhabi",
      discounts({ sales: [twenty, hundred] }),
    );
    expect(order.lines.map((l) => l.sale?.id)).toEqual(["2", "2"]);
    expect(order.lines.map((l) => l.unitPriceFils)).toEqual([38000, 70000]);
  });

  it("sums the savings: (regular − paid) × quantity over the lines", () => {
    const products = catalogue(product({ id: 1, priceFils: 48000 }), product({ id: 2, priceFils: 30000, category: "plant" }));
    const order = priceOrder(
      [line({ quantity: 2 }), line({ productId: "2", quantity: 3 })],
      products,
      "abu-dhabi",
      discounts({ sales: [sale({ appliesTo: "categories", categories: ["bouquet"] })] }),
    );
    /* Only the bouquet is on sale: (480 − 384) × 2. */
    expect(order.saleSavingsFils).toBe(19200);
    expect(order.lines[1]!.sale).toBeNull();
    expect(order.subtotalFils).toBe(38400 * 2 + 30000 * 3);
    /* A sale is not an order-level discount. */
    expect(order.discountFils).toBe(0);
  });

  it("matches by occasion whether the relationship arrived as ids or documents", () => {
    const rule = sale({ appliesTo: "occasions", occasionIds: ["5"] });
    const asIds = product({ occasions: [5, 6] as never });
    const asDocs = product({ occasions: [{ id: 5, slug: "birthday" }] as never });
    const none = product({ occasions: [6] as never });
    for (const [p, expected] of [[asIds, 38400], [asDocs, 38400], [none, 48000]] as const) {
      const order = priceOrder([line()], catalogue(p), "abu-dhabi", discounts({ sales: [rule] }));
      expect(order.subtotalFils).toBe(expected);
    }
  });

  it("is ignored when it is not live", () => {
    const products = catalogue(product({ priceFils: 48000 }));
    const dead = [
      sale({ active: false }),
      sale({ startsAt: "2026-11-01T00:00:00.000Z" }),
      sale({ endsAt: "2026-10-05T10:00:00.000Z" }),
    ];
    const order = priceOrder([line()], products, "abu-dhabi", discounts({ sales: dead }));
    expect(order.subtotalFils).toBe(48000);
    expect(order.lines[0]!.compareAtUnitPriceFils).toBeNull();
  });

  it("caps a fixed sale at 90% if the product was repriced after the sale was saved", () => {
    const order = priceOrder(
      [line()],
      catalogue(product({ priceFils: 10000 })),
      "abu-dhabi",
      discounts({ sales: [sale({ valueType: "fixed", percentOff: 0, amountOffFils: 50000 })] }),
    );
    expect(order.subtotalFils).toBe(1000);
  });
});

describe("a discount code", () => {
  it("applies to the already-reduced subtotal, add-ons included", () => {
    /* 480 → 384 on sale, + vase 60 = 444. 10% of 444 = 44.40 → 45. */
    const order = priceOrder(
      [line({ addonIds: ["vase"] })],
      catalogue(product({ priceFils: 48000 })),
      "abu-dhabi",
      discounts({ sales: [sale()], coupon: coupon() }),
    );
    expect(order.subtotalFils).toBe(44400);
    expect(order.couponDiscountFils).toBe(4500);
    expect(order.discountFils).toBe(order.couponDiscountFils);
    expect(order.totalFils).toBe(39900);
    expect(order.coupon?.code).toBe("EID10");
    expect(order.couponRefusal).toBeNull();
  });

  it("total = subtotal − code + delivery, and discountFils is always the code", () => {
    const order = priceOrder(
      [line({ quantity: 2 })],
      catalogue(product({ priceFils: 39050 })),
      "abu-dhabi",
      discounts({ coupon: coupon({ valueType: "fixed", percentOff: 0, amountOffFils: 2550 }) }),
    );
    expect(order.totalFils).toBe(order.subtotalFils - order.couponDiscountFils + order.deliveryFeeFils);
    expect(order.discountFils).toBe(2550);
    expect(order.totalFils).toBe(75550);
  });

  it("measures the minimum spend AFTER sale prices", () => {
    /* AED 500 on a 20% sale is 400, which fails a 450 minimum. */
    const order = priceOrder(
      [line()],
      catalogue(product({ priceFils: 50000 })),
      "abu-dhabi",
      discounts({ sales: [sale()], coupon: coupon({ minSubtotalFils: 45000 }) }),
    );
    expect(order.couponRefusal).toEqual({ reason: "min_spend", shortfallFils: 5000 });
    expect(order.couponDiscountFils).toBe(0);
    expect(order.totalFils).toBe(40000);
  });

  it("when refused, prices WITHOUT it and reports why — it never throws", () => {
    const products = catalogue(product({ priceFils: 48000 }));
    const refusals = [
      [coupon({ active: false }), false, "inactive"],
      [coupon({ endsAt: "2026-10-01T00:00:00.000Z" }), false, "inactive"],
      [coupon({ usageLimit: 5, timesUsed: 5 }), false, "exhausted"],
      [coupon({ oncePerCustomer: true }), true, "already_used"],
    ] as const;
    for (const [rule, used, reason] of refusals) {
      const order = priceOrder(
        [line()],
        products,
        "abu-dhabi",
        discounts({ coupon: rule, emailHasUsedCoupon: used }),
      );
      expect(order.couponRefusal?.reason).toBe(reason);
      expect(order.coupon).toBeNull();
      expect(order.discountFils).toBe(0);
      expect(order.totalFils).toBe(48000);
    }
  });

  it("can never make the total negative", () => {
    const order = priceOrder(
      [line()],
      catalogue(product({ priceFils: 48000 })),
      "abu-dhabi",
      discounts({ coupon: coupon({ percentOff: 90 }) }),
    );
    expect(order.totalFils).toBe(4800);
    expect(order.totalFils).toBeGreaterThanOrEqual(0);
  });

  it("refuses a total under the minimum charge: there is no free-order path", () => {
    /* AED 50 basket, AED 49 off → AED 1, which a card cannot be charged. */
    const products = catalogue(product({ priceFils: 5000 }));
    const big = coupon({ valueType: "fixed", percentOff: 0, amountOffFils: 4900 });
    expect(() => priceOrder([line()], products, "abu-dhabi", discounts({ coupon: big }))).toThrow(/TOTAL_TOO_LOW/);
    /* A fixed code as large as the basket would make it free: also refused. */
    const whole = coupon({ valueType: "fixed", percentOff: 0, amountOffFils: 5000 });
    expect(() => priceOrder([line()], products, "abu-dhabi", discounts({ coupon: whole }))).toThrow(/TOTAL_TOO_LOW/);
    /* Exactly the minimum is payable. */
    const edge = coupon({ valueType: "fixed", percentOff: 0, amountOffFils: 4800 });
    expect(priceOrder([line()], products, "abu-dhabi", discounts({ coupon: edge })).totalFils).toBe(200);
  });
});

describe("refusals still hold with discounts present", () => {
  const d = discounts({ sales: [sale()], coupon: coupon() });

  it("an unavailable product, a bad quantity, an unknown size or add-on", () => {
    expect(() => priceLine(line(), product({ available: false }), sale())).toThrow(/PRODUCT_UNAVAILABLE/);
    expect(() => priceLine(line({ quantity: 21 }), product(), sale())).toThrow(/INVALID_QUANTITY/);
    expect(() => priceLine(line({ sizeId: "enormous" }), product(), sale())).toThrow(/INVALID_OPTION/);
    expect(() => priceLine(line({ addonIds: ["diamond"] }), product(), sale())).toThrow(/INVALID_OPTION/);
    expect(() => priceOrder([line({ productId: "999" })], new Map(), "abu-dhabi", d)).toThrow(/INVALID_PRODUCT/);
    expect(() => priceOrder([], new Map(), "abu-dhabi", d)).toThrow(/INVALID_ORDER/);
    expect(() => priceOrder([line()], catalogue(product()), "dubai", d)).toThrow(/INVALID_DELIVERY/);
  });

  it("ignores a sale or a price smuggled into the request", () => {
    const tampered = { ...line(), sale: sale({ percentOff: 90 }), unitPriceFils: 1, compareAtUnitPriceFils: 2 };
    const order = priceOrder([tampered], catalogue(product({ priceFils: 48000 })), "abu-dhabi", discounts());
    expect(order.totalFils).toBe(48000);
    expect(order.lines[0]!.sale).toBeNull();
  });
});
