import { describe, expect, it } from "vitest";
import { MIN_CHARGE_FILS as MONEY_MIN } from "./money";
import {
  MIN_CHARGE_FILS,
  bestSaleFor,
  checkCoupon,
  couponDiscountFils,
  discountStatus,
  isWellFormedCode,
  normaliseCode,
  saleMatches,
  saleUnitFils,
  type CouponRule,
  type SaleRule,
  type SaleTarget,
} from "./discounts";

/**
 * Every money rule of the discounts feature, one named test each.
 */

const pct = (percentOff: number) => ({ valueType: "percentage" as const, percentOff, amountOffFils: 0 });
const fixed = (amountOffFils: number) => ({ valueType: "fixed" as const, percentOff: 0, amountOffFils });

const NOW = new Date("2026-10-05T10:00:00.000Z");

describe("the minimum charge", () => {
  it("is the one constant from lib/money, not a second definition", () => {
    expect(MIN_CHARGE_FILS).toBe(MONEY_MIN);
    expect(MIN_CHARGE_FILS).toBe(200);
  });
});

describe("saleUnitFils — percentage", () => {
  it("takes 20% off AED 480", () => {
    expect(saleUnitFils(48000, pct(20))).toBe(38400);
  });

  it("rounds the sale price DOWN to the whole dirham", () => {
    /* 650 × 0.85 = 552.50 → 552 */
    expect(saleUnitFils(65000, pct(15))).toBe(55200);
    /* 390 × 0.67 = 261.30 → 261 */
    expect(saleUnitFils(39000, pct(33))).toBe(26100);
  });

  it("clamps a percentage above 90 to 90", () => {
    expect(saleUnitFils(48000, pct(95))).toBe(4800);
    expect(saleUnitFils(48000, pct(100))).toBe(4800);
  });

  it("leaves the price unchanged for zero or a negative percentage", () => {
    expect(saleUnitFils(48000, pct(0))).toBe(48000);
    expect(saleUnitFils(48000, pct(-20))).toBe(48000);
    expect(saleUnitFils(48000, pct(Number.NaN))).toBe(48000);
  });
});

describe("saleUnitFils — fixed amount", () => {
  it("takes AED 100 off AED 480", () => {
    expect(saleUnitFils(48000, fixed(10000))).toBe(38000);
  });

  it("rounds the sale price DOWN to the whole dirham", () => {
    /* 480 − 50.50 = 429.50 → 429 */
    expect(saleUnitFils(48000, fixed(5050))).toBe(42900);
  });

  it("caps an amount larger than the price at 90%, never zero or negative", () => {
    expect(saleUnitFils(35000, fixed(50000))).toBe(3500);
  });

  it("leaves the price unchanged for a zero amount", () => {
    expect(saleUnitFils(48000, fixed(0))).toBe(48000);
  });
});

describe("saleUnitFils — floors and guards", () => {
  it("is always a multiple of 100 and never above the input", () => {
    for (const price of [100, 950, 12345, 39050, 48000, 99999, 250000]) {
      for (const rule of [pct(1), pct(7), pct(33), pct(50), pct(90), fixed(100), fixed(4999), fixed(10 ** 7)]) {
        const sale = saleUnitFils(price, rule);
        expect(sale).toBeLessThanOrEqual(price);
        if (sale !== price) {
          expect(sale % 100).toBe(0);
          expect(sale).toBeGreaterThanOrEqual(100);
        }
      }
    }
  });

  it("never makes an arrangement free: a result under one dirham is no sale at all", () => {
    /* 150 fils at 90% is 15 fils, which floors to zero. */
    expect(saleUnitFils(150, pct(90))).toBe(150);
    expect(saleUnitFils(190, fixed(150))).toBe(190);
  });

  it("is no sale when flooring removes the whole saving", () => {
    /* AED 1.00 at 1% is 0.99 → floors to 0 → unchanged. AED 100.00 at 1% is
       99.00 exactly, which IS lower. */
    expect(saleUnitFils(100, pct(1))).toBe(100);
    expect(saleUnitFils(10000, pct(1))).toBe(9900);
  });

  it("returns a non-integer or negative input unchanged", () => {
    expect(saleUnitFils(480.5, pct(20))).toBe(480.5);
    expect(saleUnitFils(-48000, pct(20))).toBe(-48000);
    expect(saleUnitFils(48000, fixed(10.5))).toBe(48000);
  });
});

