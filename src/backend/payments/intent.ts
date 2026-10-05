import type Stripe from "stripe";
import type { Payload } from "payload";

/**
 * One order, one PaymentIntent — for as long as the order can be paid.
 *
 * WHY THE ID IS STORED. Web checkout relied on the idempotency key
 * `order-{id}` alone, which was enough when an order was paid within
 * minutes. Stripe forgets a key after about a day. A payment link lives for
 * a week, so on day two the same key would quietly create a SECOND intent —
 * and two tabs could then each pay one. The id on the order is what prevents
 * that: once it is there, the intent is retrieved, never re-created.
 *
 * PERSIST BEFORE RETURN. The client secret is handed to a browser only after
 * the intent's id has been written to the order. If that write fails, the
 * intent just created is cancelled and nothing is returned — an intent the
 * order does not know about is exactly the one the webhook would have to
 * refuse (backend/payments/verdict.ts).
 *
 * THE AMOUNT COMES FROM THE ORDER. Nothing the browser sent is in scope
 * here. The intent is created for `order.totalFils`, and re-checked against
 * it before the secret is released.
 *
 * A CANCELLED INTENT IS NOT REPLACED FOR A CUSTOMER. A florist cancelling a
 * request cancels its intent; if the customer's path then minted a fresh
 * one, they would be holding a way to pay for a cancelled order. Only a
 * florist — `replaceCanceled`, used by "resend" — brings a request back.
 */

export type IntentOrder = {
  id: number;
  orderNumber?: string | number | null;
  totalFils: number;
  customerEmail: string;
  source?: string | null;
  /** The discount code on the order, as text. Never an amount. */
  couponCode?: string | null;
  stripePaymentIntentId?: string | null;
};

export type EnsureIntentResult =
  | { kind: "ready"; clientSecret: string; intentId: string }
  /** The customer has paid or is paying: do not offer to pay again. */
  | { kind: "processing"; intentId: string }
  /** The stored intent was cancelled and this caller may not replace it. */
  | { kind: "canceled"; intentId: string }
  | { kind: "failed"; reason: string };

type StripeLike = Pick<Stripe, "paymentIntents">;

const message = (error: unknown): string => (error instanceof Error ? error.message : "unknown");

function intentParams(order: IntentOrder): Stripe.PaymentIntentCreateParams {
  const orderNumber = String(order.orderNumber ?? "");
  return {
    /* AED is a two-decimal currency, so Stripe's amount IS our fils. */
    amount: order.totalFils,
    currency: "aed",
    automatic_payment_methods: { enabled: true },
    /* Only when there IS an address. An order written by hand in the admin
       may have none (stored as ""), and Stripe refuses an empty one — every
       card, Apple Pay and Google Pay attempt on such an order then failed. */
    ...(order.customerEmail ? { receipt_email: order.customerEmail } : {}),
    description: `Calanthe order ${orderNumber}`,
    metadata: {
      kind: "order",
      orderId: String(order.id),
      orderNumber,
      ...(order.source ? { source: order.source } : {}),
      /* So a payment can be traced to its code in the Stripe dashboard. The
         amount is `order.totalFils` above — already discounted — and nothing
         in metadata is ever read back as money. */
      ...(order.couponCode ? { couponCode: order.couponCode } : {}),
    },
  };
}

/** The secret is released only for an intent that matches the order exactly. */
function mismatch(intent: Stripe.PaymentIntent, order: IntentOrder): string | null {
  if (intent.amount !== order.totalFils) {
    return `intent ${intent.id} is for ${intent.amount}, order ${order.orderNumber} totals ${order.totalFils}`;
  }
  if (intent.currency.toLowerCase() !== "aed") {
    return `intent ${intent.id} is in ${intent.currency}, not AED`;
  }
  if (intent.metadata?.orderId !== String(order.id)) {
    return `intent ${intent.id} belongs to order ${intent.metadata?.orderId ?? "?"}, not ${order.id}`;
  }
  return null;
}

type DrizzleLike = { execute: (query: unknown) => Promise<unknown> };

/** How the intent's id is written to the order. Replaceable in tests. */
export type StoreIntentId = (payload: Payload, orderId: number, intentId: string) => Promise<void>;

/**
 * Writes the intent id, and ONLY the intent id.
 *
 * `payload.update` rewrites the whole order row from a copy it read a moment
 * earlier. Here that could put a request back to "new" that a florist had
 * cancelled in the same instant — leaving a cancelled order payable — or
 * hand an order its old payment state back. One column, one statement.
 */
