import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/payload-types";
import type { CouponRule, SaleRule } from "@/lib/discounts";
import { priceOrder, type OrderDiscounts } from "@backend/domain/pricing";
import { validateBespokeLines, validateOrderTotals } from "@backend/payload/hooks/orderIntegrity";

/**
 * The checkout actions, with everything real except the outside world: the
 * database, Stripe and the request. Pricing is the REAL engine, fed through
 * a mocked loader, so an assertion about a total is an assertion about the
 * arithmetic the customer is actually charged with.
 */

type Doc = Record<string, unknown>;

/* ---- the request ---- */
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": currentAddress }),
}));
const deferred: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({
  after: (task: () => Promise<void>) => {
    deferred.push(task);
  },
}));
vi.mock("@/lib/redis", () => ({ rateLimit: () => null }));
vi.mock("@/lib/i18n/server", async () => {
  const { en } = await import("@/lib/i18n/dictionary");
  return { getDictionary: async () => ({ locale: "en", t: en }) };
});

/* ---- the database ---- */
vi.mock("@payload-config", () => ({ default: {} }));
const created: Doc[] = [];
const fakePayload = {
  auth: vi.fn(async () => ({ user: null })),
  create: vi.fn(async ({ data }: { data: Doc }) => {
    /* The collection's own hooks run on every create; run them here too. */
    validateOrderTotals({ data, operation: "create" } as never);
    validateBespokeLines({ data, operation: "create" } as never);
    const order = { id: 41, orderNumber: "CAL-000041", ...data };
    created.push(order);
    return order;
  }),
  findByID: vi.fn(async () => ({ id: 41, fulfilmentStatus: "NEW" })),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
};
vi.mock("payload", () => ({ getPayload: async () => fakePayload }));

/* ---- Stripe ---- */
const stripe = { paymentIntents: { cancel: vi.fn(async () => ({})) } };
vi.mock("@backend/payments/stripe", () => ({
  getStripe: () => stripe,
  cardPaymentsConfigured: () => true,
}));
const ensureOrderPaymentIntent = vi.fn();
vi.mock("@backend/payments/intent", () => ({
  ensureOrderPaymentIntent: (...args: unknown[]) => ensureOrderPaymentIntent(...args),
}));

/* ---- claims on a limited code ---- */
const claims = {
  releaseCouponClaims: vi.fn(async () => undefined),
  couponClaimRefusal: vi.fn(async (): Promise<string | null> => null),
  abandonOrder: vi.fn(async () => undefined),
  sweepStaleDiscountOrders: vi.fn(async () => ({ released: 0, inFlight: 0 })),
};
vi.mock("@backend/payments/coupon-claims", () => ({
  LOST_CLAIM_NOTE: "lost",
  isLimited: (c: { usageLimit: number | null; oncePerCustomer: boolean }) =>
    c.usageLimit !== null || c.oncePerCustomer,
  releaseCouponClaims: (...args: unknown[]) => claims.releaseCouponClaims(...(args as [])),
  couponClaimRefusal: (...args: unknown[]) => claims.couponClaimRefusal(...(args as [])),
  abandonOrder: (...args: unknown[]) => claims.abandonOrder(...(args as [])),
  sweepStaleDiscountOrders: (...args: unknown[]) => claims.sweepStaleDiscountOrders(...(args as [])),
}));

/* ---- pricing: the real engine, with the rows supplied here ---- */
const world: {
  products: Product[];
  sales: SaleRule[];
  coupons: CouponRule[];
  usedBy: string[];
} = { products: [], sales: [], coupons: [], usedBy: [] };
const pricingCalls: Doc[] = [];

