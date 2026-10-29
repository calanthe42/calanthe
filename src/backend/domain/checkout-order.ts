import type { CouponRefusal } from "@/lib/discounts";
import type { PricedOrder, PricedSale } from "./pricing";

/**
 * From a priced basket to what is stored and what is shown.
 *
 * PURE. The checkout action is a "use server" file and may export nothing
 * but async functions, so the shaping lives here where it can be tested: the
 * order row a priced basket becomes, the totals a basket is quoted, the
 * refusal code a rejected discount code is reported with — and how the
 * basket reads a quote's answer about the welcome gift.
 *
 * Everything else below is derived from `PricedOrder` — which was computed on
 * the server from the server's own rows. No value of it has ever been in a
 * browser.
 */

/** What the basket and the checkout summary show. Amounts only, all in fils. */
export type CheckoutQuote = {
  /** Sum of the lines, sale prices already applied. */
  subtotalFils: number;
  /** What the sales took off. Already reflected in `subtotalFils`. */
  saleSavingsFils: number;
  /** The code that applied, in capitals — null when none did, and for the welcome gift. */
  couponCode: string | null;
  /**
   * True when the welcome gift is what `couponDiscountFils` took off. Its code
   * is never sent: the browser has nothing to type, store or send back.
   */
  welcome: boolean;
  couponDiscountFils: number;
  deliveryFeeFils: number;
  totalFils: number;
};

export function toCheckoutQuote(priced: PricedOrder): CheckoutQuote {
  const welcome = priced.coupon?.welcome === true && priced.couponDiscountFils > 0;
  return {
    subtotalFils: priced.subtotalFils,
    saleSavingsFils: priced.saleSavingsFils,
    couponCode: welcome ? null : (priced.coupon?.code ?? null),
    welcome,
    couponDiscountFils: priced.couponDiscountFils,
    deliveryFeeFils: priced.deliveryFeeFils,
    totalFils: priced.totalFils,
  };
}

/**
 * The server's answer about the welcome gift, for one basket — as the basket
 * keeps it (lib/cart.tsx).
 *
 *   applied     the quote took it off, and this much
 *   declined    not on this basket: not hers, or the payment refused it.
 *               With the server's sentence when she can do something about
 *               it (a minimum spend)
 *   unchecked   it could not be asked — the database or the connection
 *               failed. NEVER taken for "not hers": a first order paid at
 *               full price uses the gift up for good. It is asked again, and
 *               only after WELCOME_TRIES does the basket say so and let her
 *               choose.
 */
export type WelcomeAnswer =
  | { key: string; status: "applied"; discountFils: number }
  | { key: string; status: "declined"; message: string | null }
  | { key: string; status: "unchecked"; tries: number };

/** How many times one basket is asked about the gift before it says it could not check. */
export const WELCOME_TRIES = 3;

/** A welcome quote's result, as far as the gift is concerned (backend/actions/checkout.ts `QuoteResult`). */
type WelcomeQuoteResult =
  | { ok: true; quote: Pick<CheckoutQuote, "welcome" | "couponDiscountFils">; welcomeMessage?: string }
  | { ok: false };

/** What one quote — or a request that never answered (null) — says about the gift on basket `key`. */
export function welcomeAnswerOf(
  key: string,
  result: WelcomeQuoteResult | null,
  previous: WelcomeAnswer | null,
): WelcomeAnswer {
  if (result?.ok) {
    return result.quote.welcome && result.quote.couponDiscountFils > 0
      ? { key, status: "applied", discountFils: result.quote.couponDiscountFils }
      : { key, status: "declined", message: result.welcomeMessage ?? null };
  }
  const tries = previous?.key === key && previous.status === "unchecked" ? previous.tries : 0;
  return { key, status: "unchecked", tries: tries + 1 };
}

/** Where the gift stands for basket `key`: answered, still being asked, or given up on. */
export function welcomeStateOf(
  answer: WelcomeAnswer | null,
  key: string,
): "applied" | "declined" | "checking" | "failed" {
  if (!answer || answer.key !== key) return "checking";
  if (answer.status === "unchecked") return answer.tries >= WELCOME_TRIES ? "failed" : "checking";
  return answer.status;
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
