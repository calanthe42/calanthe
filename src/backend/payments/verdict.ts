/**
 * Should this Stripe PaymentIntent mark this order paid? Pure, so every rule
 * is unit-tested (docs/PAYMENTS.md §4–5).
 *
 * The intent is the one Stripe sent us, signed. The order is ours, loaded by
 * the id the intent carries in its metadata. Paid only when everything
 * agrees: it is an order intent, for this order, in AED, for exactly the
 * total we computed, and Stripe says it succeeded. A captured payment that
 * disagrees is never "fixed" here — it is flagged for a human.
 *
 * ONE ORDER, ONE INTENT. The order stores the id of the PaymentIntent created
 * for it. A succeeded intent with any OTHER id is money taken a second time
 * (two intents for one order) or money meant for a different database
 * (preview and production share a Stripe test account, and "order 12" exists
 * in both). Either way it must reach a human, loudly — the old rule looked
 * only at `paymentStatus === "PAID"` and answered "already paid", which
 * swallowed a double charge without a trace.
 */
export type IntentFacts = {
  id: string;
  status: string;
  amount: number;
  amountReceived: number;
  currency: string;
  metadata: Record<string, string | undefined>;
};

export type OrderFacts = {
  id: number | string;
  totalFils: number;
  paymentStatus: string;
  /** Compared with the intent's metadata when both are present. */
  orderNumber?: string | number | null;
  /** The intent created for this order. Empty on orders older than the field. */
  stripePaymentIntentId?: string | null;
};

export type Verdict =
  | { action: "mark-paid" }
  | { action: "already-paid" }
  | { action: "ignore"; reason: string }
  | { action: "flag"; reason: string };

/** Money has arrived for this order, whatever happened to it afterwards. */
const SETTLED = new Set(["PAID", "REFUNDED", "PARTIALLY_REFUNDED"]);

export function paymentVerdict(intent: IntentFacts, order: OrderFacts | null): Verdict {
  if (intent.metadata.kind !== "order") return { action: "ignore", reason: "not an order intent" };
  if (!order) return { action: "flag", reason: `no order ${intent.metadata.orderId ?? "?"} for ${intent.id}` };
  if (String(order.id) !== String(intent.metadata.orderId))
    return { action: "flag", reason: `intent ${intent.id} names another order` };
  if (
    intent.metadata.orderNumber &&
    order.orderNumber &&
    String(order.orderNumber) !== intent.metadata.orderNumber
  )
    return {
      action: "flag",
      reason: `intent ${intent.id} is for order ${intent.metadata.orderNumber}, which is not this order — it belongs to another environment`,
    };
  if (intent.currency.toLowerCase() !== "aed")
    return { action: "flag", reason: `intent ${intent.id} is in ${intent.currency}, not AED` };
  if (intent.status !== "succeeded") return { action: "ignore", reason: `status ${intent.status}` };

  const settled = SETTLED.has(order.paymentStatus);
  if (order.stripePaymentIntentId && order.stripePaymentIntentId !== intent.id)
    return {
      action: "flag",
      reason: settled
        ? `second payment for a paid order — refund ${intent.id} in Stripe (the order was paid by ${order.stripePaymentIntentId})`
        : `intent ${intent.id} is not the one created for this order (${order.stripePaymentIntentId}) — check and refund in Stripe`,
    };

  if (settled) return { action: "already-paid" };
  if (intent.amountReceived !== order.totalFils || intent.amount !== order.totalFils)
    return {
      action: "flag",
      reason: `amount mismatch on ${intent.id}: received ${intent.amountReceived}, order total ${order.totalFils}`,
    };
  return { action: "mark-paid" };
}
