import type { Failure } from "@backend/actions/admin-shared";
import {
  MAX_DISCOUNT_PERCENT,
  discountStatus,
  saleMatches,
  saleUnitFils,
  type DiscountStatus,
  type DiscountValueType,
  type SaleRule,
  type SaleTarget,
} from "@/lib/discounts";
import type { ParsedDiscount } from "./discount-form";

/**
 * What saving a discount as ACTIVE would do, in numbers.
 *
 * WHY THIS EXISTS. A sale goes live on every matching product the moment it
 * is saved active. Typing 50 where 5 was meant, or choosing "percentage"
 * where "fixed" was meant, sells the catalogue at half price until somebody
 * notices — and every order paid in the meantime is honoured. So before a
 * discount goes live the owner is shown what will change, computed here from
 * the real catalogue, and has to say yes:
 *
 *   "This changes the price of 42 products now. The lowest price becomes
 *    AED 96 (Peony Cloud, was AED 480)."
 *
 * PURE. The action loads the products and passes them in.
 */

export type ImpactProduct = SaleTarget & { name: string };

export type PriceChange = { name: string; wasFils: number; nowFils: number };

export type DiscountImpact =
  | {
      kind: "automatic";
      /** What the discount's status would be if saved active. */
      status: DiscountStatus;
      /** Products whose price this sale actually lowers. */
      productCount: number;
      /** The product that ends up cheapest. */
      lowest: PriceChange | null;
      /** The product that loses the largest share of its price. */
      deepest: (PriceChange & { percent: number }) | null;
      valueType: DiscountValueType;
      percentOff: number;
      amountOffFils: number;
    }
  | {
      kind: "code";
      status: DiscountStatus;
      code: string;
      valueType: DiscountValueType;
      percentOff: number;
      amountOffFils: number;
      minSubtotalFils: number;
      usageLimit: number | null;
      oncePerCustomer: boolean;
    };

/** What `previewDiscount` answers with. */
export type DiscountPreview = { ok: true; impact: DiscountImpact } | Failure;

/** A parsed sale as the pricing engine would see it, if it were active. */
export function ruleFromParsed(parsed: ParsedDiscount, id = "0"): SaleRule {
  return {
    id,
    title: parsed.title,
    labelEn: parsed.labelEn ?? "",
    labelAr: parsed.labelAr ?? "",
    appliesTo: parsed.appliesTo,
    productIds: parsed.productIds.map(String),
    occasionIds: parsed.occasionIds.map(String),
    categories: parsed.categories,
    valueType: parsed.valueType,
    percentOff: parsed.percentOff ?? 0,
    amountOffFils: parsed.amountOffFils ?? 0,
    active: true,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
  };
}

export function discountImpact(
  parsed: ParsedDiscount,
  products: readonly ImpactProduct[],
  now: Date,
): DiscountImpact {
  const window = { active: true, startsAt: parsed.startsAt, endsAt: parsed.endsAt };
  const status = discountStatus(window, now);
  const percentOff = parsed.percentOff ?? 0;
  const amountOffFils = parsed.amountOffFils ?? 0;

  if (parsed.kind === "code") {
    return {
      kind: "code",
      status,
      code: parsed.code ?? "",
      valueType: parsed.valueType,
      percentOff,
      amountOffFils,
      minSubtotalFils: parsed.minSubtotalFils ?? 0,
      usageLimit: parsed.usageLimit,
      oncePerCustomer: parsed.oncePerCustomer,
    };
  }

  const rule = ruleFromParsed(parsed);
  let productCount = 0;
  let lowest: PriceChange | null = null;
  let deepest: (PriceChange & { percent: number }) | null = null;

  for (const product of products) {
    if (!saleMatches(rule, product)) continue;
    const nowFils = saleUnitFils(product.priceFils, rule);
    if (nowFils >= product.priceFils) continue;
    productCount += 1;

    const change = { name: product.name, wasFils: product.priceFils, nowFils };
    if (!lowest || nowFils < lowest.nowFils) lowest = change;
    const percent = Math.round(((product.priceFils - nowFils) / product.priceFils) * 100);
    if (!deepest || percent > deepest.percent) deepest = { ...change, percent };
  }

  return {
    kind: "automatic",
    status,
    productCount,
    lowest,
    deepest,
    valueType: parsed.valueType,
    percentOff,
    amountOffFils,
  };
}

/**
 * A fixed sale that would take more than 90% off a product it applies to.
 *
 * Pricing caps it at 90% regardless, so nothing can be sold for free — but a
 * sale saved at "AED 500 off" against a AED 350 arrangement is a typing
 * mistake, and it is better refused, naming the product, than quietly
 * capped. Returns the cheapest product the amount is too deep for.
 */
export function tooDeepFor(
  parsed: ParsedDiscount,
  products: readonly ImpactProduct[],
): { name: string; priceFils: number } | null {
  if (parsed.kind !== "automatic" || parsed.valueType !== "fixed") return null;
  const amount = parsed.amountOffFils ?? 0;
  const rule = ruleFromParsed(parsed);

  let cheapest: ImpactProduct | null = null;
  for (const product of products) {
    if (!saleMatches(rule, product)) continue;
    if (!cheapest || product.priceFils < cheapest.priceFils) cheapest = product;
  }
  if (!cheapest) return null;
  const cap = Math.floor((cheapest.priceFils * MAX_DISCOUNT_PERCENT) / 100);
  return amount > cap ? { name: cheapest.name, priceFils: cheapest.priceFils } : null;
}

/** The fields whose change on a LIVE discount changes what customers pay. */
const LIVE_TERMS = [
  "code",
  "valueType",
  "percentOff",
  "amountOffFils",
  "appliesTo",
  "products",
  "occasions",
  "categories",
  "startsAt",
  "endsAt",
  "minSubtotalFils",
  "usageLimit",
  "oncePerCustomer",
] as const;

const comparable = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" && item !== null ? String((item as { id?: unknown }).id) : String(item),
      )
      .sort()
      .join(",");
  }
  if (typeof value === "boolean") return value ? "1" : "";
  /* Dates are compared as instants: "…+04:00" and "…Z" may be the same moment. */
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const at = new Date(value).getTime();
    return Number.isNaN(at) ? value : String(at);
  }
  return String(value);
};

/** Did an edit change what a discount DOES (as opposed to what it is called)? */
export function liveTermsChanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  return LIVE_TERMS.some((key) => comparable(before[key]) !== comparable(after[key]));
}
