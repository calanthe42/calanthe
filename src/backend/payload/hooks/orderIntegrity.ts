import { APIError } from "payload";
import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook } from "payload";
import {
  BESPOKE_SLUG,
  CUSTOM_SLUG,
  MANUAL_SOURCE,
  OUTSIDE_PAYMENT_METHODS,
  QUOTE_MIN_FILS,
  QUOTE_SOURCE,
  isPayLinkSource,
  isSettled,
} from "@backend/payments/pay-link";

/**
 * Server-side integrity rules for orders.
 *
 * Field-level access already makes the snapshot unwritable after creation.
 * These hooks guard the two things access control cannot express: that the
 * numbers add up at the moment they are written, and that money state is
 * never moved by a human.
 */

/** Context flag a payment webhook sets to legitimately move money state. */
export const PAYMENT_PROVIDER_CONTEXT = "paymentProviderWrite";

/**
 * Context flag cancelPaymentRequest sets for ONE write: putting a request
 * back the way it was when Stripe refused to cancel its PaymentIntent because
 * the customer was already paying. Context is server-side only — no REST or
 * GraphQL request can set it.
 */
export const QUOTE_CANCEL_REVERT_CONTEXT = "quoteCancelRevert";

/**
 * Context flag the OWNER's "record payment" action sets for one write:
 * marking an order that was written by hand in the admin as paid outside the
 * website (cash, bank transfer, card machine).
 *
 * Narrower than the provider's flag on purpose. It moves an order to PAID
 * only — never to refunded, never back — only when the order's source is
 * "admin-manual", only when no money has arrived yet, and only together with
 * the method it was paid by. A website order or a payment request can still
 * be paid by Stripe's signed webhook and by nothing else.
 */
export const MANUAL_PAYMENT_CONTEXT = "manualPaymentWrite";

/**
 * Nobody marks an order paid by clicking.
 *
 * docs/ADMIN.md §3: "No button marks an order paid. Money state comes from
 * the webhook only. There is nothing to click." `paymentStatus` is already
 * `update: () => false` at field level, so an admin-panel or REST attempt is
 * stripped before it reaches here. This hook covers the remaining path —
 * server code calling with `overrideAccess: true`, which bypasses field
 * access — so that only a caller that explicitly identifies itself as the
 * payment provider may move it.
 *
 * The effect: when Stripe/Tabby land, the webhook handler passes
 * `context: { [PAYMENT_PROVIDER_CONTEXT]: true }` and everything else in the
 * codebase is locked out by default rather than by convention.
 */
export const guardPaymentStatus: CollectionBeforeChangeHook = ({
  context,
  data,
  operation,
  originalDoc,
}) => {
  if (operation !== "update") return data;
  if (data?.paymentStatus === undefined) return data;
  if (data.paymentStatus === originalDoc?.paymentStatus) return data;
  if (context?.[PAYMENT_PROVIDER_CONTEXT] === true) return data;

  if (
    context?.[MANUAL_PAYMENT_CONTEXT] === true &&
    originalDoc?.source === MANUAL_SOURCE &&
    data.paymentStatus === "PAID" &&
    !isSettled(originalDoc?.paymentStatus) &&
    (OUTSIDE_PAYMENT_METHODS as readonly string[]).includes(String(data.paymentMethod ?? ""))
  ) {
    return data;
  }

  throw new APIError(
    "Payment status is set by the payment provider, never by hand. " +
      `Attempted change: ${originalDoc?.paymentStatus} → ${data.paymentStatus}.`,
    403,
  );
};

/**
 * The totals must reconcile at write time, or the order is corrupt.
 *
 * An order whose stored total disagrees with its own line items is worse
 * than a crash: it is a receipt that cannot be defended, and it is found
 * months later by an accountant rather than by a test. Everything is integer
 * fils, so this is exact arithmetic with no tolerance band.
 *
 *   lineTotalFils = unitPriceFils × quantity        (per item)
 *   subtotalFils  = Σ lineTotalFils
 *   totalFils     = subtotalFils + deliveryFeeFils − discountFils
 *
 * DISCOUNTS DO NOT CHANGE THE EQUATION. A sale is already inside
 * `unitPriceFils`; the regular price sits beside it and must be HIGHER, or
 * the receipt would strike through a price that was never charged. A code is
 * the order-level `discountFils` — and the only thing it may be: the two
 * figures must be equal, so no unexplained reduction can ever be written,
 * and an amount off always names the code that earned it.
 */
