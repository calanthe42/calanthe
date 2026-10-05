import { describe, expect, it } from "vitest";
import type { Product } from "@/payload-types";
import type { CouponRule, SaleRule } from "@/lib/discounts";
import { validateBespokeLines, validateOrderTotals } from "@backend/payload/hooks/orderIntegrity";
import {
  couponRefusalCode,
  discountSnapshotOf,
  isGuessableRefusal,
  orderMoneyFields,
  saleSavingsOfItems,
  toCheckoutQuote,
} from "./checkout-order";
import { priceOrder } from "./pricing";

/**
 * From a priced basket to the order row and to the quote.
 *
 * The important test here is the last link in the chain: whatever the
 * pricing engine produces, the row built from it must pass the order
 * collection's own integrity hooks. If those two ever disagree, checkout
 * fails for every discounted order — so they are tested against each other.
 */

const NOW = new Date("2026-10-05T10:00:00.000Z");

const product = (over: Partial<Product> = {}): Product =>
  ({
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
  }) as Product;

const sale: SaleRule = {
  id: "3",
  title: "Internal — Eid",
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
};

const coupon: CouponRule = {
  id: "9",
  title: "Eid ten",
  code: "EID10",
  active: true,
  valueType: "percentage",
  percentOff: 10,
  amountOffFils: 0,
  minSubtotalFils: 30000,
  usageLimit: 20,
  timesUsed: 3,
  oncePerCustomer: true,
};

const basket = [
  { productId: "1", quantity: 2, sizeId: "deluxe" as const, addonIds: ["vase"] as never[] },
  { productId: "2", quantity: 1, sizeId: "standard" as const, addonIds: [] as never[] },
];
const products = new Map([
  ["1", product()],
  ["2", product({ id: 2, name: "Quiet Morning", slug: "quiet-morning", priceFils: 30000 })],
]);

const price = (over: { sales?: SaleRule[]; coupon?: CouponRule | null } = {}) =>
  priceOrder(basket, products, "abu-dhabi", {
    sales: over.sales ?? [sale],
    coupon: over.coupon === undefined ? coupon : over.coupon,
    emailHasUsedCoupon: false,
    now: NOW,
  });

const asOrder = (fields: ReturnType<typeof orderMoneyFields>) => ({ ...fields, source: "web-checkout-card" });

describe("orderMoneyFields", () => {
  it("builds a row the order integrity hooks accept — sale and code together", () => {
    const data = asOrder(orderMoneyFields(price()));
    expect(() => validateOrderTotals({ data, operation: "create" } as never)).not.toThrow();
    expect(() => validateBespokeLines({ data, operation: "create" } as never)).not.toThrow();
  });

  it("builds a row the hooks accept with a sale only, a code only, and neither", () => {
    for (const priced of [price({ coupon: null }), price({ sales: [] }), price({ sales: [], coupon: null })]) {
      const data = asOrder(orderMoneyFields(priced));
      expect(() => validateOrderTotals({ data, operation: "create" } as never)).not.toThrow();
      expect(() => validateBespokeLines({ data, operation: "create" } as never)).not.toThrow();
    }
  });

  it("stores the price paid with the regular price and both labels beside it", () => {
    const [first, second] = orderMoneyFields(price()).items;
    /* (480 + 140) × 0.8 = 496, + vase 60. */
    expect(first).toMatchObject({
      product: 1,
      unitPriceFils: 55600,
      lineTotalFils: 111200,
      compareAtUnitPriceFils: 68000,
      saleLabelEn: "Eid offer",
      saleLabelAr: "عرض العيد",
      sale: 3,
    });
    expect(second).toMatchObject({ unitPriceFils: 24000, compareAtUnitPriceFils: 30000, sale: 3 });
  });

  it("writes no sale fields on a line that was not on sale", () => {
    const [first] = orderMoneyFields(price({ sales: [] })).items;
    for (const key of ["compareAtUnitPriceFils", "saleLabelEn", "saleLabelAr", "sale"]) {
      expect(first).not.toHaveProperty(key);
    }
  });

  it("records the code, its amount and its link — and discountFils is exactly the code", () => {
    const fields = orderMoneyFields(price());
    /* Subtotal 1,352; 10% → 135.20 → rounded up to 136. */
    expect(fields.subtotalFils).toBe(135200);
    expect(fields).toMatchObject({
      couponCode: "EID10",
      couponDiscount: 9,
      couponDiscountFils: 13600,
      discountFils: 13600,
      totalFils: 121600,
    });
  });

  it("records no code when none applied", () => {
    const fields = orderMoneyFields(price({ coupon: null }));
    expect(fields.discountFils).toBe(0);
    expect(fields.couponDiscountFils).toBe(0);
    expect(fields).not.toHaveProperty("couponCode");
    expect(fields).not.toHaveProperty("couponDiscount");
  });

  it("records no code when the code was refused", () => {
    const refused = price({ coupon: { ...coupon, minSubtotalFils: 10 ** 7 } });
    expect(refused.couponRefusal?.reason).toBe("min_spend");
    const fields = orderMoneyFields(refused);
    expect(fields).not.toHaveProperty("couponCode");
    expect(fields.discountFils).toBe(0);
  });
});