describe("couponDiscountFils", () => {
  it("rounds a percentage UP to the whole dirham", () => {
    /* 10% of 552.00 = 55.20 → 56 */
    expect(couponDiscountFils(55200, pct(10))).toBe(5600);
    expect(couponDiscountFils(50000, pct(10))).toBe(5000);
  });

  it("caps a fixed amount at the subtotal", () => {
    expect(couponDiscountFils(4000, fixed(5000))).toBe(4000);
    expect(couponDiscountFils(40000, fixed(5000))).toBe(5000);
  });

  it("never exceeds the subtotal, whatever the percentage", () => {
    for (const subtotal of [1, 50, 99, 100, 150, 12345, 48000]) {
      for (const p of [1, 10, 50, 90, 100, 500]) {
        expect(couponDiscountFils(subtotal, pct(p))).toBeLessThanOrEqual(subtotal);
      }
    }
  });

  it("clamps a percentage above 90 to 90", () => {
    expect(couponDiscountFils(100000, pct(100))).toBe(90000);
  });

  it("is zero for an empty, invalid or unpriced basket", () => {
    expect(couponDiscountFils(0, pct(10))).toBe(0);
    expect(couponDiscountFils(-100, pct(10))).toBe(0);
    expect(couponDiscountFils(100.5, fixed(50))).toBe(0);
    expect(couponDiscountFils(48000, pct(0))).toBe(0);
  });
});

describe("discountStatus", () => {
  const at = (iso: string) => new Date(iso);

  it("is draft when inactive", () => {
    expect(discountStatus({ active: false }, NOW)).toBe("draft");
  });

  it("is active with no dates", () => {
    expect(discountStatus({ active: true }, NOW)).toBe("active");
    expect(discountStatus({ active: true, startsAt: null, endsAt: null }, NOW)).toBe("active");
  });

  it("is scheduled before startsAt and active exactly at it", () => {
    const d = { active: true, startsAt: "2026-10-05T10:00:00.000Z" };
    expect(discountStatus(d, at("2026-10-05T09:59:59.999Z"))).toBe("scheduled");
    expect(discountStatus(d, at("2026-10-05T10:00:00.000Z"))).toBe("active");
  });

  it("is active one millisecond before endsAt and expired exactly at it", () => {
    const d = { active: true, endsAt: "2026-10-05T10:00:00.000Z" };
    expect(discountStatus(d, at("2026-10-05T09:59:59.999Z"))).toBe("active");
    expect(discountStatus(d, at("2026-10-05T10:00:00.000Z"))).toBe("expired");
  });

  it("lets expired win over inactive", () => {
    expect(discountStatus({ active: false, endsAt: "2026-10-01T00:00:00.000Z" }, NOW)).toBe("expired");
  });

  it("compares instants, so 18:00 in Dubai flips at 14:00Z", () => {
    const d = { active: true, startsAt: "2026-10-10T18:00:00+04:00" };
    expect(discountStatus(d, at("2026-10-10T13:59:59.999Z"))).toBe("scheduled");
    expect(discountStatus(d, at("2026-10-10T14:00:00.000Z"))).toBe("active");
  });
});

const rule = (over: Partial<SaleRule> = {}): SaleRule => ({
  id: "1",
  title: "Internal",
  labelEn: "Eid offer",
  labelAr: "عرض العيد",
  appliesTo: "all",
  productIds: [],
  occasionIds: [],
  categories: [],
  active: true,
  ...pct(20),
  ...over,
});

const target = (over: Partial<SaleTarget> = {}): SaleTarget => ({
  id: "7",
  priceFils: 48000,
  occasionIds: ["3"],
  category: "bouquet",
  ...over,
});