export const validateOrderTotals: CollectionBeforeValidateHook = ({ data, operation }) => {
  if (!data) return data;
  /* Only creation writes these; updates cannot change them (field access),
     so re-checking a partial update would compare against absent values. */
  if (operation !== "create") return data;

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    throw new APIError("An order must contain at least one item.", 400);
  }

  let computedSubtotal = 0;

  for (const [index, item] of items.entries()) {
    const unit = Number(item?.unitPriceFils);
    const qty = Number(item?.quantity);
    const line = Number(item?.lineTotalFils);
    const position = `Item ${index + 1} (${item?.productName ?? "unnamed"})`;

    if (!Number.isInteger(unit) || unit < 0) {
      throw new APIError(`${position}: unit price must be whole fils, zero or more.`, 400);
    }
    if (!Number.isInteger(qty) || qty < 1) {
      throw new APIError(`${position}: quantity must be at least 1.`, 400);
    }
    if (!Number.isInteger(line) || line !== unit * qty) {
      throw new APIError(
        `${position}: line total ${line} does not equal ${unit} × ${qty} = ${unit * qty}.`,
        400,
      );
    }
    const compareAt = item?.compareAtUnitPriceFils;
    if (compareAt !== null && compareAt !== undefined) {
      if (!Number.isInteger(Number(compareAt)) || Number(compareAt) <= unit) {
        throw new APIError(
          `${position}: the regular price must be whole fils and higher than the price paid.`,
          400,
        );
      }
    }
    computedSubtotal += line;
  }

  const subtotal = Number(data.subtotalFils);
  const delivery = Number(data.deliveryFeeFils ?? 0);
  const discount = Number(data.discountFils ?? 0);
  const total = Number(data.totalFils);

  if (subtotal !== computedSubtotal) {
    throw new APIError(
      `Subtotal ${subtotal} does not equal the sum of line totals ${computedSubtotal}.`,
      400,
    );
  }
  if (!Number.isInteger(discount) || discount < 0) {
    throw new APIError("A discount must be whole fils, zero or more.", 400);
  }
  if (discount > subtotal + delivery) {
    throw new APIError("A discount cannot exceed the order value.", 400);
  }

  const coupon = Number(data.couponDiscountFils ?? 0);
  const couponCode = typeof data.couponCode === "string" ? data.couponCode.trim() : "";
  if (!Number.isInteger(coupon) || coupon < 0) {
    throw new APIError("A code discount must be whole fils, zero or more.", 400);
  }
  if (coupon !== discount) {
    throw new APIError(
      `Discount ${discount} does not equal the code discount ${coupon}: an order-level discount must come from a code.`,
      400,
    );
  }
  /* Delivery is never discounted. */
  if (coupon > subtotal) {
    throw new APIError("A code discount cannot exceed the subtotal.", 400);
  }
  if (coupon > 0 && couponCode === "") {
    throw new APIError("A code discount must name its code.", 400);
  }
  if (couponCode !== "" && coupon === 0) {
    throw new APIError("A discount code that took nothing off must not be recorded.", 400);
  }

  const computedTotal = subtotal + delivery - discount;
  if (total !== computedTotal) {
    throw new APIError(
      `Total ${total} does not equal subtotal ${subtotal} + delivery ${delivery} − discount ${discount} = ${computedTotal}.`,
      400,
    );
  }
  if (total < 0) {
    throw new APIError("An order total cannot be negative.", 400);
  }

  return data;
};

/**
 * A guest order has no user; a registered order must have one.
 *
 * Without this the two states blur, and "which orders belong to this
 * customer?" stops having a reliable answer — which is exactly the question
 * order history, refunds and data-deletion requests all depend on.
 */
export const validateCustomerType: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (!data) return data;
  const merged = operation === "create" ? data : { ...originalDoc, ...data };

  if (merged.customerType === "registered" && !merged.customer) {
    throw new APIError(
      "A registered order must be linked to a customer account. Use 'guest' if there is none.",
      400,
    );
  }
  if (merged.customerType === "guest" && merged.customer) {
    throw new APIError(
      "A guest order must not be linked to a customer account. Set the type to 'registered'.",
      400,
    );
  }
  return data;
};

