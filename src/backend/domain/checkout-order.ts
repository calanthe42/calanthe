import type { CouponRefusal } from "@/lib/discounts";
import type { PricedOrder, PricedSale } from "./pricing";

/**
 * From a priced basket to what is stored and what is shown.
 *
 * PURE. The checkout action is a "use server" file and may export nothing
 * but async functions, so the shaping lives here where it can be tested: the
 * order row a priced basket becomes, the totals a basket is quoted, and the
 * refusal code a rejected discount code is reported with.
 *
 * Everything below is derived from `PricedOrder` — which was computed on the
 * server from the server's own rows. No value here has ever been in a browser.
 */

/** What the basket and the checkout summary show. Amounts only, all in fils. */
export type CheckoutQuote = {
  /** Sum of the lines, sale prices already applied. */
  subtotalFils: number;
  /** What the sales took off. Already reflected in `subtotalFils`. */
  saleSavingsFils: number;
  /** The code that applied, in capitals — null when none did. */
  couponCode: string | null;
  couponDiscountFils: number;
  deliveryFeeFils: number;
  totalFils: number;
};

export function toCheckoutQuote(priced: PricedOrder): CheckoutQuote {
  return {
    subtotalFils: priced.subtotalFils,
    saleSavingsFils: priced.saleSavingsFils,
    couponCode: priced.coupon?.code ?? null,
    couponDiscountFils: priced.couponDiscountFils,
    deliveryFeeFils: priced.deliveryFeeFils,
    totalFils: priced.totalFils,
  };
}

export type CouponRefusalCode =
  | "CODE_INVALID"
  | "CODE_MIN_SPEND"
  | "CODE_ALREADY_USED"
  | "CODE_EXHAUSTED";

const REFUSAL_CODE: Record<CouponRefusal, CouponRefusalCode> = {
  inactive: "CODE_INVALID",
  min_spend: "CODE_MIN_SPEND",
  already_used: "CODE_ALREADY_USED",
  exhausted: "CODE_EXHAUSTED",
};

export const couponRefusalCode = (reason: CouponRefusal): CouponRefusalCode => REFUSAL_CODE[reason];

/**
 * Refusals that say something about whether a code EXISTS or is spent. Each
 * one costs the caller an attempt (LIMITS.discountCode). A minimum-spend
 * refusal does not: the customer has a real code and needs one more stem.
 */
export const isGuessableRefusal = (reason: CouponRefusal): boolean =>
  reason === "inactive" || reason === "exhausted";

/** The terms an order was discounted under, frozen (Orders.discountSnapshot). */
export type DiscountSnapshot = {
  coupon: {
    id: string;
    title: string;
    code: string;
    valueType: "percentage" | "fixed";
    percentOff: number;
    amountOffFils: number;
    minSubtotalFils: number;
  } | null;
  sales: PricedSale[];
};

/** Null when the order had no sale and no code: nothing to explain. */
export function discountSnapshotOf(priced: PricedOrder): DiscountSnapshot | null {
  const sales: PricedSale[] = [];
  for (const line of priced.lines) {
    if (line.sale && !sales.some((s) => s.id === line.sale?.id)) sales.push({ ...line.sale });
  }
  const c = priced.couponDiscountFils > 0 ? priced.coupon : null;
  if (!c && sales.length === 0) return null;
  return {
    coupon: c
      ? {
          id: c.id,
          title: c.title,
          code: c.code,
          valueType: c.valueType,
          percentOff: c.percentOff,
          amountOffFils: c.amountOffFils,
          minSubtotalFils: c.minSubtotalFils,
        }
      : null,
    sales,
  };
}

/**
 * The items and the money of the order row — exactly the fields the order's
 * integrity hook reconciles (backend/payload/hooks/orderIntegrity.ts).
 *
 * A code is recorded only when it actually took something off: the hook
 * refuses a code beside a zero discount, and a receipt naming a code that
 * did nothing would be a lie.
 */
export function orderMoneyFields(priced: PricedOrder) {
  const coupon = priced.couponDiscountFils > 0 ? priced.coupon : null;
  const snapshot = discountSnapshotOf(priced);

  return {
    items: priced.lines.map((line) => ({
      product: Number(line.product.id),
      productName: line.productName,
      productSlug: line.productSlug,
      quantity: line.quantity,
      unitPriceFils: line.unitPriceFils,
      lineTotalFils: line.lineTotalFils,
      selectedOptions: line.selectedOptions,
      ...(line.sale && line.compareAtUnitPriceFils !== null
        ? {
            compareAtUnitPriceFils: line.compareAtUnitPriceFils,
            saleLabelEn: line.sale.labelEn,
            saleLabelAr: line.sale.labelAr,
            sale: Number(line.sale.id),
          }
        : {}),
    })),
    subtotalFils: priced.subtotalFils,
    deliveryFeeFils: priced.deliveryFeeFils,
    discountFils: coupon ? priced.couponDiscountFils : 0,
    couponDiscountFils: coupon ? priced.couponDiscountFils : 0,
    totalFils: priced.totalFils,
    ...(coupon ? { couponCode: coupon.code, couponDiscount: Number(coupon.id) } : {}),
    ...(snapshot ? { discountSnapshot: snapshot } : {}),
  };
}

/**
 * What the sales took off an order, read back from its stored lines. For
 * receipts — never from the live discount, which may have changed since.
 */
export function saleSavingsOfItems(
  items:
    | readonly {
        quantity: number;
        unitPriceFils: number;
        compareAtUnitPriceFils?: number | null;
      }[]
    | null
    | undefined,
): number {
  return (items ?? []).reduce((sum, item) => {
    const was = Number(item.compareAtUnitPriceFils ?? 0);
    return was > item.unitPriceFils ? sum + (was - item.unitPriceFils) * item.quantity : sum;
  }, 0);
}
