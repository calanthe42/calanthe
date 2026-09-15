"use server";

import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Product } from "@/payload-types";
import { priceOrder, type CheckoutLineRequest } from "@backend/domain/pricing";

/**
 * Cash on delivery checkout.
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
 * COD IS NOT PAID. The order is created with paymentStatus PENDING and stays
 * there. Money state moves only through a payment provider's webhook
 * (guardPaymentStatus), and cash handed over at the door is reconciled by a
 * human afterwards. Nothing here marks an order paid.
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
  | { ok: true; orderNumber: string }
  | { ok: false; code: string; message: string };

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function fail(code: string, message: string): CheckoutResult {
  return { ok: false, code, message };
}

export async function placeCodOrder(request: CheckoutRequest): Promise<CheckoutResult> {
  const payload = await getPayload({ config });

  /* ---------- shape and identity validation ---------- */
  if (!Array.isArray(request.lines) || request.lines.length === 0) {
    return fail("INVALID_ORDER", "Your basket is empty.");
  }
  if (!request.customerName?.trim()) {
    return fail("INVALID_CUSTOMER", "Please tell us your name.");
  }
  if (!EMAIL.test(request.customerEmail ?? "")) {
    return fail("INVALID_CUSTOMER", "That email address does not look right.");
  }
  if (!E164.test(request.customerPhone ?? "")) {
    return fail(
      "INVALID_CUSTOMER",
      "Enter your phone in international format, e.g. +971501234567.",
    );
  }
  if (!request.deliveryAddress?.trim()) {
    return fail("INVALID_DELIVERY", "Please give us a delivery address.");
  }
  if (!request.deliveryTimeSlot?.trim()) {
    return fail("INVALID_DELIVERY", "Please choose a delivery time.");
  }
  if (request.recipientPhone && !E164.test(request.recipientPhone)) {
    return fail("INVALID_DELIVERY", "The recipient's phone number does not look right.");
  }

  const deliveryDate = new Date(request.deliveryDate);
  if (Number.isNaN(deliveryDate.getTime())) {
    return fail("INVALID_DELIVERY", "Please choose a delivery date.");
  }
  /* Yesterday is never deliverable. One day of slack absorbs timezone drift
     between the customer's browser and the server. */
  if (deliveryDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return fail("INVALID_DELIVERY", "That delivery date has already passed.");
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
    return fail("ORDER_CREATION_FAILED", "We could not reach the catalogue. Please try again.");
  }

  if (products.size !== ids.length) {
    return fail(
      "PRODUCT_UNAVAILABLE",
      "One of the arrangements in your basket is no longer available. Please review your basket.",
    );
  }

  /* ---------- server-side pricing ---------- */
  let priced;
  try {
    priced = priceOrder(request.lines, products, request.deliveryEmirate);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "INVALID_TOTAL";
    const [code] = raw.split(":");
    payload.logger.warn(`checkout pricing rejected: ${raw}`);
    return fail(
      code || "INVALID_TOTAL",
      "We could not price that basket. Please review your items and try again.",
    );
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
        ...(request.cardMessage?.trim() ? { cardMessage: request.cardMessage.trim() } : {}),

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

        /* Cash on delivery: nothing has been paid. The order is real, the
           money is not yet collected, and only a provider webhook may ever
           move this field. */
        paymentStatus: "PENDING",
        fulfilmentStatus: "NEW",
        source: "web-checkout-cod",
      } as never,
    });

    return { ok: true, orderNumber: String(order.orderNumber) };
  } catch (error) {
    payload.logger.error(
      `order creation failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return fail(
      "ORDER_CREATION_FAILED",
      "We could not place your order. Nothing has been charged — please try again.",
    );
  }
}
