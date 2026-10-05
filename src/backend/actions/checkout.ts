"use server";

import { headers as nextHeaders } from "next/headers";
import { after } from "next/server";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { priceCheckout } from "@backend/data/checkout-pricing";
import {
  couponRefusalCode,
  isGuessableRefusal,
  orderMoneyFields,
  toCheckoutQuote,
  type CheckoutQuote,
} from "@backend/domain/checkout-order";
import type { CheckoutLineRequest, PricedCouponRefusal, PricedOrder } from "@backend/domain/pricing";
import { LIMITS, clientAddress, peek, throttle, waitHint } from "@backend/security/throttle";
import { getDictionary } from "@/lib/i18n/server";
import { withWait } from "@/lib/i18n/wait";
import { formatFils } from "@/lib/money";
import {
  LOST_CLAIM_NOTE,
  abandonOrder,
  couponClaimRefusal,
  isLimited,
  releaseCouponClaims,
  sweepStaleDiscountOrders,
} from "@backend/payments/coupon-claims";
import { ensureOrderPaymentIntent } from "@backend/payments/intent";
import { cardPaymentsConfigured, getStripe } from "@backend/payments/stripe";

/**
 * Card checkout (Stripe — card, Apple Pay, Google Pay). Cash on delivery was
 * removed at the owner's instruction on 2026-10-03.
 *
 * THE TRUST BOUNDARY IS THIS FILE. Everything above it is untrusted: the
 * browser sends product ids, quantities, option ids and the TEXT of a
 * discount code, and nothing else that costs money. Prices, sale prices, the
 * code's value, the delivery fee and the total are computed here from the
 * rows the server loads (backend/data/checkout-pricing.ts →
 * backend/domain/pricing.ts). A payload claiming a 10 AED total for a
 * 950 AED bouquet changes nothing.
 *
 * `shownTotalFils` IS AN ASSERTION, NOT AN INPUT. The browser says "this is
 * the total I showed the customer". It is COMPARED with the server's total
 * and that is all: it is never used in arithmetic, never stored, never sent
 * to Stripe. If the two differ — a sale ended while the page was open, a
 * price was edited, the payload was tampered with — the answer is
 * PRICE_CHANGED and nothing is created. So the worst a forged value can do
 * is refuse the forger's own order; it can never change what is charged, and
 * a customer is never charged a total she did not see.
 *
 * A DISCOUNT CODE IS CHECKED TWICE, both times on the server: when the basket
 * is quoted (`quoteCheckout`) and again here when the order is placed. A code
 * the customer was shown is never silently dropped — if it no longer
 * applies, the order is refused and says why.
 *
 * WHY overrideAccess IS USED HERE, AND ONLY HERE. `orders.create` is
 * admin-only by design — there is deliberately no public create, because an
 * openly writable orders table is an open funnel into the business
 * (docs/DATABASE.md §8). Guest checkout therefore cannot run under the
 * caller's own permissions: a guest has none. This single server-side path is
 * the documented exception, and it is safe precisely because the customer
 * never supplies an amount. It is one function, it is greppable, and no other
 * action in this codebase does it.
 *
 * NOTHING HERE MARKS AN ORDER PAID. The order is created PENDING with a
 * Stripe PaymentIntent for exactly its server-computed total; the browser
 * then confirms the payment with Stripe directly (card data never touches
 * this server), and only the signed webhook moves the order to PAID, counts
 * the code as used and sends the emails (backend/payments/paid.ts,
 * docs/PAYMENTS.md §2).
 */

