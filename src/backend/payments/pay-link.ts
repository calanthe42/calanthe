import { createHash, createHmac, randomBytes } from "node:crypto";
import { MIN_CHARGE_FILS } from "@/lib/money";

/**
 * The payment link a florist emails when she confirms an enquiry.
 *
 * PURE — no database, no clock (the time is passed in), no environment
 * except in `payLinkOrigin` — so every rule below is unit-tested.
 *
 * WHAT THE LINK IS. `/pay/<token>`, where
 *
 *     token = HMAC-SHA256(PAYLOAD_SECRET, "calanthe-pay-link:v1:" + salt)
 *
 * and only the random `salt` and the SHA-256 of the token are stored on the
 * order. Two consequences, both deliberate:
 *
 *   · the database alone can never yield a working link — a leaked backup
 *     holds salts and hashes, and without the secret neither becomes a URL;
 *   · the SAME link can be rebuilt for "resend", so a customer is never sent
 *     a second, different link while the first is still in their inbox.
 *
 * WHAT THE LINK GRANTS. Paying, or viewing the invoice of, this one order.
 * No session, no other order, no account.
 *
 * NOTE: loaded by the Payload CLI through the order hooks, so this file must
 * not `import "server-only"` (see backend/payload/access/index.ts).
 */

export const PAY_LINK_TTL_DAYS = 7;
/** The slug every bespoke line carries. Never a real product's slug. */
export const BESPOKE_SLUG = "bespoke-arrangement";
/** `orders.source` for an order created by confirming an enquiry. */
export const QUOTE_SOURCE = "admin-quote";
/**
 * `orders.source` for an order the shop wrote by hand in the admin: a sale
 * that arrived on WhatsApp, by phone or in person. It carries a pay link
 * exactly like a payment request, and can ALSO be recorded as paid outside
 * the website by the owner (cash, bank transfer, card machine).
 */
export const MANUAL_SOURCE = "admin-manual";
/** The slug of a hand-typed line on an admin-created order. Never a product's. */
export const CUSTOM_SLUG = "custom-item";
/** Every source whose order is paid through `/pay/<token>`. */
export const PAY_LINK_SOURCES: readonly string[] = [QUOTE_SOURCE, MANUAL_SOURCE];
export function isPayLinkSource(source: string | null | undefined): boolean {
  return PAY_LINK_SOURCES.includes(source ?? "");
}
/** How an order was paid. `card` is the website (Stripe); the rest are recorded by the owner. */
export const OUTSIDE_PAYMENT_METHODS = ["cash", "bank-transfer", "card-machine"] as const;
export type OutsidePaymentMethod = (typeof OUTSIDE_PAYMENT_METHODS)[number];
export type PaymentMethod = "card" | OutsidePaymentMethod;
export const SALES_CHANNELS = ["whatsapp", "phone", "instagram", "in-person", "other"] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

/** The method to print on an invoice: what was recorded, else the card. */
export function paymentMethodOf(order: { paymentMethod?: string | null }): PaymentMethod {
  const recorded = order.paymentMethod ?? "";
  return (OUTSIDE_PAYMENT_METHODS as readonly string[]).includes(recorded)
    ? (recorded as OutsidePaymentMethod)
    : "card";
}

/** The least a payment request can ask for — the shared minimum charge. */
export const QUOTE_MIN_FILS = MIN_CHARGE_FILS;

const TOKEN_CONTEXT = "calanthe-pay-link:v1:";
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const DAY_MS = 86_400_000;

/** 32 random bytes, URL-safe. One per order, never reused. */
export function newPayTokenSalt(): string {
  return randomBytes(32).toString("base64url");
}

/** The token in the link: 43 URL-safe characters, 256 bits. */
export function payToken(secret: string, salt: string): string {
  return createHmac("sha256", secret).update(`${TOKEN_CONTEXT}${salt}`).digest("base64url");
}

