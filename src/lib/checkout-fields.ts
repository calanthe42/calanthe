/**
 * Checkout field rules, run in the browser before an order is sent.
 *
 * The server (backend/actions/checkout.ts) is the authority and re-checks all
 * of this. These exist so a customer learns what is wrong beside the field
 * she typed it in, instead of from a toast after a round trip, and so the
 * way people in the UAE actually write a phone number is accepted.
 */

/** Same pattern the server enforces. */
const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Turns the common ways of writing a UAE number into the international form
 * the server requires, and leaves anything else as typed so the server's own
 * message still applies.
 *
 *   "050 123 4567"      -> "+971501234567"
 *   "00971 50 123 4567" -> "+971501234567"
 *   "971501234567"      -> "+971501234567"
 *   "+44 7700 900123"   -> "+447700900123"
 */
export function normalisePhone(input: string): string {
  const compact = input.trim().replace(/[\s\-().]/g, "");
  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("971")) return `+${compact}`;
  /* A local mobile or landline: drop the trunk zero, add the country code. */
  if (/^0\d{8,9}$/.test(compact)) return `+971${compact.slice(1)}`;
  return compact;
}

export function isValidPhone(input: string): boolean {
  return E164.test(normalisePhone(input));
}

export function isValidEmail(input: string): boolean {
  return EMAIL.test(input.trim());
}

export type CheckoutFieldValues = {
  mode: "gift" | "myself";
  recipientName: string;
  recipientPhone: string;
  zoneId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
};

export type CheckoutField = keyof Omit<CheckoutFieldValues, "mode">;

/**
 * WHY THESE ARE CODES AND NOT SENTENCES.
 *
 * This function used to return finished English — "Tell us your name." — so
 * every validation message on the checkout appeared in English however the
 * page was set, and the only way to translate one was to translate a
 * sentence back into a field. A code names the problem; the dictionary owns
 * the wording. `checkout.errors` in the dictionary is typed against this
 * union, so a new code cannot be added without its Arabic.
 */
export type CheckoutErrorCode =
  | "recipientNameRequired"
  | "phoneInvalid"
  | "zoneRequired"
  | "nameRequired"
  | "phoneRequired"
  | "emailRequired"
  | "emailInvalid"
  | "addressRequired";

/** Field -> reason, for every field that would stop the order. */
export function checkoutFieldErrors(
  values: CheckoutFieldValues,
): Partial<Record<CheckoutField, CheckoutErrorCode>> {
  const errors: Partial<Record<CheckoutField, CheckoutErrorCode>> = {};

  if (values.mode === "gift") {
    if (!values.recipientName.trim()) {
      errors.recipientName = "recipientNameRequired";
    }
    if (values.recipientPhone.trim() && !isValidPhone(values.recipientPhone)) {
      errors.recipientPhone = "phoneInvalid";
    }
  }
  if (!values.zoneId) errors.zoneId = "zoneRequired";
  if (!values.name.trim()) errors.name = "nameRequired";
  if (!values.phone.trim()) {
    errors.phone = "phoneRequired";
  } else if (!isValidPhone(values.phone)) {
    errors.phone = "phoneInvalid";
  }
  if (!values.email.trim()) {
    errors.email = "emailRequired";
  } else if (!isValidEmail(values.email)) {
    errors.email = "emailInvalid";
  }
  if (!values.address.trim()) errors.address = "addressRequired";

  return errors;
}