const storeIntentId: StoreIntentId = async (payload, orderId, intentId) => {
  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;
  const written = await drizzle.execute(sql`
    UPDATE orders
    SET stripe_payment_intent_id = ${intentId}::text, updated_at = now()
    WHERE id = ${orderId}::int
    RETURNING id
  `);
  const rows = Array.isArray(written) ? written : ((written as { rows?: unknown[] })?.rows ?? []);
  if (rows.length === 0) throw new Error(`order ${orderId} was not found`);
};

/** Stripe marks a response it replayed for an idempotency key it has seen. */
function wasReplayed(intent: Stripe.PaymentIntent): boolean {
  const headers = (intent as { lastResponse?: { headers?: Record<string, string> } }).lastResponse?.headers;
  return headers?.["idempotent-replayed"] === "true";
}

async function createAndStore(
  payload: Payload,
  stripe: StripeLike,
  order: IntentOrder,
  idempotencyKey: string,
  store: StoreIntentId,
): Promise<EnsureIntentResult> {
  let intent = await stripe.paymentIntents.create(intentParams(order), { idempotencyKey });

  /* NEVER TRUST A REPLAYED CREATE. For about a day Stripe answers a repeated
     key with the ORIGINAL response — an intent that looks payable even if it
     has since been cancelled (which is what happens below when its id could
     not be stored). Ask what it is now; a paid one is not offered again, and
     a cancelled one is replaced under a key that cannot replay it. */
  if (wasReplayed(intent)) {
    const live = await stripe.paymentIntents.retrieve(intent.id);
    if (live.status === "succeeded" || live.status === "processing") {
      return { kind: "processing", intentId: live.id };
    }
    intent =
      live.status === "canceled"
        ? await stripe.paymentIntents.create(intentParams(order), {
            idempotencyKey: `order-${order.id}-r-${live.id}`,
          })
        : live;
  }

  const wrong = mismatch(intent, order);
  if (wrong || !intent.client_secret) {
    const reason = wrong ?? `intent ${intent.id} has no client secret`;
    payload.logger.error(`stripe: ${reason}`);
    return { kind: "failed", reason };
  }

  try {
    await store(payload, order.id, intent.id);
  } catch (error) {
    /* The order does not know this intent, so nobody may pay it. */
    payload.logger.error(
      `order ${order.orderNumber}: could not store ${intent.id} (${message(error)}); cancelling it`,
    );
    await stripe.paymentIntents.cancel(intent.id).catch((cancelError: unknown) => {
      payload.logger.error(
        `order ${order.orderNumber}: ${intent.id} could not be cancelled either (${message(cancelError)}) — cancel it in Stripe`,
      );
    });
    return { kind: "failed", reason: "the payment could not be recorded on the order" };
  }

  return { kind: "ready", clientSecret: intent.client_secret, intentId: intent.id };
}

export async function ensureOrderPaymentIntent(
  payload: Payload,
  stripe: StripeLike,
  order: IntentOrder,
  options: { replaceCanceled?: boolean; store?: StoreIntentId } = {},
): Promise<EnsureIntentResult> {
  const store = options.store ?? storeIntentId;
  try {
    const storedId = order.stripePaymentIntentId;
    if (!storedId) {
      /* Two tabs pressing pay in the same second send the same key and get
         the same intent back, so both store the same id. */
      return await createAndStore(payload, stripe, order, `order-${order.id}`, store);
    }

    const existing = await stripe.paymentIntents.retrieve(storedId);

    if (existing.status === "succeeded" || existing.status === "processing") {
      return { kind: "processing", intentId: existing.id };
    }

    if (existing.status === "canceled") {
      if (!options.replaceCanceled) return { kind: "canceled", intentId: existing.id };
      /* A different key on purpose: within a day, `order-{id}` would replay
         the cancelled intent's original response. */
      return await createAndStore(payload, stripe, order, `order-${order.id}-r-${existing.id}`, store);
    }

    const wrong = mismatch(existing, order);
    if (wrong || !existing.client_secret) {
      const reason = wrong ?? `intent ${existing.id} has no client secret`;
      payload.logger.error(`stripe: ${reason}`);
      return { kind: "failed", reason };
    }
    return { kind: "ready", clientSecret: existing.client_secret, intentId: existing.id };
  } catch (error) {
    payload.logger.error(`order ${order.orderNumber}: payment could not be started: ${message(error)}`);
    return { kind: "failed", reason: message(error) };
  }
}
