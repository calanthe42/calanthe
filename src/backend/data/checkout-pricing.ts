import type { Payload } from "payload";
import type { Product } from "@/payload-types";
import {
  priceOrder,
  type CheckoutLineRequest,
  type OrderDiscounts,
  type PricedOrder,
} from "@backend/domain/pricing";
import type { CouponRule, SaleRule } from "@/lib/discounts";
import { emailHasRedeemed, findCoupon, loadLiveSaleRules } from "./discounts";

/**
 * ONE pricing entry for everything that shows or charges an order total.
 *
 * The basket's quote (`quoteCheckout`) and the payment (`startCardCheckout`)
 * both call this, so the total a customer is shown and the total she is
 * charged are computed by the same code from the same rows: the products as
 * they are now, the sales that are live now, the code as it stands now.
 *
 * NOTHING HERE COMES FROM THE BROWSER EXCEPT WHAT IS BEING BOUGHT — product
 * ids, quantities, option ids, a delivery emirate and the text of a code.
 * Never an amount.
 *
 * It only reads. It creates nothing and reserves nothing; the claim on a
 * limited code is taken by the checkout action, when there is an order to
 * hold it (backend/payments/coupon-claims.ts).
 */

export type CheckoutPricingInput = {
  lines: CheckoutLineRequest[];
  deliveryEmirate: string;
  /** What the customer typed. Normalised and shape-checked before any query. */
  discountCode?: string;
  /**
   * Used ONLY for the once-per-customer rule, and ONLY by the payment path.
   * The quote never passes it: a quote that answered "this email has used
   * this code" would tell a stranger whose email belongs to a customer.
   */
  customerEmail?: string;
};

export type CheckoutPricing =
  | {
      ok: true;
      priced: PricedOrder;
      products: Map<string, Product>;
      /** True when a code was sent, whether or not it applied. */
      codeGiven: boolean;
    }
  | {
      ok: false;
      failure:
        | "catalogue" /* the catalogue or the discounts could not be read */
        | "unavailable" /* a product is gone or hidden */
        | "total_too_low" /* the code takes the total under the minimum charge */
        | "rejected" /* anything else the pricing engine refuses */;
      /** The engine's own code, e.g. INVALID_QUANTITY. */
      code: string;
      /** For "total_too_low": the same basket priced without the code. */
      withoutCode?: PricedOrder;
    };

/** Injected in tests; the real ones in production. */
export type CheckoutPricingDeps = {
  loadSales: (payload: Payload, now: Date) => Promise<SaleRule[]>;
  findCoupon: (payload: Payload, code: string) => Promise<CouponRule | null>;
  emailHasRedeemed: (payload: Payload, couponId: string, email: string) => Promise<boolean>;
};

const DEFAULT_DEPS: CheckoutPricingDeps = {
  loadSales: loadLiveSaleRules,
  findCoupon,
  emailHasRedeemed,
};

/* The engine throws "CODE: sentence". Anything that is not in that form is a
   bug or a malformed request, and its message is never passed on as a code. */
const engineCode = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : "";
  const [head] = raw.split(":");
  return head && /^[A-Z_]+$/.test(head) ? head : "INVALID_TOTAL";
};

export async function priceCheckout(
  payload: Payload,
  input: CheckoutPricingInput,
  now: Date,
  deps: CheckoutPricingDeps = DEFAULT_DEPS,
): Promise<CheckoutPricing> {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const code = typeof input.discountCode === "string" ? input.discountCode.trim() : "";
  const codeGiven = code !== "";

  /* ---------- authoritative load: products, sales, the code ---------- */
  const ids = [...new Set(lines.map((l) => String(l.productId)))];
  let products: Map<string, Product>;
  let sales: SaleRule[];
  let coupon: CouponRule | null = null;
  let emailHasUsedCoupon = false;
  try {
    const [found, liveSales, foundCoupon] = await Promise.all([
      ids.length > 0
        ? payload.find({
            collection: "products",
            where: { and: [{ available: { equals: true } }, { id: { in: ids } }] },
            limit: ids.length,
            /* Depth 0: occasions arrive as ids, which is what sale rules match on. */
            depth: 0,
            overrideAccess: false,
          })
        : Promise.resolve({ docs: [] as Product[] }),
      deps.loadSales(payload, now),
      codeGiven ? deps.findCoupon(payload, code) : Promise.resolve(null),
    ]);
    products = new Map(found.docs.map((doc) => [String(doc.id), doc]));
    sales = liveSales;
    coupon = foundCoupon;
    if (coupon?.oncePerCustomer && input.customerEmail) {
      emailHasUsedCoupon = await deps.emailHasRedeemed(payload, coupon.id, input.customerEmail);
    }
  } catch (error) {
    payload.logger.error(
      `checkout pricing could not load: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return { ok: false, failure: "catalogue", code: "ORDER_CREATION_FAILED" };
  }

  if (products.size !== ids.length) {
    return { ok: false, failure: "unavailable", code: "PRODUCT_UNAVAILABLE" };
  }

  /* ---------- server-side pricing ---------- */
  const discounts: OrderDiscounts = { sales, coupon, emailHasUsedCoupon, now };
  try {
    const priced = priceOrder(lines, products, input.deliveryEmirate, discounts);
    /* A code that does not exist is refused exactly like one that is
       switched off, so a stranger cannot learn which codes are real. */
    if (codeGiven && !coupon) priced.couponRefusal = { reason: "inactive" };
    return { ok: true, priced, products, codeGiven };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "INVALID_TOTAL";
    payload.logger.warn(`checkout pricing rejected: ${raw}`);
    const engine = engineCode(error);

    if (engine === "TOTAL_TOO_LOW" && coupon) {
      /* The code is what took it under the minimum: say so, and show the
         basket as it stands without the code. */
      try {
        const withoutCode = priceOrder(lines, products, input.deliveryEmirate, {
          ...discounts,
          coupon: null,
        });
        return { ok: false, failure: "total_too_low", code: engine, withoutCode };
      } catch {
        return { ok: false, failure: "total_too_low", code: engine };
      }
    }
    if (engine === "TOTAL_TOO_LOW") return { ok: false, failure: "total_too_low", code: engine };
    return { ok: false, failure: "rejected", code: engine };
  }
}