/** A relationship value as an id, whichever shape it arrived in. */
function hasRelation(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "object") return (value as { id?: unknown }).id != null;
  return true;
}

/**
 * A bespoke line exists only on a payment request, and nowhere else.
 *
 * `items.product` has always been optional, so that an order survives its
 * product being removed from the catalogue. That left a door open: an order
 * with a product-less line, at any price, from any path. This closes it in
 * both directions.
 *
 *   source "admin-quote"  →  linked to its enquiry; exactly one line, of one
 *                            unit, with no product and the bespoke slug; no
 *                            delivery fee, no discount, no code; at least the
 *                            minimum charge.
 *   anything else         →  every line has a product and none uses the
 *                            bespoke slug; no enquiry.
 *
 * The amount on a payment request is whatever the florist typed, so a
 * discount can never be allowed to land on one: the price is already the
 * price. That is why the zero-discount rule lives here, in the collection,
 * rather than only in the action that builds the order. It covers every
 * trace a discount can leave: an amount, a code, the link to the discount,
 * the snapshot of its terms, and a sale on the line.
 */
export const validateBespokeLines: CollectionBeforeValidateHook = ({ data, operation }) => {
  if (!data) return data;
  /* Same reason as validateOrderTotals: only creation writes these. */
  if (operation !== "create") return data;

  const items: Record<string, unknown>[] = Array.isArray(data.items) ? data.items : [];

  if (data.source === QUOTE_SOURCE) {
    if (!hasRelation(data.enquiry)) {
      throw new APIError("A payment request must be linked to the enquiry it confirms.", 400);
    }
    if (items.length !== 1) {
      throw new APIError("A payment request has exactly one line.", 400);
    }
    const [line] = items;
    if (hasRelation(line?.product) || line?.productSlug !== BESPOKE_SLUG) {
      throw new APIError("A payment request line is a bespoke arrangement, not a catalogue product.", 400);
    }
    if (Number(line?.quantity) !== 1) {
      throw new APIError("A payment request line has a quantity of one.", 400);
    }
    if (Number(data.deliveryFeeFils ?? 0) !== 0) {
      throw new APIError("A payment request carries no separate delivery fee.", 400);
    }
    if (
      Number(data.discountFils ?? 0) !== 0 ||
      Number(data.couponDiscountFils ?? 0) !== 0 ||
      (typeof data.couponCode === "string" && data.couponCode.trim() !== "") ||
      hasRelation(data.couponDiscount) ||
      (data.discountSnapshot !== null && data.discountSnapshot !== undefined) ||
      hasRelation(line?.sale) ||
      (line?.compareAtUnitPriceFils !== null && line?.compareAtUnitPriceFils !== undefined) ||
      Boolean(line?.saleLabelEn) ||
      Boolean(line?.saleLabelAr)
    ) {
      throw new APIError("A discount cannot be applied to a payment request.", 400);
    }
    if (!Number.isInteger(Number(data.totalFils)) || Number(data.totalFils) < QUOTE_MIN_FILS) {
      throw new APIError("A payment request must be for at least AED 2.", 400);
    }
    return data;
  }

  if (hasRelation(data.enquiry)) {
    throw new APIError("Only a payment request can be linked to an enquiry.", 400);
  }

  /* An order written by hand in the admin: catalogue lines and typed lines
     may sit side by side, each at the price the shop typed. Like a payment
     request it carries no delivery fee and no discount of any kind — the
     price typed is the price — and it must be worth charging. */
  if (data.source === MANUAL_SOURCE) {
    if (items.length > 40) {
      throw new APIError("An order can have at most 40 lines.", 400);
    }
    for (const [index, item] of items.entries()) {
      const position = `Item ${index + 1} (${item?.productName ?? "unnamed"})`;
      const custom = item?.productSlug === CUSTOM_SLUG;
      if (custom === hasRelation(item?.product)) {
        throw new APIError(`${position}: a line is either a catalogue product or a typed item.`, 400);
      }
      if (item?.productSlug === BESPOKE_SLUG) {
        throw new APIError(`${position}: the bespoke line is reserved for payment requests.`, 400);
      }
      if (
        hasRelation(item?.sale) ||
        (item?.compareAtUnitPriceFils !== null && item?.compareAtUnitPriceFils !== undefined) ||
        Boolean(item?.saleLabelEn) ||
        Boolean(item?.saleLabelAr)
      ) {
        throw new APIError(`${position}: a sale cannot be applied to an order written by hand.`, 400);
      }
    }
    if (Number(data.deliveryFeeFils ?? 0) !== 0) {
      throw new APIError("An order written by hand carries no separate delivery fee.", 400);
    }
    if (
      Number(data.discountFils ?? 0) !== 0 ||
      Number(data.couponDiscountFils ?? 0) !== 0 ||
      (typeof data.couponCode === "string" && data.couponCode.trim() !== "") ||
      hasRelation(data.couponDiscount) ||
      (data.discountSnapshot !== null && data.discountSnapshot !== undefined)
    ) {
      throw new APIError("A discount code cannot be applied to an order written by hand.", 400);
    }
    if (!Number.isInteger(Number(data.totalFils)) || Number(data.totalFils) < QUOTE_MIN_FILS) {
      throw new APIError("An order must be for at least AED 2.", 400);
    }
    if (data.paymentStatus !== undefined && data.paymentStatus !== "PENDING") {
      throw new APIError("An order written by hand starts unpaid; payment is recorded afterwards.", 400);
    }
    return data;
  }
  for (const [index, item] of items.entries()) {
    const position = `Item ${index + 1} (${item?.productName ?? "unnamed"})`;
    if (!hasRelation(item?.product)) {
      throw new APIError(`${position}: an order line must name its product.`, 400);
    }
    if (item?.productSlug === BESPOKE_SLUG) {
      throw new APIError(`${position}: the bespoke line is reserved for payment requests.`, 400);
    }
    if (item?.productSlug === CUSTOM_SLUG) {
      throw new APIError(`${position}: a typed item is reserved for orders written in the admin.`, 400);
    }
  }
  return data;
};

