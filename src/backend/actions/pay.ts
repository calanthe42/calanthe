"use server";

import { getPayload } from "payload";
import config from "@payload-config";
import { findOrderByPayToken } from "@backend/data/pay";
import { ensureOrderPaymentIntent } from "@backend/payments/intent";
import { payRequestState, type PayRequestState } from "@backend/payments/pay-link";
import { cardPaymentsConfigured, getStripe } from "@backend/payments/stripe";
import { LIMITS, clientAddress, throttle, waitHint } from "@backend/security/throttle";
import { getDictionary } from "@/lib/i18n/server";
import { withWait } from "@/lib/i18n/wait";

/**
 * Paying a payment request — the customer's side of /pay/[token].
 *
 * THE BROWSER SENDS ONLY THE TOKEN. No amount, no order id, no email. The
 * PaymentIntent is created (or reused) for exactly `order.totalFils`, which a
 * florist typed and the order froze; a page that claimed a different total
 * changes nothing.
 *
 * NOTHING HERE MARKS AN ORDER PAID. The browser confirms with Stripe
 * directly, and only the signed webhook moves the order to PAID
 * (backend/payments/paid.ts).
 *
 * Every refusal is a sentence in the visitor's language, from the dictionary.
 */

export type StartQuotePaymentCode =
  | "INVALID"
  | "EXPIRED"
  | "CANCELLED"
  | "PAID"
  | "PROCESSING"
  | "RATE_LIMITED"
  | "PAYMENT_UNAVAILABLE"
  | "FAILED";

export type StartQuotePaymentResult =
  | { ok: true; clientSecret: string }
  | { ok: false; code: StartQuotePaymentCode; message: string };

export async function startQuotePayment(token: string): Promise<StartQuotePaymentResult> {
  const { locale, t } = await getDictionary();
  const m = t.server.pay;
  const fail = (code: StartQuotePaymentCode, message: string): StartQuotePaymentResult => ({
    ok: false,
    code,
    message,
  });

  /* Each attempt talks to Stripe, so it is counted before anything else. */
  const attempts = await throttle(LIMITS.payStart, await clientAddress());
  if (!attempts.allowed) {
    return fail("RATE_LIMITED", withWait(locale, t, m.rateLimited, waitHint(attempts.retryAfterSeconds)));
  }

  const stripe = getStripe();
  if (!stripe || !cardPaymentsConfigured()) {
    return fail("PAYMENT_UNAVAILABLE", t.server.checkout.paymentUnavailable);
  }

  const payload = await getPayload({ config });
  const order = await findOrderByPayToken(payload, token);
  if (!order) return fail("INVALID", m.linkInvalid);

  const refusal = (state: PayRequestState): StartQuotePaymentResult | null =>
    state === "expired"
      ? fail("EXPIRED", m.linkExpired)
      : state === "cancelled"
        ? fail("CANCELLED", m.cancelled)
        : state === "paid"
          ? fail("PAID", m.alreadyPaid)
          : null;

  const refused = refusal(payRequestState(order, new Date()));
  if (refused) return refused;

  const intent = await ensureOrderPaymentIntent(payload, stripe, order);
  if (intent.kind === "processing") return fail("PROCESSING", m.processing);
  /* The stored intent was cancelled (a florist cancelled, or it was cancelled
     in Stripe). A customer never gets a fresh one: only "resend" in the admin
     brings a request back. */
  if (intent.kind === "canceled") return fail("EXPIRED", m.linkExpired);
  if (intent.kind === "failed") return fail("FAILED", m.failed);

  /* THE CANCEL RACE, CLOSED FROM THIS SIDE. A florist may have cancelled the
     request while the intent above was being created — after her action
     looked for an intent to cancel and found none. Read the order again: if
     it is no longer payable, cancel what was just made and hand nothing
     back, so nobody is left holding a way to pay for a cancelled request. */
  const fresh = await payload
    .findByID({ collection: "orders", id: order.id, depth: 0, overrideAccess: true })
    .catch(() => null);
  /* "Could not read" is not "not payable". Cancel nothing and hand nothing
     back: the intent's id is already on the order, so a real cancellation
     still finds it, and the customer can simply press again. */
  if (!fresh) return fail("FAILED", m.failed);
  const stateNow = payRequestState(fresh, new Date());
  if (stateNow !== "awaiting") {
    if (stateNow !== "paid") {
      await stripe.paymentIntents.cancel(intent.intentId).catch((error: unknown) => {
        payload.logger.error(
          `order ${order.orderNumber}: ${intent.intentId} should be cancelled and could not be: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        );
      });
    }
    return refusal(stateNow) ?? fail("FAILED", m.failed);
  }

  return { ok: true, clientSecret: intent.clientSecret };
}

/**
 * Where the request stands — the state and nothing else. Polled by the page
 * after the browser has confirmed with Stripe, until the webhook has written
 * PAID. "busy" means "ask again shortly": the caller is over the view limit,
 * which is not the same thing as the link being wrong.
 */
export async function getQuotePaymentState(
  token: string,
): Promise<{ state: PayRequestState | "invalid" | "busy" }> {
  const views = await throttle(LIMITS.payView, await clientAddress());
  if (!views.allowed) return { state: "busy" };

  const payload = await getPayload({ config });
  const order = await findOrderByPayToken(payload, token);
  if (!order) return { state: "invalid" };
  return { state: payRequestState(order, new Date()) };
}