export type CheckoutRequest = {
  lines: CheckoutLineRequest[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryEmirate: string;
  deliveryAddress: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryNotes?: string;
  recipientName?: string;
  recipientPhone?: string;
  cardMessage?: string;
  /** The text of a discount code, as typed. Never an amount. */
  discountCode?: string;
  /** The total the customer was shown, in fils. Compared, never used. */
  shownTotalFils: number;
};

export type CheckoutResult =
  | { ok: true; orderNumber: string; clientSecret: string }
  | { ok: false; code: string; message: string };

export type QuoteRequest = {
  lines: CheckoutLineRequest[];
  deliveryEmirate: string;
  discountCode?: string;
};

export type QuoteFailureCode =
  | "CODE_INVALID"
  | "CODE_MIN_SPEND"
  | "CODE_ALREADY_USED"
  | "CODE_EXHAUSTED"
  | "RATE_LIMITED"
  | "TOTAL_TOO_LOW"
  | "PRICING_REJECTED";

export type QuoteResult =
  | { ok: true; quote: CheckoutQuote }
  | {
      ok: false;
      code: QuoteFailureCode;
      message: string;
      /** The same basket priced WITHOUT the code, when it could be priced. */
      quote?: CheckoutQuote;
    };

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A basket nobody fills by hand; anything longer is not a customer. */
const MAX_LINES = 50;

type CheckoutMessages = Awaited<ReturnType<typeof getDictionary>>["t"]["server"]["checkout"];

/** The sentence for a refused code, in the customer's language. */
function refusalMessage(
  messages: CheckoutMessages,
  refusal: PricedCouponRefusal,
  priced: PricedOrder,
): string {
  switch (refusal.reason) {
    case "min_spend": {
      const shortfall = refusal.shortfallFils ?? 0;
      return messages.codeMinSpend
        .replace("{amount}", formatFils(shortfall))
        .replace("{min}", formatFils(priced.subtotalFils + shortfall));
    }
    case "already_used":
      return messages.codeAlreadyUsed;
    case "exhausted":
      return messages.codeExhausted;
    default:
      return messages.codeInvalid;
  }
}

/**
 * A wrong code costs the caller one attempt; a right one costs nothing.
 * Never throws: the throttle store being down must not break a checkout.
 */
async function chargeWrongCode(address: string): Promise<void> {
  await throttle(LIMITS.discountCode, address).catch(() => undefined);
}

/**
 * What the basket costs right now — for the cart and the checkout summary.
 *
 * Creates nothing and reserves nothing. It takes NO EMAIL ADDRESS, on
 * purpose: a quote that could answer "this address has already used this
 * code" would let anyone holding a public welcome code test whether a
 * stranger is a customer. The once-per-customer rule is therefore applied
 * only when an order is actually placed.
 *
 * THE THROTTLE COUNTS WRONG CODES ONLY. A basket holding a good code
 * re-quotes on every quantity change; those calls are free, however many.
 * A code that does not exist (or is spent) costs one attempt, and a caller
 * out of attempts is told to wait — with the basket still priced, without
 * the code, so the page keeps working.
 */
export async function quoteCheckout(request: QuoteRequest): Promise<QuoteResult> {
  const { locale, t } = await getDictionary();
  const messages = t.server.checkout;

  const lines = Array.isArray(request?.lines) ? request.lines : [];
  if (lines.length === 0 || lines.length > MAX_LINES) {
    return { ok: false, code: "PRICING_REJECTED", message: messages.pricingRejected };
  }
  const emirate = String(request.deliveryEmirate ?? "");
  const code = typeof request.discountCode === "string" ? request.discountCode.trim() : "";

  const payload = await getPayload({ config });
  const now = new Date();
  const address = code ? await clientAddress() : "";

  /* Out of attempts: no code is looked at, right or wrong — otherwise the
     difference between "wait" and "applied" would itself be the oracle. */
  if (code) {
    const allowance = await peek(LIMITS.discountCode, address);
    if (!allowance.allowed) {
      const plain = await priceCheckout(payload, { lines, deliveryEmirate: emirate }, now);
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: withWait(locale, t, messages.codeRateLimited, waitHint(allowance.retryAfterSeconds)),
        ...(plain.ok ? { quote: toCheckoutQuote(plain.priced) } : {}),
      };
    }
  }

  const pricing = await priceCheckout(
    payload,
    { lines, deliveryEmirate: emirate, ...(code ? { discountCode: code } : {}) },
    now,
  );

  if (!pricing.ok) {
    if (pricing.failure === "total_too_low") {
      return {
        ok: false,
        code: "TOTAL_TOO_LOW",
        message: messages.totalTooLow,
        ...(pricing.withoutCode ? { quote: toCheckoutQuote(pricing.withoutCode) } : {}),
      };
    }
    return {
      ok: false,
      code: "PRICING_REJECTED",
      message:
        pricing.failure === "catalogue"
          ? messages.catalogueUnreachable
          : pricing.failure === "unavailable"
            ? messages.productUnavailable
            : messages.pricingRejected,
    };
  }

  const { priced } = pricing;
  if (priced.couponRefusal) {
    if (isGuessableRefusal(priced.couponRefusal.reason)) await chargeWrongCode(address);
    return {
      ok: false,
      code: couponRefusalCode(priced.couponRefusal.reason),
      message: refusalMessage(messages, priced.couponRefusal, priced),
      /* Priced without the code: a refused code takes nothing off. */
      quote: toCheckoutQuote(priced),
    };
  }

  return { ok: true, quote: toCheckoutQuote(priced) };
}

