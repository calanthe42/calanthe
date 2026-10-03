"use server";

import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Product } from "@/payload-types";
import { priceOrder, type CheckoutLineRequest } from "@backend/domain/pricing";
import { LIMITS, clientAddress, throttle, waitHint } from "@backend/security/throttle";
import { getDictionary } from "@/lib/i18n/server";
import { withWait } from "@/lib/i18n/wait";
import { cardPaymentsConfigured, getStripe } from "@backend/payments/stripe";

/**
 * Card checkout (Stripe — card, Apple Pay, Google Pay). Cash on delivery was
 * removed at the owner's instruction on 2026-10-03.
 *
 * THE TRUST BOUNDARY IS THIS FUNCTION. Everything above it is untrusted: the
 * browser sends product ids, quantities and option ids, and nothing else that
 * costs money. Prices, the delivery fee and the total are computed here from
 * the product records the server loads (backend/domain/pricing.ts). A payload
 * claiming a 10 AED total for a 950 AED bouquet changes nothing.
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
 * this server), and only the signed webhook moves the order to PAID and
 * sends its emails (backend/payments/paid.ts, docs/PAYMENTS.md §2).
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
};

export type CheckoutResult =
  | { ok: true; orderNumber: string; clientSecret: string }
  | { ok: false; code: string; message: string };

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
   * any product is loaded or priced.
   */
  const orders = await throttle(LIMITS.checkout, await clientAddress());
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

  /* ---------- authoritative product load ---------- */
  const ids = [...new Set(request.lines.map((l) => l.productId))];
  let products: Map<string, Product>;
  try {
    const found = await payload.find({
      collection: "products",
      where: { and: [{ available: { equals: true } }, { id: { in: ids } }] },
      limit: ids.length,
      depth: 0,
      overrideAccess: false,
    });
    products = new Map(found.docs.map((doc) => [String(doc.id), doc]));
  } catch {
    return fail("ORDER_CREATION_FAILED", "catalogueUnreachable");
  }

  if (products.size !== ids.length) {
    return fail("PRODUCT_UNAVAILABLE", "productUnavailable");
  }

  /* ---------- server-side pricing ---------- */
  let priced;
  try {
    priced = priceOrder(request.lines, products, request.deliveryEmirate);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "INVALID_TOTAL";
    const [code] = raw.split(":");
    payload.logger.warn(`checkout pricing rejected: ${raw}`);
    return fail(code || "INVALID_TOTAL", "pricingRejected");
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
        customerEmail: request.customerEmail.trim().toLowerCase(),
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

        items: priced.lines.map((line) => ({
          product: Number(line.product.id),
          productName: line.productName,
          productSlug: line.productSlug,
          quantity: line.quantity,
          unitPriceFils: line.unitPriceFils,
          lineTotalFils: line.lineTotalFils,
          selectedOptions: line.selectedOptions,
        })),

        subtotalFils: priced.subtotalFils,
        deliveryFeeFils: priced.deliveryFeeFils,
        discountFils: priced.discountFils,
        totalFils: priced.totalFils,
        currency: "AED",

        /* Not paid until Stripe's signed webhook says so. */
        paymentStatus: "PENDING",
        fulfilmentStatus: "NEW",
        source: "web-checkout-card",
      } as never,
    });

    /* ---------- the payment, for exactly the server total ----------
     * AED is a two-decimal currency, so Stripe's amount IS our fils. The
     * idempotency key is the order: a retried request reuses the intent
     * instead of creating a second charge. `automatic_payment_methods`
     * lets Stripe offer card, Apple Pay and Google Pay. */
    const intent = await stripe.paymentIntents.create(
      {
        amount: priced.totalFils,
        currency: "aed",
        automatic_payment_methods: { enabled: true },
        receipt_email: request.customerEmail.trim().toLowerCase(),
        description: `Calanthe order ${order.orderNumber}`,
        metadata: { kind: "order", orderId: String(order.id), orderNumber: String(order.orderNumber) },
      },
      { idempotencyKey: `order-${order.id}` },
    );
    if (!intent.client_secret) throw new Error("PaymentIntent has no client secret");

    return { ok: true, orderNumber: String(order.orderNumber), clientSecret: intent.client_secret };
  } catch (error) {
    payload.logger.error(
      `order creation failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return fail("ORDER_CREATION_FAILED", "creationFailed");
  }
}