describe("saleMatches", () => {
  it("matches everything for 'all'", () => {
    expect(saleMatches(rule(), target())).toBe(true);
  });

  it("matches and misses by product", () => {
    expect(saleMatches(rule({ appliesTo: "products", productIds: ["7"] }), target())).toBe(true);
    expect(saleMatches(rule({ appliesTo: "products", productIds: ["8"] }), target())).toBe(false);
  });

  it("matches and misses by occasion", () => {
    expect(saleMatches(rule({ appliesTo: "occasions", occasionIds: ["3", "4"] }), target())).toBe(true);
    expect(saleMatches(rule({ appliesTo: "occasions", occasionIds: ["4"] }), target())).toBe(false);
  });

  it("matches and misses by category", () => {
    expect(saleMatches(rule({ appliesTo: "categories", categories: ["bouquet"] }), target())).toBe(true);
    expect(saleMatches(rule({ appliesTo: "categories", categories: ["plant"] }), target())).toBe(false);
  });

  it("ignores ids left over from another scope", () => {
    /* A rule switched from "products" to "categories" may still carry ids. */
    expect(saleMatches(rule({ appliesTo: "categories", categories: ["plant"], productIds: ["7"] }), target())).toBe(false);
  });
});

describe("bestSaleFor — one sale per product, never stacked", () => {
  it("returns null with no rules", () => {
    expect(bestSaleFor(target(), [], NOW)).toBeNull();
  });

  it("picks the lower resulting price: fixed 100 beats 20% on AED 480", () => {
    const twenty = rule({ id: "1", ...pct(20) });
    const hundred = rule({ id: "2", ...fixed(10000) });
    /* 384 vs 380 */
    expect(bestSaleFor(target({ priceFils: 48000 }), [twenty, hundred], NOW)?.id).toBe("2");
  });

  it("picks the lower resulting price: 20% beats fixed 100 on AED 800", () => {
    const twenty = rule({ id: "1", ...pct(20) });
    const hundred = rule({ id: "2", ...fixed(10000) });
    /* 640 vs 700 */
    expect(bestSaleFor(target({ priceFils: 80000 }), [hundred, twenty], NOW)?.id).toBe("1");
  });

  it("breaks an equal price by scope: products, then occasions, then categories, then all", () => {
    const all = rule({ id: "1" });
    const categories = rule({ id: "2", appliesTo: "categories", categories: ["bouquet"] });
    const occasions = rule({ id: "3", appliesTo: "occasions", occasionIds: ["3"] });
    const products = rule({ id: "4", appliesTo: "products", productIds: ["7"] });
    expect(bestSaleFor(target(), [all, categories, occasions, products], NOW)?.id).toBe("4");
    expect(bestSaleFor(target(), [all, categories, occasions], NOW)?.id).toBe("3");
    expect(bestSaleFor(target(), [all, categories], NOW)?.id).toBe("2");
  });

  it("breaks an equal price and scope by the oldest (lowest id), in any order", () => {
    const older = rule({ id: "5" });
    const newer = rule({ id: "12" });
    expect(bestSaleFor(target(), [newer, older], NOW)?.id).toBe("5");
    expect(bestSaleFor(target(), [older, newer], NOW)?.id).toBe("5");
  });

  it("ignores scheduled, expired and draft rules", () => {
    const scheduled = rule({ id: "1", startsAt: "2026-11-01T00:00:00.000Z", ...pct(50) });
    const expired = rule({ id: "2", endsAt: "2026-10-01T00:00:00.000Z", ...pct(50) });
    const draft = rule({ id: "3", active: false, ...pct(50) });
    const live = rule({ id: "4", ...pct(10) });
    expect(bestSaleFor(target(), [scheduled, expired, draft, live], NOW)?.id).toBe("4");
    expect(bestSaleFor(target(), [scheduled, expired, draft], NOW)).toBeNull();
  });

  it("ignores a rule that does not lower the price", () => {
    expect(bestSaleFor(target({ priceFils: 100 }), [rule({ ...pct(1) })], NOW)).toBeNull();
  });

  it("ignores a rule that does not match", () => {
    expect(bestSaleFor(target(), [rule({ appliesTo: "products", productIds: ["99"] })], NOW)).toBeNull();
  });
});

