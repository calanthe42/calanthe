/**
 * Should this Stripe PaymentIntent mark this order paid? Pure, so every rule
 * is unit-tested (docs/PAYMENTS.md §4–5).
 *
 * The intent is the one Stripe sent us, signed. The order is ours, loaded by
 * the id the intent carries in its metadata. Paid only when everything
 * agrees: it is an order intent, for this order, in AED, for exactly the
 * total we computed, and Stripe says it succeeded. A captured payment that
 * disagrees is never "fixed" here — it is flagged for a human.
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
};

export type Verdict =
  | { action: "mark-paid" }
  | { action: "already-paid" }
  | { action: "ignore"; reason: string }
  | { action: "flag"; reason: string };

export function paymentVerdict(intent: IntentFacts, order: OrderFacts | null): Verdict {
  if (intent.metadata.kind !== "order") return { action: "ignore", reason: "not an order intent" };
  if (!order) return { action: "flag", reason: `no order ${intent.metadata.orderId ?? "?"} for ${intent.id}` };
  if (String(order.id) !== String(intent.metadata.orderId))
    return { action: "flag", reason: `intent ${intent.id} names another order` };
  if (intent.currency.toLowerCase() !== "aed")
    return { action: "flag", reason: `intent ${intent.id} is in ${intent.currency}, not AED` };
  if (intent.status !== "succeeded") return { action: "ignore", reason: `status ${intent.status}` };
  if (order.paymentStatus === "PAID") return { action: "already-paid" };
  if (intent.amountReceived !== order.totalFils || intent.amount !== order.totalFils)
    return {
      action: "flag",
      reason: `amount mismatch on ${intent.id}: received ${intent.amountReceived}, order total ${order.totalFils}`,
    };
  return { action: "mark-paid" };
}
