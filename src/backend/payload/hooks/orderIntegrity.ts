import { APIError } from "payload";
import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook } from "payload";

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
  if (discount > subtotal + delivery) {
    throw new APIError("A discount cannot exceed the order value.", 400);
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