/** After the response: tidy up unpaid discounted orders that went stale. */
function sweepLater(payload: Payload, stripe: NonNullable<ReturnType<typeof getStripe>>): void {
  try {
    after(async () => {
      try {
        await sweepStaleDiscountOrders(payload, stripe, new Date());
      } catch (error) {
        payload.logger.error(
          `stale discount sweep failed: ${error instanceof Error ? error.message : "unknown"}`,
        );
      }
    });
  } catch {
    /* No request scope to defer into; the next checkout will sweep. */
  }
}

export async function startCardCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  /*
   * The language the order was placed in.
   *
   * Every refusal below used to be an English sentence written at the point
   * of failure, so a customer who filled in an Arabic checkout was turned
   * away in English. The dictionary is read once, here, and `fail` names a
   * key in it.
   */
  const { locale, t } = await getDictionary();
  const messages = t.server.checkout;
  const fail = (code: string, key: keyof typeof messages): CheckoutResult => ({
    ok: false,
    code,
    message: messages[key],
  });
  /* Without both Stripe keys there is nothing to pay with: say so before
     anything is created. */
  const stripe = getStripe();
  if (!stripe || !cardPaymentsConfigured()) {
    return fail("PAYMENT_UNAVAILABLE", "paymentUnavailable");
  }

  /*
   * An unpaid order is still a row the florist sees, so an unlimited create
   * is a script that fills her morning with orders nobody will pay for.
   *
   * Eight an hour from one network is far above any real household and far
   * below what abuse needs to be worth doing. It is checked first, before
   * any product is loaded or priced. It is also what bounds code-guessing
   * through this path, which is why the discount-code bucket is not asked
   * here: an honest customer with a good code must never be stopped from
   * paying by somebody else's guesses.
   */
  const address = await clientAddress();
  const orders = await throttle(LIMITS.checkout, address);
  if (!orders.allowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: withWait(
        locale,
        t,
        messages.rateLimited,
        waitHint(orders.retryAfterSeconds),
      ),
    };
  }

  const payload = await getPayload({ config });

  /* ---------- shape and identity validation ---------- */
  if (!Array.isArray(request.lines) || request.lines.length === 0) {
    return fail("INVALID_ORDER", "basketEmpty");
  }
  if (request.lines.length > MAX_LINES) {
    return fail("INVALID_ORDER", "pricingRejected");
  }
  if (!request.customerName?.trim()) {
    return fail("INVALID_CUSTOMER", "nameRequired");
  }
  if (!EMAIL.test(request.customerEmail ?? "")) {
    return fail("INVALID_CUSTOMER", "emailInvalid");
  }
  if (!E164.test(request.customerPhone ?? "")) {
    return fail("INVALID_CUSTOMER", "phoneFormat");
  }
  if (!request.deliveryAddress?.trim()) {
    return fail("INVALID_DELIVERY", "addressRequired");
  }
  if (!request.deliveryTimeSlot?.trim()) {
    return fail("INVALID_DELIVERY", "slotRequired");
  }
  if (request.recipientPhone && !E164.test(request.recipientPhone)) {
    return fail("INVALID_DELIVERY", "recipientPhoneInvalid");
  }

  const deliveryDate = new Date(request.deliveryDate);
  if (Number.isNaN(deliveryDate.getTime())) {
    return fail("INVALID_DELIVERY", "dateRequired");
  }
  /* Yesterday is never deliverable. One day of slack absorbs timezone drift
     between the customer's browser and the server. */
  if (deliveryDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return fail("INVALID_DELIVERY", "datePassed");
  }

  const customerEmail = request.customerEmail.trim().toLowerCase();
  const discountCode =
    typeof request.discountCode === "string" ? request.discountCode.trim() : "";
  const now = new Date();

  /* ---------- authoritative load and server-side pricing ----------
     Products, live sales and the code are loaded and priced in one place,
     the same place the basket's quote uses. */
  const pricing = await priceCheckout(
    payload,
    {
      lines: request.lines,
      deliveryEmirate: request.deliveryEmirate,
      ...(discountCode ? { discountCode } : {}),
      customerEmail,
    },
    now,
  );

  if (!pricing.ok) {
    switch (pricing.failure) {
      case "catalogue":
        return fail("ORDER_CREATION_FAILED", "catalogueUnreachable");
      case "unavailable":
        return fail("PRODUCT_UNAVAILABLE", "productUnavailable");
      case "total_too_low":
        return fail("TOTAL_TOO_LOW", "totalTooLow");
      default:
        return fail(pricing.code || "INVALID_TOTAL", "pricingRejected");
    }
  }
  const { priced } = pricing;

  /* ---------- the code the customer was shown ----------
     Never silently dropped: if it does not apply now, the order is refused
     and says why, exactly as the quote would. */
  const refuseCode = (refusal: PricedCouponRefusal): CheckoutResult => ({
    ok: false,
    code: couponRefusalCode(refusal.reason),
    message: refusalMessage(messages, refusal, priced),
  });
  if (pricing.codeGiven && priced.couponRefusal) {
    if (isGuessableRefusal(priced.couponRefusal.reason)) await chargeWrongCode(address);
    return refuseCode(priced.couponRefusal);
  }

  /* ---------- the total the customer was shown ----------
     An assertion (see the top of this file). Compared; never used. */
  if (
    !Number.isSafeInteger(request.shownTotalFils) ||
    request.shownTotalFils !== priced.totalFils
  ) {
    return fail("PRICE_CHANGED", "priceChanged");
  }

  /* ---------- a limited code must be claimable ----------
     A usage limit or once-per-customer is enforced by counting the orders
     that still hold a claim (backend/payments/coupon-claims.ts). First look,
     before anything is created. */
  const coupon = priced.couponDiscountFils > 0 ? priced.coupon : null;
  const limited = coupon !== null && isLimited(coupon);
  if (coupon && limited) {
    try {
      await releaseCouponClaims(payload, stripe, coupon, customerEmail, now);
      const refusal = await couponClaimRefusal(payload, coupon, customerEmail);
      if (refusal) return refuseCode({ reason: refusal });
    } catch (error) {
      payload.logger.error(
        `code ${coupon.code}: claims could not be checked: ${error instanceof Error ? error.message : "unknown"}`,
      );
      return fail("ORDER_CREATION_FAILED", "creationFailed");
    }
  }

  /* ---------- link to a signed-in customer, if there is one ---------- */
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const isCustomer = user && (user as { role?: string }).role === "customer";
  const customerId = isCustomer ? (user as { id: number }).id : undefined;

  /* ---------- create ---------- */
  try {
    const order = await payload.create({
      collection: "orders",
      /* See the note at the top of this file: the single documented
         server-side exception, with every amount computed above. */
      overrideAccess: true,
      data: {
        customerType: customerId ? "registered" : "guest",
        ...(customerId ? { customer: customerId } : {}),
        customerName: request.customerName.trim(),
        customerEmail,
        customerPhone: request.customerPhone.trim(),

        deliveryAddress: request.deliveryAddress.trim(),
        deliveryEmirate: request.deliveryEmirate,
        deliveryDate: deliveryDate.toISOString(),
        deliveryTimeSlot: request.deliveryTimeSlot.trim(),
        ...(request.deliveryNotes?.trim()
          ? { deliveryNotes: request.deliveryNotes.trim() }
          : {}),

        ...(request.recipientName?.trim()
          ? { recipientName: request.recipientName.trim() }
          : {}),
        ...(request.recipientPhone?.trim()
          ? { recipientPhone: request.recipientPhone.trim() }
          : {}),
        ...(request.cardMessage?.trim()
          ? { cardMessage: request.cardMessage.trim() }
          : {}),

        /* Lines, totals, and the discount snapshot: the sale price with the
           regular price beside it, the code and what it took off, and the
           terms both were sold under (backend/domain/checkout-order.ts). */
        ...orderMoneyFields(priced),
        currency: "AED",

        /* Not paid until Stripe's signed webhook says so. */
        paymentStatus: "PENDING",
        fulfilmentStatus: "NEW",
        source: "web-checkout-card",
        /* The language the order was placed in, so anything written to this
           customer later can be written in it. */
        locale,
      } as never,
    });

    /* ---------- second look, now that this order holds a claim ----------
       Everybody ELSE's claims are counted again. If the limit is already met
       without this order, it lost the race for the last use: it is cancelled
       before any PaymentIntent exists, so nothing can be charged for it. */
    if (coupon && limited) {
      const refusal = await couponClaimRefusal(payload, coupon, customerEmail, Number(order.id));
      if (refusal) {
        await abandonOrder(payload, Number(order.id), LOST_CLAIM_NOTE);
        return refuseCode({ reason: refusal });
      }
    }

    /* ---------- the payment, for exactly the server total ----------
     * AED is a two-decimal currency, so Stripe's amount IS our fils. The
     * idempotency key is the order: a retried request reuses the intent
     * instead of creating a second charge. `automatic_payment_methods`
     * lets Stripe offer card, Apple Pay and Google Pay.
     *
     * The intent is created from the ORDER — `order.totalFils`, which is the
     * discounted total priced above — and its id is written onto the order
     * BEFORE the client secret leaves this function
     * (backend/payments/intent.ts). The webhook then marks the order paid
     * only for that intent, so a payment can never be applied to the wrong
     * order or counted twice. The code travels in the intent's metadata as
     * text; no amount does. */
    const intent = await ensureOrderPaymentIntent(payload, stripe, order);
    if (intent.kind !== "ready") {
      throw new Error(
        intent.kind === "failed" ? intent.reason : `PaymentIntent for a new order is ${intent.kind}`,
      );
    }

    /* A claim on a limited code can be released by the same customer
       starting again in another tab. That release marks the order CANCELLED
       and then cancels whatever intent it finds; this re-read is the other
       half, so an intent created in between is never left payable. */
    if (coupon && limited) {
      const fresh = await payload.findByID({
        collection: "orders",
        id: order.id,
        depth: 0,
        overrideAccess: true,
      });
      if (fresh.fulfilmentStatus === "CANCELLED") {
        await stripe.paymentIntents.cancel(intent.intentId).catch(() => undefined);
        return fail("ORDER_CREATION_FAILED", "creationFailed");
      }
    }

    sweepLater(payload, stripe);

    return { ok: true, orderNumber: String(order.orderNumber), clientSecret: intent.clientSecret };
  } catch (error) {
    payload.logger.error(
      `order creation failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return fail("ORDER_CREATION_FAILED", "creationFailed");
  }
}