vi.mock("@backend/data/checkout-pricing", () => ({
  priceCheckout: async (
    _payload: unknown,
    input: { lines: never[]; deliveryEmirate: string; discountCode?: string; customerEmail?: string },
    now: Date,
  ) => {
    pricingCalls.push(input as Doc);
    const code = (input.discountCode ?? "").trim().toUpperCase();
    const coupon = code ? (world.coupons.find((c) => c.code === code) ?? null) : null;
    const discounts: OrderDiscounts = {
      sales: world.sales,
      coupon,
      emailHasUsedCoupon: Boolean(
        coupon?.oncePerCustomer && input.customerEmail && world.usedBy.includes(input.customerEmail),
      ),
      now,
    };
    const products = new Map(world.products.map((p) => [String(p.id), p]));
    try {
      const priced = priceOrder(input.lines, products, input.deliveryEmirate, discounts);
      if (code && !coupon) priced.couponRefusal = { reason: "inactive" };
      return { ok: true, priced, products, codeGiven: code !== "" };
    } catch (error) {
      const engine = (error as Error).message.split(":")[0];
      if (engine === "TOTAL_TOO_LOW") {
        return {
          ok: false,
          failure: "total_too_low",
          code: engine,
          withoutCode: priceOrder(input.lines, products, input.deliveryEmirate, { ...discounts, coupon: null }),
        };
      }
      return { ok: false, failure: "rejected", code: engine };
    }
  },
}));

const { quoteCheckout, startCardCheckout } = await import("./checkout");
const { LIMITS, peek, resetThrottleMemory } = await import("@backend/security/throttle");
type CheckoutRequest = import("./checkout").CheckoutRequest;

let currentAddress = "203.0.113.7";

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

