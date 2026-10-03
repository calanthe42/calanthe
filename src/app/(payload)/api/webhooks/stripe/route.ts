import { getPayload } from "payload";
import config from "@payload-config";
import type Stripe from "stripe";
import { applySucceededIntent } from "@backend/payments/paid";
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
 */
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
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    payload.logger.error(`stripe ${event.id} failed: ${error instanceof Error ? error.message : "unknown"}`);
    return new Response("Handler error", { status: 500 });
  }
}
