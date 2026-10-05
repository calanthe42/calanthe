import { getPayload } from "payload";
import config from "@payload-config";
import type Stripe from "stripe";
import { applySucceededIntent, noteStripeEventOnOrder } from "@backend/payments/paid";
import { formatFils } from "@/lib/money";
import { getStripe } from "@backend/payments/stripe";
import { env } from "@/lib/env";

/**
 * Stripe → Calanthe. The only thing allowed to change payment state
 * (docs/PAYMENTS.md §2, §4).
 *
 * 1. Raw body, never parsed first — parsing destroys the signature.
 * 2. Signature verified with STRIPE_WEBHOOK_SECRET; anything else is 400.
 * 3. Idempotent by construction: a replayed success finds the order PAID.
 * 4. Unknown events are acknowledged (200) so Stripe stops retrying noise.
 * 5. A thrown error is 500, so Stripe retries.
 * 6. Refunds, disputes and cancelled intents never change payment state
 *    here. They are written onto the order as an internal note, so a human
 *    who refunds in the Stripe dashboard leaves a trace where staff look.
 *    (They arrive only if the endpoint is subscribed to those events.)
 */

const intentIdOf = (value: string | { id: string } | null | undefined): string | undefined =>
  typeof value === "string" ? value : value?.id;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe is not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const payload = await getPayload({ config });
  try {
    if (event.type === "payment_intent.succeeded") {
      const outcome = await applySucceededIntent(payload, event.data.object);
      payload.logger.info(`stripe ${event.id} ${event.type}: ${outcome}`);
    } else if (event.type === "payment_intent.payment_failed") {
      /* The order stays PENDING; the customer can try again on the page. */
      const intent = event.data.object;
      payload.logger.warn(
        `stripe ${event.id}: payment failed for order ${intent.metadata?.orderNumber ?? "?"} (${intent.last_payment_error?.code ?? "no code"})`,
      );
    } else if (event.type === "payment_intent.canceled") {
      /* Expected when a florist cancels a payment request. Logged only. */
      const intent = event.data.object;
      payload.logger.info(
        `stripe ${event.id}: intent ${intent.id} cancelled for order ${intent.metadata?.orderNumber ?? "?"}`,
      );
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const outcome = await noteStripeEventOnOrder(
        payload,
        intentIdOf(charge.payment_intent),
        `⚠ STRIPE: ${formatFils(charge.amount_refunded)} refunded on charge ${charge.id}. The order still reads as paid here.`,
      );
      payload.logger.warn(`stripe ${event.id} ${event.type}: ${outcome}`);
    } else if (event.type === "charge.dispute.created") {
      const dispute = event.data.object;
      const outcome = await noteStripeEventOnOrder(
        payload,
        intentIdOf(dispute.payment_intent),
        `⚠ STRIPE: the customer's bank has disputed this payment (${dispute.id}). Answer it in the Stripe dashboard.`,
      );
      payload.logger.warn(`stripe ${event.id} ${event.type}: ${outcome}`);
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    payload.logger.error(`stripe ${event.id} failed: ${error instanceof Error ? error.message : "unknown"}`);
    return new Response("Handler error", { status: 500 });
  }
}