const SALE: SaleRule = {
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

const request = (over: Partial<CheckoutRequest> = {}): CheckoutRequest => ({
  lines: [line],
  customerName: "Layla Ahmed",
  customerEmail: "Layla@Example.com",
  customerPhone: "+971501234567",
  deliveryEmirate: "abu-dhabi",
  deliveryAddress: "Villa 4, Al Reem Island",
  deliveryDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
  deliveryTimeSlot: "13:00 – 17:00",
  shownTotalFils: 48000,
  ...over,
});

beforeEach(() => {
  resetThrottleMemory();
  currentAddress = "203.0.113.7";
  created.length = 0;
  deferred.length = 0;
  pricingCalls.length = 0;
  world.products = [product()];
  world.sales = [];
  world.coupons = [];
  world.usedBy = [];
  vi.clearAllMocks();
  claims.couponClaimRefusal.mockResolvedValue(null);
  fakePayload.findByID.mockResolvedValue({ id: 41, fulfilmentStatus: "NEW" });
  ensureOrderPaymentIntent.mockImplementation(async () => ({
    kind: "ready",
    clientSecret: "pi_1_secret",
    intentId: "pi_1",
  }));
});

describe("startCardCheckout — the browser never sets the price", () => {
  it("creates the order and a PaymentIntent from the ORDER, for the server total", async () => {
    const result = await startCardCheckout(request());
    expect(result).toEqual({ ok: true, orderNumber: "CAL-000041", clientSecret: "pi_1_secret" });
    expect(created[0]).toMatchObject({
      totalFils: 48000,
      subtotalFils: 48000,
      discountFils: 0,
      paymentStatus: "PENDING",
      customerEmail: "layla@example.com",
      source: "web-checkout-card",
      locale: "en",
    });
    /* The intent is built from the stored order, not from anything sent. */
    expect(ensureOrderPaymentIntent.mock.calls[0]![2]).toBe(created[0]);
  });

  it("refuses a shown total LOWER than the server total, and creates nothing", async () => {
    const result = await startCardCheckout(request({ shownTotalFils: 100 }));
    expect(result).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    expect(fakePayload.create).not.toHaveBeenCalled();
    expect(ensureOrderPaymentIntent).not.toHaveBeenCalled();
  });

  it("refuses a shown total HIGHER than the server total, and creates nothing", async () => {
    const result = await startCardCheckout(request({ shownTotalFils: 99900 }));
    expect(result).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });

  it("refuses a shown total that is missing or not a whole number of fils", async () => {
    for (const shownTotalFils of [undefined, Number.NaN, 48000.5, "48000"]) {
      const result = await startCardCheckout(request({ shownTotalFils: shownTotalFils as never }));
      expect(result).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    }
    expect(fakePayload.create).not.toHaveBeenCalled();
  });

  it("never stores the shown total, and never sends it to pricing", async () => {
    await startCardCheckout(request());
    expect(JSON.stringify(created[0])).not.toContain("shownTotalFils");
    expect(JSON.stringify(pricingCalls)).not.toContain("shownTotalFils");
  });

  it("tells the customer when a sale ended while the page was open: the old total no longer matches", async () => {
    world.sales = [SALE];
    /* She was shown the sale price… */
    expect(await startCardCheckout(request({ shownTotalFils: 38400 }))).toMatchObject({ ok: true });
    /* …then the sale ends, and the same request is refused rather than
       charged at a price she did not see. */
    world.sales = [];
    created.length = 0;
    fakePayload.create.mockClear();
    const result = await startCardCheckout(request({ shownTotalFils: 38400 }));
    expect(result).toMatchObject({
      ok: false,
      code: "PRICE_CHANGED",
      message: "Prices have just been updated. Please review the new total, then pay.",
    });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });
});

describe("startCardCheckout — sales and codes", () => {
  it("stores the sale snapshot and charges the sale price", async () => {
    world.sales = [SALE];
    expect(await startCardCheckout(request({ shownTotalFils: 38400 }))).toMatchObject({ ok: true });
    const order = created[0]!;
    expect(order.totalFils).toBe(38400);
    expect((order.items as Doc[])[0]).toMatchObject({
      unitPriceFils: 38400,
      compareAtUnitPriceFils: 48000,
      saleLabelEn: "Eid offer",
      saleLabelAr: "عرض العيد",
      sale: 3,
    });
    expect(order.discountSnapshot).toMatchObject({ coupon: null, sales: [{ id: "3", percentOff: 20 }] });
    expect(order).not.toHaveProperty("couponCode");
  });

  it("validates the code on the server and charges the discounted total", async () => {
    world.sales = [SALE];
    world.coupons = [coupon()];
    /* 384 − 10% (38.40 → 39) = 345. */
    const result = await startCardCheckout(request({ discountCode: " eid10 ", shownTotalFils: 34500 }));
    expect(result).toMatchObject({ ok: true });
    expect(created[0]).toMatchObject({
      subtotalFils: 38400,
      discountFils: 3900,
      couponDiscountFils: 3900,
      couponCode: "EID10",
      couponDiscount: 9,
      totalFils: 34500,
    });
    /* An unlimited code needs no claim. */
    expect(claims.couponClaimRefusal).not.toHaveBeenCalled();
  });

  it("NEVER silently drops a code the customer was shown: it refuses and says why", async () => {
    world.coupons = [coupon({ active: false })];
    const result = await startCardCheckout(request({ discountCode: "EID10", shownTotalFils: 43200 }));
    expect(result).toEqual({
      ok: false,
      code: "CODE_INVALID",
      message: "That code is not valid or is no longer active. Check the spelling and try again.",
    });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });

  it("gives ONE answer for an unknown, a draft, a scheduled and an expired code", async () => {
    const answers = new Set<string>();
    const variants: CouponRule[][] = [
      [],
      [coupon({ active: false })],
      [coupon({ startsAt: "2099-01-01T00:00:00.000Z" })],
      [coupon({ endsAt: "2020-01-01T00:00:00.000Z" })],
    ];
    for (const coupons of variants) {
      world.coupons = coupons;
      resetThrottleMemory();
      const result = await startCardCheckout(request({ discountCode: "EID10" }));
      answers.add(JSON.stringify(result));
    }
    expect(answers.size).toBe(1);
  });

  it("explains a minimum spend with the exact shortfall", async () => {
    world.coupons = [coupon({ minSubtotalFils: 60000 })];
    const result = await startCardCheckout(request({ discountCode: "EID10" }));
    expect(result).toEqual({
      ok: false,
      code: "CODE_MIN_SPEND",
      message: "Add AED 120 more to use this code. It needs a minimum order of AED 600.",
    });
  });

  it("refuses a once-per-customer code this email has already used — here, where an order is being placed", async () => {
    world.coupons = [coupon({ oncePerCustomer: true })];
    world.usedBy = ["layla@example.com"];
    const result = await startCardCheckout(request({ discountCode: "EID10", shownTotalFils: 43200 }));
    expect(result).toMatchObject({ ok: false, code: "CODE_ALREADY_USED" });
    expect(pricingCalls[0]).toMatchObject({ customerEmail: "layla@example.com" });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });

  it("refuses a total under the minimum charge", async () => {
    world.products = [product({ priceFils: 5000 })];
    world.coupons = [coupon({ valueType: "fixed", percentOff: 0, amountOffFils: 4900 })];
    const result = await startCardCheckout(request({ discountCode: "EID10", shownTotalFils: 100 }));
    expect(result).toMatchObject({ ok: false, code: "TOTAL_TOO_LOW" });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });
});

describe("startCardCheckout — a limited code is reserved, not merely checked", () => {
  const limited = () => coupon({ usageLimit: 20 });
  const pay = () => startCardCheckout(request({ discountCode: "EID10", shownTotalFils: 43200 }));

  it("releases stale claims, then looks before the order exists and again after", async () => {
    world.coupons = [limited()];
    expect(await pay()).toMatchObject({ ok: true });

    expect(claims.releaseCouponClaims).toHaveBeenCalledTimes(1);
    expect(claims.couponClaimRefusal).toHaveBeenCalledTimes(2);
    /* First look: nobody excluded. Second: this order asks about the others. */
    expect((claims.couponClaimRefusal.mock.calls[0] as unknown[])[3]).toBeUndefined();
    expect((claims.couponClaimRefusal.mock.calls[1] as unknown[])[3]).toBe(41);
    /* Order of events: first look → create → second look → intent. */
    const first = claims.couponClaimRefusal.mock.invocationCallOrder[0]!;
    const second = claims.couponClaimRefusal.mock.invocationCallOrder[1]!;
    const create = fakePayload.create.mock.invocationCallOrder[0]!;
    const intent = ensureOrderPaymentIntent.mock.invocationCallOrder[0]!;
    expect(first).toBeLessThan(create);
    expect(create).toBeLessThan(second);
    expect(second).toBeLessThan(intent);
  });

  it("refuses before creating anything when the code is already fully claimed", async () => {
    world.coupons = [limited()];
    claims.couponClaimRefusal.mockResolvedValueOnce("exhausted");
    expect(await pay()).toMatchObject({ ok: false, code: "CODE_EXHAUSTED" });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });

  it("cancels its own order and creates NO PaymentIntent when it loses the race for the last use", async () => {
    world.coupons = [limited()];
    claims.couponClaimRefusal.mockResolvedValueOnce(null).mockResolvedValueOnce("exhausted");
    expect(await pay()).toMatchObject({ ok: false, code: "CODE_EXHAUSTED" });
    expect(fakePayload.create).toHaveBeenCalledTimes(1);
    expect(claims.abandonOrder).toHaveBeenCalledWith(fakePayload, 41, "lost");
    expect(ensureOrderPaymentIntent).not.toHaveBeenCalled();
  });

  it("does the same for once-per-customer", async () => {
    world.coupons = [coupon({ oncePerCustomer: true })];
    claims.couponClaimRefusal.mockResolvedValueOnce(null).mockResolvedValueOnce("already_used");
    expect(await pay()).toMatchObject({ ok: false, code: "CODE_ALREADY_USED" });
    expect(claims.abandonOrder).toHaveBeenCalledTimes(1);
    expect(ensureOrderPaymentIntent).not.toHaveBeenCalled();
  });

  it("cancels the intent it just made if the order was released in the meantime", async () => {
    world.coupons = [limited()];
    fakePayload.findByID.mockResolvedValueOnce({ id: 41, fulfilmentStatus: "CANCELLED" });
    expect(await pay()).toMatchObject({ ok: false, code: "ORDER_CREATION_FAILED" });
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith("pi_1");
  });

  it("refuses the order when the claims cannot be counted, rather than guessing", async () => {
    world.coupons = [limited()];
    claims.couponClaimRefusal.mockRejectedValueOnce(new Error("connection terminated"));
    expect(await pay()).toMatchObject({ ok: false, code: "ORDER_CREATION_FAILED" });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });

  it("sweeps stale discounted orders after the response, not before it", async () => {
    expect(await startCardCheckout(request())).toMatchObject({ ok: true });
    expect(claims.sweepStaleDiscountOrders).not.toHaveBeenCalled();
    expect(deferred).toHaveLength(1);
    await deferred[0]!();
    expect(claims.sweepStaleDiscountOrders).toHaveBeenCalledTimes(1);
  });
});

describe("quoteCheckout", () => {
  const quote = (discountCode?: string) =>
    quoteCheckout({ lines: [line], deliveryEmirate: "abu-dhabi", ...(discountCode ? { discountCode } : {}) });

  it("prices the basket with live sales, and creates nothing", async () => {
    world.sales = [SALE];
    expect(await quote()).toEqual({
      ok: true,
      quote: {
        subtotalFils: 38400,
        saleSavingsFils: 9600,
        couponCode: null,
        couponDiscountFils: 0,
        deliveryFeeFils: 0,
        totalFils: 38400,
      },
    });
    expect(fakePayload.create).not.toHaveBeenCalled();
  });

  it("agrees with the payment to the fils: the quoted total is the total that is charged", async () => {
    world.sales = [SALE];
    world.coupons = [coupon()];
    const quoted = await quote("EID10");
    expect(quoted.ok).toBe(true);
    const total = quoted.ok ? quoted.quote.totalFils : -1;
    expect(await startCardCheckout(request({ discountCode: "EID10", shownTotalFils: total }))).toMatchObject({ ok: true });
    expect(created[0]!.totalFils).toBe(total);
  });

  it("takes NO email, so it can never say whether an address has used a code", async () => {
    world.coupons = [coupon({ oncePerCustomer: true })];
    world.usedBy = ["layla@example.com"];
    const sneaky = { lines: [line], deliveryEmirate: "abu-dhabi", discountCode: "EID10", customerEmail: "layla@example.com" };
    const result = await quoteCheckout(sneaky as never);
    /* The same answer a stranger with an unused address would get. */
    expect(result).toMatchObject({ ok: true, quote: { couponCode: "EID10" } });
    expect(pricingCalls.every((call) => !("customerEmail" in call))).toBe(true);
  });

  it("returns the refusal AND the basket priced without the code", async () => {
    world.coupons = [coupon({ minSubtotalFils: 60000 })];
    expect(await quote("EID10")).toEqual({
      ok: false,
      code: "CODE_MIN_SPEND",
      message: "Add AED 120 more to use this code. It needs a minimum order of AED 600.",
      quote: {
        subtotalFils: 48000,
        saleSavingsFils: 0,
        couponCode: null,
        couponDiscountFils: 0,
        deliveryFeeFils: 0,
        totalFils: 48000,
      },
    });
  });

  it("refuses a code that takes the total under the minimum charge", async () => {
    world.products = [product({ priceFils: 5000 })];
    world.coupons = [coupon({ valueType: "fixed", percentOff: 0, amountOffFils: 4900 })];
    expect(await quote("EID10")).toMatchObject({ ok: false, code: "TOTAL_TOO_LOW", quote: { totalFils: 5000 } });
  });

  it("refuses an empty or absurdly long basket without pricing it", async () => {
    expect(await quoteCheckout({ lines: [], deliveryEmirate: "abu-dhabi" })).toMatchObject({ ok: false, code: "PRICING_REJECTED" });
    const long = Array.from({ length: 51 }, () => line);
    expect(await quoteCheckout({ lines: long, deliveryEmirate: "abu-dhabi" })).toMatchObject({ ok: false, code: "PRICING_REJECTED" });
    expect(pricingCalls).toEqual([]);
  });
});

describe("the code throttle counts wrong codes only", () => {
  const quote = (discountCode?: string) =>
    quoteCheckout({ lines: [line], deliveryEmirate: "abu-dhabi", ...(discountCode ? { discountCode } : {}) });

  it("never charges a good code, however often the basket re-quotes it", async () => {
    world.coupons = [coupon()];
    for (let i = 0; i < 60; i += 1) {
      expect(await quote("EID10")).toMatchObject({ ok: true, quote: { couponCode: "EID10" } });
    }
    expect((await peek(LIMITS.discountCode, "203.0.113.7")).allowed).toBe(true);
  });

  it("never charges a basket with no code", async () => {
    for (let i = 0; i < 60; i += 1) expect(await quote()).toMatchObject({ ok: true });
    expect((await peek(LIMITS.discountCode, "203.0.113.7")).allowed).toBe(true);
  });

  it("does not charge a real code that only needs a bigger basket", async () => {
    world.coupons = [coupon({ minSubtotalFils: 60000 })];
    for (let i = 0; i < 30; i += 1) expect(await quote("EID10")).toMatchObject({ code: "CODE_MIN_SPEND" });
    expect((await peek(LIMITS.discountCode, "203.0.113.7")).allowed).toBe(true);
  });

  it("charges each wrong guess, then tells the caller to wait — with the basket still priced", async () => {
    world.coupons = [coupon()];
    for (let i = 0; i < LIMITS.discountCode.limit; i += 1) {
      expect(await quote(`GUESS${i}`)).toMatchObject({ ok: false, code: "CODE_INVALID" });
    }
    const blocked = await quote("GUESS99");
    expect(blocked).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      quote: { totalFils: 48000, couponCode: null },
    });
    expect(blocked.ok === false && blocked.message).toMatch(/^Too many attempts\. /);
  });

  it("once out of attempts, does not reveal a GOOD code either — the difference would be the oracle", async () => {
    world.coupons = [coupon()];
    for (let i = 0; i < LIMITS.discountCode.limit; i += 1) await quote(`GUESS${i}`);
    expect(await quote("EID10")).toMatchObject({ ok: false, code: "RATE_LIMITED", quote: { couponCode: null } });
  });

  it("counts an exhausted code as a guess: it confirms the code exists", async () => {
    world.coupons = [coupon({ usageLimit: 5, timesUsed: 5 })];
    for (let i = 0; i < LIMITS.discountCode.limit; i += 1) {
      expect(await quote("EID10")).toMatchObject({ code: "CODE_EXHAUSTED" });
    }
    expect(await quote("EID10")).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("is per network: another address is unaffected", async () => {
    world.coupons = [coupon()];
    for (let i = 0; i < LIMITS.discountCode.limit; i += 1) await quote(`GUESS${i}`);
    currentAddress = "203.0.113.99";
    expect(await quote("EID10")).toMatchObject({ ok: true });
  });

  it("does not stop an honest customer PAYING with a good code, whatever others on her network guessed", async () => {
    world.coupons = [coupon()];
    for (let i = 0; i < LIMITS.discountCode.limit + 3; i += 1) await quote(`GUESS${i}`);
    expect(await quote("EID10")).toMatchObject({ code: "RATE_LIMITED" });
    expect(await startCardCheckout(request({ discountCode: "EID10", shownTotalFils: 43200 }))).toMatchObject({ ok: true });
  });
});
