import { APIError } from "payload";
import type { CollectionBeforeValidateHook } from "payload";

/**
 * Cross-field rules that no single field validator can express.
 *
 * Payload validates fields in isolation, so "compareAtPrice must exceed
 * price" and "an available product must have stock" have to be checked
 * once the whole document is assembled. These are the states that would
 * otherwise reach the storefront and mislead a customer:
 *
 *   - A strike-through price at or below the real price reads as a fake
 *     discount. In the UAE that is a consumer-protection exposure, not
 *     merely untidy data.
 *   - A product marked available with zero tracked stock takes an order
 *     that cannot be fulfilled — the customer pays and then gets an
 *     apology.
 */
export const validateProductState: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data;

  /* Partial updates only carry changed fields; fall back to the stored
     document so a single-field edit is judged against the real state. */
  const merged = { ...originalDoc, ...data };

  const price = merged.priceFils;
  const compareAt = merged.compareAtPriceFils;

  if (
    typeof compareAt === "number" &&
    compareAt > 0 &&
    typeof price === "number" &&
    compareAt <= price
  ) {
    throw new APIError(
      "The compare-at price must be higher than the price — it is the crossed-out " +
        "'was' figure. Leave it empty if the product is not on offer.",
      400,
    );
  }

  if (merged.trackStock === true && merged.available === true) {
    const stock = merged.stock;
    if (typeof stock !== "number" || stock <= 0) {
      throw new APIError(
        "This product is marked available but has no stock. Add stock, turn off " +
          "stock tracking, or mark it unavailable.",
        400,
      );
    }
  }

  return data;
};