/**
 * An invoice number is issued once and never changes.
 *
 * Field access already makes it unwritable through the API. This covers the
 * remaining path — server code with `overrideAccess: true` — so that a
 * future bug cannot renumber an invoice a customer already holds. Setting it
 * the first time is allowed; that is what claimInvoice does.
 */
export const guardInvoiceNumber: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation !== "update") return data;
  if (data?.invoiceNumber === undefined) return data;
  if (!originalDoc?.invoiceNumber) return data;
  if (data.invoiceNumber === originalDoc.invoiceNumber) return data;

  throw new APIError("An invoice number cannot be changed once issued.", 403);
};

/**
 * An unpaid payment request cannot be worked on, and cannot be revived.
 *
 * The admin's order screen already refuses to advance one. But `update` on
 * this collection is open to staff, so a REST PATCH or an edit in /cms would
 * walk straight past a rule that lived only in a server action — and moving
 * an unpaid request to CONFIRMED tells the customer "your order is
 * confirmed" for flowers nobody has paid for.
 *
 *   unpaid  →  CANCELLED            allowed (that is "cancel request")
 *   unpaid  →  anything else        refused
 *   CANCELLED, unpaid  →  anything  refused: un-cancelling would bring a dead
 *                                   pay link back to life
 *
 * The webhook's own write is exempt because it makes the order PAID in the
 * same breath, and so is the one revert described at
 * QUOTE_CANCEL_REVERT_CONTEXT.
 */
export const guardUnpaidQuoteFulfilment: CollectionBeforeChangeHook = ({
  context,
  data,
  operation,
  originalDoc,
}) => {
  if (operation !== "update") return data;
  if (!isPayLinkSource(originalDoc?.source)) return data;
  if (data?.fulfilmentStatus === undefined) return data;
  if (data.fulfilmentStatus === originalDoc.fulfilmentStatus) return data;

  const paidAfter = isSettled(data.paymentStatus ?? originalDoc.paymentStatus);
  if (paidAfter) return data;
  if (context?.[QUOTE_CANCEL_REVERT_CONTEXT] === true) return data;

  if (originalDoc.fulfilmentStatus === "CANCELLED") {
    throw new APIError(
      "A cancelled payment request cannot be reopened. Confirm the enquiry again to send a new one.",
      400,
    );
  }
  if (data.fulfilmentStatus !== "CANCELLED") {
    throw new APIError("This order is waiting for payment and cannot be moved yet.", 400);
  }
  return data;
};
