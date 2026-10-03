import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

/**
 * The one Stripe client (docs/PAYMENTS.md). Server-only: the secret key
 * never reaches a browser bundle.
 *
 * `null` when the keys are absent, so a deployment without them shows a
 * clear "payment unavailable" state instead of throwing on import.
 */
let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  client = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  return client;
}

/** Card checkout needs both halves: a server key and a browser key. */
export function cardPaymentsConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}
