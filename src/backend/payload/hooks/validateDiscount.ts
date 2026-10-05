import { APIError } from "payload";
import type { CollectionBeforeValidateHook } from "payload";
import {
  CODE_PATTERN,
  MAX_DISCOUNT_PERCENT,
  SALE_LABEL_MAX,
  normaliseCode,
} from "@/lib/discounts";

/**
 * Cross-field rules for a discount, whoever is writing it.
 *
 * The admin's form parser (backend/domain/discount-form.ts) is the friendly
 * first line. This is the one that cannot be walked around: an edit in /cms,
 * a REST call, or server code all pass through it, so a discount that reaches
 * the pricing engine is always one the engine understands.
 *
 * It also NORMALISES rather than merely refusing, because the two kinds share
 * one table: a sale never keeps a code, a code never keeps a product list,
 * and the unused half of "percentage or fixed" is always null. Pricing reads
 * `valueType` and then exactly one of the two numbers.
 */

const hasItems = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const validateDiscount: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (!data) return data;

  /* A partial update carries only what changed; judge the whole document. */
  const merged: Record<string, unknown> =
    operation === "create" ? data : { ...originalDoc, ...data };

  /* The method cannot change after creation (field access says so for the
     API; this says so for server code as well). */
  const kind = operation === "create" ? merged.kind : (originalDoc?.kind ?? merged.kind);
  if (kind !== "automatic" && kind !== "code") {
    throw new APIError("Choose whether this is an automatic sale or a discount code.", 400);
  }
  if (operation !== "create" && data.kind !== undefined && data.kind !== kind) {
    throw new APIError("A discount's type cannot be changed after it is created.", 400);
  }

  /* ---------- value ---------- */
  if (merged.valueType === "percentage") {
    const percent = Number(merged.percentOff);
    if (!Number.isInteger(percent) || percent < 1 || percent > MAX_DISCOUNT_PERCENT) {
      throw new APIError(
        `The percentage must be a whole number from 1 to ${MAX_DISCOUNT_PERCENT}.`,
        400,
      );
    }
    data.percentOff = percent;
    data.amountOffFils = null;
  } else if (merged.valueType === "fixed") {
    const amount = Number(merged.amountOffFils);
    if (!Number.isSafeInteger(amount) || amount < 100) {
      throw new APIError("The amount off must be at least AED 1.", 400);
    }
    data.amountOffFils = amount;
    data.percentOff = null;
  } else {
    throw new APIError("Choose a percentage or a fixed amount.", 400);
  }

  /* ---------- per kind ---------- */
  if (kind === "code") {
    const code = normaliseCode(text(merged.code));
    if (!CODE_PATTERN.test(code)) {
      throw new APIError(
        "Use 3 to 24 letters and numbers for the code, with no spaces.",
        400,
      );
    }
    data.code = code;
    /* Codes are order-wide in this version. */
    data.appliesTo = "all";
    data.products = [];
    data.occasions = [];
    data.categories = [];
    if (!text(merged.title)) data.title = code;

    const minimum = merged.minSubtotalFils;
    if (minimum !== null && minimum !== undefined) {
      if (!Number.isSafeInteger(Number(minimum)) || Number(minimum) < 0) {
        throw new APIError("The minimum purchase must be a whole amount, zero or more.", 400);
      }
    }
    const limit = merged.usageLimit;
    if (limit !== null && limit !== undefined) {
      if (!Number.isInteger(Number(limit)) || Number(limit) < 1) {
        throw new APIError("The usage limit must be a whole number, 1 or more.", 400);
      }
    }
  } else {
    /* An automatic sale has no code — and null, never "", because the code
       column is unique and many sales must be able to share "no code". */
    data.code = null;
    data.minSubtotalFils = null;
    data.usageLimit = null;
    data.oncePerCustomer = false;

    const labelEn = text(merged.labelEn);
    const labelAr = text(merged.labelAr);
    if (!labelEn || !labelAr) {
      throw new APIError("Add the customer label in both English and Arabic.", 400);
    }
    if (labelEn.length > SALE_LABEL_MAX || labelAr.length > SALE_LABEL_MAX) {
      throw new APIError(`Keep each customer label under ${SALE_LABEL_MAX} characters.`, 400);
    }

    const appliesTo = merged.appliesTo ?? "all";
    if (appliesTo === "products" && !hasItems(merged.products)) {
      throw new APIError("Choose at least one product for this sale.", 400);
    }
    if (appliesTo === "occasions" && !hasItems(merged.occasions)) {
      throw new APIError("Choose at least one occasion for this sale.", 400);
    }
    if (appliesTo === "categories" && !hasItems(merged.categories)) {
      throw new APIError("Choose at least one category for this sale.", 400);
    }
  }

  if (!text(merged.title) && !text(data.title)) {
    throw new APIError("Give the discount a name.", 400);
  }

  /* ---------- dates ---------- */
  const startsAt = merged.startsAt ? new Date(String(merged.startsAt)).getTime() : null;
  const endsAt = merged.endsAt ? new Date(String(merged.endsAt)).getTime() : null;
  if ((startsAt !== null && Number.isNaN(startsAt)) || (endsAt !== null && Number.isNaN(endsAt))) {
    throw new APIError("That is not a real date.", 400);
  }
  if (endsAt !== null && startsAt !== null && endsAt <= startsAt) {
    throw new APIError("The end must be after the start.", 400);
  }

  return data;
};