/** What is stored and looked up: SHA-256 of the token, hex. */
export function hashPayToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap refusal of anything that cannot be a token, before any query. */
export function isPayTokenShape(value: unknown): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}

export function payLinkExpiry(now: Date, days: number = PAY_LINK_TTL_DAYS): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

export type PayRequestState = "awaiting" | "expired" | "cancelled" | "paid";

export type PayRequestFacts = {
  paymentStatus?: string | null;
  fulfilmentStatus?: string | null;
  payLinkExpiresAt?: string | null;
};

/** Money has arrived, whatever happened to it afterwards. */
const SETTLED = new Set(["PAID", "REFUNDED", "PARTIALLY_REFUNDED"]);

export function isSettled(paymentStatus: string | null | undefined): boolean {
  return SETTLED.has(paymentStatus ?? "");
}

/**
 * Where a payment request stands. Derived from the order every time, never
 * stored: a second copy of payment state is a second thing that can be wrong.
 *
 * Precedence matters. PAID beats CANCELLED — money that arrived is money
 * that arrived, even on a request someone cancelled a second earlier — and
 * CANCELLED beats expiry, because "cancelled" is the truer thing to say.
 */
export function payRequestState(order: PayRequestFacts, now: Date): PayRequestState {
  if (isSettled(order.paymentStatus)) return "paid";
  if (order.fulfilmentStatus === "CANCELLED") return "cancelled";
  if (!order.payLinkExpiresAt) return "expired";
  const expires = new Date(order.payLinkExpiresAt).getTime();
  if (!Number.isFinite(expires) || expires <= now.getTime()) return "expired";
  return "awaiting";
}

/**
 * An order confirmed from an enquiry — or written by hand in the admin —
 * that nobody has paid for yet.
 *
 * The one predicate behind every "this is not a real order yet" rule: it
 * cannot be prepared, it is not revenue, and it is not a new order waiting
 * on the florist (backend/domain/dashboard.ts re-exports the same idea).
 */
export function isUnpaidQuote(order: { source?: string | null; paymentStatus?: string | null }): boolean {
  return isPayLinkSource(order.source) && !isSettled(order.paymentStatus);
}

/**
 * The shareable address of a PAID invoice: `/invoice/<number>/<key>`.
 *
 * Every paid order has one, whatever its source — a website order has no pay
 * link, but its invoice can still be opened, printed and sent. The key is
 * HMAC(PAYLOAD_SECRET, number): nothing is stored, the number alone opens
 * nothing, and the page shows that one invoice and no more.
 */
const INVOICE_CONTEXT = "calanthe-invoice:v1:";
const INVOICE_NUMBER_SHAPE = /^CAL-INV-\d{4}-\d{5,}$/;

export function isInvoiceNumberShape(value: unknown): value is string {
  return typeof value === "string" && INVOICE_NUMBER_SHAPE.test(value);
}

export function invoiceKey(secret: string, invoiceNumber: string): string {
  return createHmac("sha256", secret).update(`${INVOICE_CONTEXT}${invoiceNumber}`).digest("base64url");
}

export function invoiceUrl(origin: string, secret: string, invoiceNumber: string, locale: "en" | "ar"): string {
  return `${origin.replace(/\/$/, "")}/invoice/${invoiceNumber}/${invoiceKey(secret, invoiceNumber)}?lang=${locale}`;
}

export function payUrl(origin: string, token: string, locale: "en" | "ar"): string {
  return `${origin.replace(/\/$/, "")}/pay/${token}?lang=${locale}`;
}

/**
 * Which host a pay link points at.
 *
 * Production and local use the site's own origin. A Vercel PREVIEW points at
 * its own branch host instead, so a link sent while testing opens the
 * deployment that holds the order rather than the live site, which has never
 * heard of it.
 */
export function payLinkOrigin(
  siteOrigin: string,
  vercel: { env?: string; branchUrl?: string } = {},
): string {
  if (vercel.env === "preview" && vercel.branchUrl) return `https://${vercel.branchUrl}`;
  return siteOrigin;
}