const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  id: "9",
  title: "EID10",
  code: "EID10",
  active: true,
  minSubtotalFils: 0,
  usageLimit: null,
  timesUsed: 0,
  oncePerCustomer: false,
  ...pct(10),
  ...over,
});

describe("checkCoupon", () => {
  const facts = { now: NOW, subtotalFils: 50000, emailHasUsed: false };

  it("accepts a live code", () => {
    expect(checkCoupon(coupon(), facts)).toEqual({ ok: true });
  });

  it("gives ONE answer for draft, scheduled and expired", () => {
    expect(checkCoupon(coupon({ active: false }), facts)).toEqual({ ok: false, reason: "inactive" });
    expect(checkCoupon(coupon({ startsAt: "2026-11-01T00:00:00.000Z" }), facts)).toEqual({ ok: false, reason: "inactive" });
    expect(checkCoupon(coupon({ endsAt: "2026-10-01T00:00:00.000Z" }), facts)).toEqual({ ok: false, reason: "inactive" });
  });

  it("is exhausted at the usage limit, and never with no limit", () => {
    expect(checkCoupon(coupon({ usageLimit: 20, timesUsed: 19 }), facts)).toEqual({ ok: true });
    expect(checkCoupon(coupon({ usageLimit: 20, timesUsed: 20 }), facts)).toEqual({ ok: false, reason: "exhausted" });
    expect(checkCoupon(coupon({ usageLimit: 20, timesUsed: 21 }), facts)).toEqual({ ok: false, reason: "exhausted" });
    expect(checkCoupon(coupon({ usageLimit: null, timesUsed: 10 ** 6 }), facts)).toEqual({ ok: true });
  });

  it("refuses a once-per-customer code the email has used", () => {
    expect(checkCoupon(coupon({ oncePerCustomer: true }), { ...facts, emailHasUsed: true })).toEqual({
      ok: false,
      reason: "already_used",
    });
    /* Without the rule, a previous use is irrelevant. */
    expect(checkCoupon(coupon(), { ...facts, emailHasUsed: true })).toEqual({ ok: true });
  });

  it("reports the exact shortfall below the minimum, and passes exactly at it", () => {
    const c = coupon({ minSubtotalFils: 45000 });
    expect(checkCoupon(c, { ...facts, subtotalFils: 40000 })).toEqual({
      ok: false,
      reason: "min_spend",
      shortfallFils: 5000,
    });
    expect(checkCoupon(c, { ...facts, subtotalFils: 45000 })).toEqual({ ok: true });
  });

  it("checks in order: inactive, exhausted, already used, minimum", () => {
    const everythingWrong = coupon({
      active: false,
      usageLimit: 1,
      timesUsed: 1,
      oncePerCustomer: true,
      minSubtotalFils: 10 ** 7,
    });
    const wrong = { ...facts, emailHasUsed: true };
    expect(checkCoupon(everythingWrong, wrong)).toMatchObject({ reason: "inactive" });
    expect(checkCoupon({ ...everythingWrong, active: true }, wrong)).toMatchObject({ reason: "exhausted" });
    expect(checkCoupon({ ...everythingWrong, active: true, usageLimit: null }, wrong)).toMatchObject({
      reason: "already_used",
    });
  });
});

describe("codes", () => {
  it("normalises: trims, removes inner whitespace, uppercases", () => {
    expect(normaliseCode(" eid 10 ")).toBe("EID10");
    expect(normaliseCode("welcome-5")).toBe("WELCOME-5");
  });

  it("knows what a code can look like before anything is queried", () => {
    expect(isWellFormedCode("EID10")).toBe(true);
    expect(isWellFormedCode("AB")).toBe(false);
    expect(isWellFormedCode("A".repeat(24))).toBe(true);
    expect(isWellFormedCode("A".repeat(25))).toBe(false);
    expect(isWellFormedCode("EID 10")).toBe(false);
    expect(isWellFormedCode("eid10")).toBe(false);
    expect(isWellFormedCode("-EID10")).toBe(false);
    expect(isWellFormedCode("EID10%' OR 1=1")).toBe(false);
  });
});
