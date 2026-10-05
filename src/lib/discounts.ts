import { MIN_CHARGE_FILS } from "@/lib/money";

/**
 * Every discount rule, as arithmetic.
 *
 * PURE, AND SHARED. No database, no clock, no server import — `now` is always
 * passed in. The server prices an order with these functions
 * (backend/domain/pricing.ts) and the browser shows a basket with the very
 * same ones, so what a customer is shown and what she is charged cannot
 * drift apart: there is only one implementation to disagree with.
 *
 * TWO KINDS OF DISCOUNT.
 *
 *   automatic sale   lowers the price of the ARRANGEMENT (the product's base
 *                    price plus the size uplift). Add-ons are never reduced.
 *                    At most one sale applies to a product; sales never stack.
 *   discount code    an order-level amount off the already-reduced subtotal,
 *                    sizes and add-ons included. At most one code per order.
 *
 * ROUNDING, always in the customer's favour and always to whole dirhams where
 * a customer reads a price:
 *
 *   sale price       rounded DOWN to the whole dirham
 *   percentage code  rounded UP to the whole dirham, capped at the subtotal
 *
 * Everything is integer fils. A value that is not a safe integer is refused
 * or left unchanged — never guessed at.
 */

/** The deepest discount of either kind. There is no free-order path. */
export const MAX_DISCOUNT_PERCENT = 90;

/* The minimum charge is defined ONCE, in lib/money.ts. It is re-exported so
   the discount maths and its callers read it from here without a second
   definition ever existing. */
export { MIN_CHARGE_FILS };

/**
 * How long an unpaid discounted order holds its price and its claim on a
 * code, in minutes. After this the order is cancelled, with its payment
 * (backend/payments/coupon-claims.ts), so a sale price cannot be paid weeks
 * after the sale ended and a limited code cannot be held open for ever.
 */
export const DISCOUNT_HOLD_MINUTES = 60;

/** A customer-facing sale label, in either language. */
export const SALE_LABEL_MAX = 28;

/** Stored uppercase; three to twenty-four letters, digits, hyphen, underscore. */
export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;
export const CODE_MAX_LENGTH = 24;

export type DiscountValueType = "percentage" | "fixed";

export type DiscountValue = {
  valueType: DiscountValueType;
  /** Whole number 1–90 when `valueType` is "percentage"; ignored otherwise. */
  percentOff: number;
  /** Fils when `valueType` is "fixed"; ignored otherwise. */
  amountOffFils: number;
};

export type DiscountWindow = {
  active: boolean;
  /** ISO instant, inclusive. */
  startsAt?: string | null;
  /** ISO instant, exclusive. */
  endsAt?: string | null;
};

export type DiscountStatus = "active" | "scheduled" | "expired" | "draft";

const instant = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const at = new Date(value).getTime();
  return Number.isNaN(at) ? null : at;
};

/**
 * Where a discount is in its life. Derived on every request, never stored,
 * so nothing has to run at 18:00 for a sale to start at 18:00.
 *
 * Expired wins over draft: an ended discount that was also switched off is
 * "expired", because that is the fact that cannot be undone by a switch.
 */
export function discountStatus(d: DiscountWindow, now: Date): DiscountStatus {
  const at = now.getTime();
  const ends = instant(d.endsAt);
  if (ends !== null && ends <= at) return "expired";
  if (!d.active) return "draft";
  const starts = instant(d.startsAt);
  if (starts !== null && starts > at) return "scheduled";
  return "active";
}