describe("discountSnapshotOf", () => {
  it("freezes the terms of the code and of each sale, once per sale", () => {
    expect(discountSnapshotOf(price())).toEqual({
      coupon: {
        id: "9",
        title: "Eid ten",
        code: "EID10",
        valueType: "percentage",
        percentOff: 10,
        amountOffFils: 0,
        minSubtotalFils: 30000,
      },
      sales: [
        {
          id: "3",
          title: "Internal — Eid",
          labelEn: "Eid offer",
          labelAr: "عرض العيد",
          valueType: "percentage",
          percentOff: 20,
          amountOffFils: 0,
        },
      ],
    });
  });

  it("is null for an order with no sale and no code — that is what marks it as not discounted", () => {
    expect(discountSnapshotOf(price({ sales: [], coupon: null }))).toBeNull();
    expect(orderMoneyFields(price({ sales: [], coupon: null }))).not.toHaveProperty("discountSnapshot");
  });

  it("carries no usage figures: those belong to the live discount, not to the order", () => {
    const text = JSON.stringify(discountSnapshotOf(price()));
    expect(text).not.toMatch(/usageLimit|timesUsed|oncePerCustomer/);
  });
});

describe("toCheckoutQuote", () => {
  it("is amounts and the code, and nothing else", () => {
    expect(toCheckoutQuote(price())).toEqual({
      subtotalFils: 135200,
      saleSavingsFils: (68000 - 55600) * 2 + 6000,
      couponCode: "EID10",
      couponDiscountFils: 13600,
      deliveryFeeFils: 0,
      totalFils: 121600,
    });
  });

  it("shows no code when it was refused", () => {
    const quote = toCheckoutQuote(price({ coupon: { ...coupon, active: false } }));
    expect(quote.couponCode).toBeNull();
    expect(quote.couponDiscountFils).toBe(0);
  });
});

describe("refusal codes", () => {
  it("maps each refusal to the code the storefront reads", () => {
    expect(couponRefusalCode("inactive")).toBe("CODE_INVALID");
    expect(couponRefusalCode("min_spend")).toBe("CODE_MIN_SPEND");
    expect(couponRefusalCode("already_used")).toBe("CODE_ALREADY_USED");
    expect(couponRefusalCode("exhausted")).toBe("CODE_EXHAUSTED");
  });

  it("charges an attempt for a guess, never for a real code that needs one more stem", () => {
    expect(isGuessableRefusal("inactive")).toBe(true);
    expect(isGuessableRefusal("exhausted")).toBe(true);
    expect(isGuessableRefusal("min_spend")).toBe(false);
    expect(isGuessableRefusal("already_used")).toBe(false);
  });
});

describe("saleSavingsOfItems", () => {
  it("sums (regular − paid) × quantity from the stored lines", () => {
    expect(
      saleSavingsOfItems([
        { quantity: 2, unitPriceFils: 55600, compareAtUnitPriceFils: 68000 },
        { quantity: 1, unitPriceFils: 30000 },
        { quantity: 3, unitPriceFils: 10000, compareAtUnitPriceFils: null },
      ]),
    ).toBe(24800);
  });

  it("is zero for an old order, an empty one, or a regular price that is not higher", () => {
    expect(saleSavingsOfItems(null)).toBe(0);
    expect(saleSavingsOfItems([])).toBe(0);
    expect(saleSavingsOfItems([{ quantity: 1, unitPriceFils: 500, compareAtUnitPriceFils: 500 }])).toBe(0);
  });
});
