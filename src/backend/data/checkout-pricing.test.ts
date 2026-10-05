import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { Product } from "@/payload-types";
import type { CouponRule, SaleRule } from "@/lib/discounts";

/* data/discounts.ts reads the Payload config at import; a unit test has none. */
vi.mock("@payload-config", () => ({ default: {} }));

const { priceCheckout } = await import("./checkout-pricing");
type Deps = import("./checkout-pricing").CheckoutPricingDeps;

/**
 * The one pricing entry the quote and the payment share.
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
  title: "Internal",
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

const line = { productId: "1", quantity: 1, sizeId: "standard" as const, addonIds: [] as never[] };

function harness(options: { products?: Product[]; sales?: SaleRule[]; coupon?: CouponRule | null; used?: boolean } = {}) {
  const find = vi.fn<
    (args: { collection: string; where: unknown; overrideAccess: boolean }) => Promise<{ docs: Product[] }>
  >(async () => ({ docs: options.products ?? [product()] }));
  const payload = { find, logger: { error: vi.fn(), warn: vi.fn() } } as unknown as Payload;
  const deps = {
    loadSales: vi.fn<Deps["loadSales"]>(async () => options.sales ?? []),
    findCoupon: vi.fn<Deps["findCoupon"]>(async () => options.coupon ?? null),
    emailHasRedeemed: vi.fn<Deps["emailHasRedeemed"]>(async () => options.used ?? false),
  };
  return { payload, find, deps };
}

describe("priceCheckout", () => {
  it("loads only AVAILABLE products, under the caller's own (public) access", async () => {
    const h = harness();
    await priceCheckout(h.payload, { lines: [line], deliveryEmirate: "abu-dhabi" }, NOW, h.deps);
    const args = h.find.mock.calls[0]![0];
    expect(args.collection).toBe("products");
    expect(JSON.stringify(args.where)).toContain('"available":{"equals":true}');
    expect(args.overrideAccess).toBe(false);
  });

  it("prices with the live sales at the moment it is given", async () => {
    const h = harness({ sales: [sale] });
    const result = await priceCheckout(h.payload, { lines: [line], deliveryEmirate: "abu-dhabi" }, NOW, h.deps);
    expect(h.deps.loadSales).toHaveBeenCalledWith(h.payload, NOW);
    expect(result.ok && result.priced.totalFils).toBe(38400);
    expect(result.ok && result.codeGiven).toBe(false);
  });

  it("does not look for a code that was not sent, or that is only whitespace", async () => {
    const h = harness({ coupon: coupon() });
    for (const discountCode of [undefined, "", "   "]) {
      const result = await priceCheckout(h.payload, { lines: [line], deliveryEmirate: "abu-dhabi", discountCode }, NOW, h.deps);
      expect(result.ok && result.priced.totalFils).toBe(48000);
      expect(result.ok && result.codeGiven).toBe(false);
    }
    expect(h.deps.findCoupon).not.toHaveBeenCalled();
  });

  it("applies a code on top of the sale price", async () => {
    const h = harness({ sales: [sale], coupon: coupon() });
    const result = await priceCheckout(
      h.payload,
      { lines: [line], deliveryEmirate: "abu-dhabi", discountCode: " eid10 " },
      NOW,
      h.deps,
    );
    expect(h.deps.findCoupon).toHaveBeenCalledWith(h.payload, "eid10");
    /* 384 − 10% (38.40 → 39) = 345. */
    expect(result.ok && result.priced.totalFils).toBe(34500);
    expect(result.ok && result.codeGiven).toBe(true);
  });

  it("answers an unknown code exactly like a switched-off one", async () => {
    const unknown = harness({ coupon: null });
    const off = harness({ coupon: coupon({ active: false }) });
    const input = { lines: [line], deliveryEmirate: "abu-dhabi", discountCode: "NOPE" };
    const a = await priceCheckout(unknown.payload, input, NOW, unknown.deps);
    const b = await priceCheckout(off.payload, input, NOW, off.deps);
    expect(a.ok && a.priced.couponRefusal).toEqual({ reason: "inactive" });
    expect(b.ok && b.priced.couponRefusal).toEqual({ reason: "inactive" });
    expect(a.ok && a.priced.totalFils).toBe(48000);
    expect(b.ok && b.priced.totalFils).toBe(48000);
  });

  it("asks whether the email has used the code ONLY when an email is given and the code is once-per-customer", async () => {
    const input = { lines: [line], deliveryEmirate: "abu-dhabi", discountCode: "EID10" };

    /* The quote: no email, so no lookup — and no "already used" answer. */
    const quote = harness({ coupon: coupon({ oncePerCustomer: true }), used: true });
    const quoted = await priceCheckout(quote.payload, input, NOW, quote.deps);
    expect(quote.deps.emailHasRedeemed).not.toHaveBeenCalled();
    expect(quoted.ok && quoted.priced.couponRefusal).toBeNull();

    /* The payment: the email is known, and the rule bites. */
    const pay = harness({ coupon: coupon({ oncePerCustomer: true }), used: true });
    const paid = await priceCheckout(pay.payload, { ...input, customerEmail: "layla@example.com" }, NOW, pay.deps);
    expect(pay.deps.emailHasRedeemed).toHaveBeenCalledWith(pay.payload, "9", "layla@example.com");
    expect(paid.ok && paid.priced.couponRefusal).toEqual({ reason: "already_used" });

    /* An ordinary code never triggers the lookup. */
    const ordinary = harness({ coupon: coupon(), used: true });
    await priceCheckout(ordinary.payload, { ...input, customerEmail: "layla@example.com" }, NOW, ordinary.deps);
    expect(ordinary.deps.emailHasRedeemed).not.toHaveBeenCalled();
  });

  it("reports a product that is gone or hidden", async () => {
    const h = harness({ products: [] });
    expect(await priceCheckout(h.payload, { lines: [line], deliveryEmirate: "abu-dhabi" }, NOW, h.deps)).toEqual({
      ok: false,
      failure: "unavailable",
      code: "PRODUCT_UNAVAILABLE",
    });
  });

  it("reports the catalogue or the discounts being unreadable — it never prices as if there were no sales", async () => {
    const h = harness();
    h.deps.loadSales.mockRejectedValueOnce(new Error("connection terminated"));
    expect(await priceCheckout(h.payload, { lines: [line], deliveryEmirate: "abu-dhabi" }, NOW, h.deps)).toMatchObject({
      ok: false,
      failure: "catalogue",
    });
  });

  it("says so when a code takes the total under the minimum charge, with the basket priced without it", async () => {
    const h = harness({
      products: [product({ priceFils: 5000 })],
      coupon: coupon({ valueType: "fixed", percentOff: 0, amountOffFils: 4900 }),
    });
    const result = await priceCheckout(
      h.payload,
      { lines: [line], deliveryEmirate: "abu-dhabi", discountCode: "EID10" },
      NOW,
      h.deps,
    );
    expect(result).toMatchObject({ ok: false, failure: "total_too_low", code: "TOTAL_TOO_LOW" });
    expect(!result.ok && result.withoutCode?.totalFils).toBe(5000);
  });

  it("passes on what the pricing engine refuses", async () => {
    const h = harness();
    expect(
      await priceCheckout(h.payload, { lines: [{ ...line, quantity: 99 }], deliveryEmirate: "abu-dhabi" }, NOW, h.deps),
    ).toEqual({ ok: false, failure: "rejected", code: "INVALID_QUANTITY" });
    expect(
      await priceCheckout(h.payload, { lines: [line], deliveryEmirate: "mars" }, NOW, h.deps),
    ).toEqual({ ok: false, failure: "rejected", code: "INVALID_DELIVERY" });
    expect(await priceCheckout(h.payload, { lines: [], deliveryEmirate: "abu-dhabi" }, NOW, h.deps)).toEqual({
      ok: false,
      failure: "rejected",
      code: "INVALID_ORDER",
    });
  });

  it("survives a malformed line without leaking an error message as a code", async () => {
    const h = harness();
    const broken = { productId: "1", quantity: 1, sizeId: "standard" } as never;
    const result = await priceCheckout(h.payload, { lines: [broken], deliveryEmirate: "abu-dhabi" }, NOW, h.deps);
    expect(result).toEqual({ ok: false, failure: "rejected", code: "INVALID_TOTAL" });
  });
});