/** " eid 10 " → "EID10". Codes are compared only after this. */
export function normaliseCode(raw: string): string {
  return String(raw ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** A normalised code that could exist. Checked BEFORE any database query. */
export function isWellFormedCode(code: string): boolean {
  return code.length <= CODE_MAX_LENGTH && CODE_PATTERN.test(code);
}

const isFils = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

const clampPercent = (percent: number): number =>
  Math.min(MAX_DISCOUNT_PERCENT, Math.max(1, Math.floor(percent)));

/**
 * The sale price of one arrangement, in fils.
 *
 *   percentage   floor(arrangement × (100 − p) / 100) to the whole dirham
 *   fixed        arrangement − min(amount, 90% of arrangement), floored to
 *                the whole dirham
 *
 * Returns the price UNCHANGED when the rule would not make it strictly
 * lower, when the result would fall under one dirham, or when anything is
 * not a whole number of fils. "Unchanged" means "not on sale": no badge and
 * no strike-through for a saving that rounding removed.
 */
export function saleUnitFils(arrangementFils: number, v: DiscountValue): number {
  if (!isFils(arrangementFils)) return arrangementFils;

  let result: number;
  if (v.valueType === "percentage") {
    if (!Number.isFinite(v.percentOff) || v.percentOff < 1) return arrangementFils;
    const p = clampPercent(v.percentOff);
    result = Math.floor((arrangementFils * (100 - p)) / 10000) * 100;
  } else {
    if (!isFils(v.amountOffFils) || v.amountOffFils <= 0) return arrangementFils;
    const cap = Math.floor((arrangementFils * MAX_DISCOUNT_PERCENT) / 100);
    const off = Math.min(v.amountOffFils, cap);
    result = Math.floor((arrangementFils - off) / 100) * 100;
  }

  /* Never free, never below a dirham: 150 fils at 90% floors to zero, and a
     zero-priced arrangement is not a sale, it is a mistake. */
  if (!Number.isSafeInteger(result) || result < 100 || result >= arrangementFils) {
    return arrangementFils;
  }
  return result;
}

/**
 * What a code takes off an order, in fils. Never more than the subtotal.
 *
 *   percentage   ceil(subtotal × p / 100) to the whole dirham
 *   fixed        min(amount, subtotal)
 */
export function couponDiscountFils(subtotalFils: number, v: DiscountValue): number {
  if (!isFils(subtotalFils) || subtotalFils === 0) return 0;

  if (v.valueType === "percentage") {
    if (!Number.isFinite(v.percentOff) || v.percentOff < 1) return 0;
    const p = clampPercent(v.percentOff);
    return Math.min(subtotalFils, Math.ceil((subtotalFils * p) / 10000) * 100);
  }
  if (!isFils(v.amountOffFils)) return 0;
  return Math.min(v.amountOffFils, subtotalFils);
}

/* ------------------------------------------------------------------ */
/* Automatic sales                                                     */
/* ------------------------------------------------------------------ */

export type SaleScope = "all" | "products" | "occasions" | "categories";

export type SaleRule = DiscountValue &
  DiscountWindow & {
    id: string;
    /** The owner's internal name. Never sent to a browser. */
    title: string;
    labelEn: string;
    labelAr: string;
    appliesTo: SaleScope;
    productIds: readonly string[];
    occasionIds: readonly string[];
    categories: readonly string[];
  };

export type SaleTarget = {
  id: string;
  /** The product's base (Standard) price. */
  priceFils: number;
  occasionIds: readonly string[];
  category: string;
};

export function saleMatches(rule: SaleRule, target: SaleTarget): boolean {
  switch (rule.appliesTo) {
    case "all":
      return true;
    case "products":
      return rule.productIds.includes(target.id);
    case "occasions":
      return target.occasionIds.some((id) => rule.occasionIds.includes(id));
    case "categories":
      return rule.categories.includes(target.category);
    default:
      return false;
  }
}

/* Narrower scope wins a tie: a sale the owner aimed at one product is the
   one she meant for that product. */
const SCOPE_RANK: Record<SaleScope, number> = { products: 0, occasions: 1, categories: 2, all: 3 };

/**
 * The ONE sale a product is on, or null.
 *
 * Chosen on the product's base price and then used for every size, so the
 * card, the product page, the basket and the server all name the same sale.
 * Lowest resulting price wins; then the narrower scope; then the oldest.
 */
export function bestSaleFor(
  target: SaleTarget,
  rules: readonly SaleRule[],
  now: Date,
): SaleRule | null {
  let best: { rule: SaleRule; price: number } | null = null;

  for (const rule of rules) {
    if (discountStatus(rule, now) !== "active") continue;
    if (!saleMatches(rule, target)) continue;
    const price = saleUnitFils(target.priceFils, rule);
    if (price >= target.priceFils) continue;

    if (!best) {
      best = { rule, price };
      continue;
    }
    const byPrice = price - best.price;
    const byScope = SCOPE_RANK[rule.appliesTo] - SCOPE_RANK[best.rule.appliesTo];
    const byAge = Number(rule.id) - Number(best.rule.id);
    if (byPrice < 0 || (byPrice === 0 && (byScope < 0 || (byScope === 0 && byAge < 0)))) {
      best = { rule, price };
    }
  }
  return best?.rule ?? null;
}

/* ------------------------------------------------------------------ */
/* Discount codes                                                      */
/* ------------------------------------------------------------------ */

export type CouponRule = DiscountValue &
  DiscountWindow & {
    id: string;
    title: string;
    code: string;
    minSubtotalFils: number;
    usageLimit: number | null;
    timesUsed: number;
    oncePerCustomer: boolean;
  };

export type CouponRefusal = "inactive" | "min_spend" | "exhausted" | "already_used";

export type CouponCheck =
  | { ok: true }
  | { ok: false; reason: CouponRefusal; shortfallFils?: number };

/**
 * May this code be used on this basket, right now?
 *
 * "inactive" covers draft, scheduled and expired alike — and, at the caller,
 * a code that does not exist — so one answer is given for all of them and a
 * stranger cannot learn which codes are real.
 */
export function checkCoupon(
  c: CouponRule,
  facts: { now: Date; subtotalFils: number; emailHasUsed: boolean },
): CouponCheck {
  if (discountStatus(c, facts.now) !== "active") return { ok: false, reason: "inactive" };
  if (c.usageLimit !== null && c.timesUsed >= c.usageLimit) return { ok: false, reason: "exhausted" };
  if (c.oncePerCustomer && facts.emailHasUsed) return { ok: false, reason: "already_used" };
  if (facts.subtotalFils < c.minSubtotalFils) {
    return {
      ok: false,
      reason: "min_spend",
      shortfallFils: c.minSubtotalFils - facts.subtotalFils,
    };
  }
  return { ok: true };
}
