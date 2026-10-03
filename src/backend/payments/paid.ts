import "server-only";
import type Stripe from "stripe";
import type { Payload } from "payload";
import { buildOrderEmails, describeOptions } from "@backend/email/order-emails";
import { sendAfterCommit } from "@backend/email/send";
import { PAYMENT_PROVIDER_CONTEXT } from "@backend/payload/hooks/orderIntegrity";
import { env } from "@/lib/env";
import { paymentVerdict } from "./verdict";

type OrderDoc = {
  id: number;
  orderNumber: string | number;
  totalFils: number;
  subtotalFils: number;
  deliveryFeeFils: number;
  paymentStatus: string;
  internalNotes?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryEmirate: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryNotes?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  cardMessage?: string | null;
  items?: { productName: string; quantity: number; selectedOptions?: { label?: string | null; value?: string | null }[] | null }[] | null;
};

/**
 * Apply a signed `payment_intent.succeeded` to its order — the ONLY path that
 * marks an order paid (docs/PAYMENTS.md §2). Idempotent: Stripe retries for
 * days, and a replay finds the order already PAID and does nothing. The
 * order's emails are sent here, after the write, because a card order is
 * not confirmed to anyone until the money is.
 */
export async function applySucceededIntent(payload: Payload, intent: Stripe.PaymentIntent): Promise<string> {
  const orderId = intent.metadata?.orderId;
  let order: OrderDoc | null = null;
  if (orderId) {
    order = (await payload
      .findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
      .catch(() => null)) as OrderDoc | null;
  }

  const verdict = paymentVerdict(
    {
      id: intent.id,
      status: intent.status,
      amount: intent.amount,
      amountReceived: intent.amount_received,
      currency: intent.currency,
      metadata: intent.metadata ?? {},
    },
    order ? { id: order.id, totalFils: order.totalFils, paymentStatus: order.paymentStatus } : null,
  );

  if (verdict.action === "ignore" || verdict.action === "already-paid") return verdict.action;

  if (verdict.action === "flag") {
    /* Money was captured but something disagrees. Never roll back; tell a
       human, on the order itself where staff will see it. */
    payload.logger.error(`stripe: ${verdict.reason}`);
    if (order) {
      await payload.update({
        collection: "orders",
        id: order.id,
        overrideAccess: true,
        data: { internalNotes: `${order.internalNotes ? `${order.internalNotes}\n` : ""}⚠ PAYMENT CHECK: ${verdict.reason}` } as never,
      });
    }
    return "flagged";
  }

  /* mark-paid */
  await payload.update({
    collection: "orders",
    id: order!.id,
    overrideAccess: true,
    context: { [PAYMENT_PROVIDER_CONTEXT]: true },
    data: { paymentStatus: "PAID" } as never,
  });

  try {
    const o = order!;
    const internal = env.EMAIL_REPLY_TO ? { owner: env.EMAIL_REPLY_TO, florist: env.EMAIL_REPLY_TO } : {};
    await sendAfterCommit(
      payload,
      buildOrderEmails(
        {
          orderId: o.id,
          orderNumber: String(o.orderNumber),
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          deliveryAddress: o.deliveryAddress,
          deliveryEmirate: o.deliveryEmirate,
          deliveryDate: new Date(o.deliveryDate).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Asia/Dubai",
          }),
          deliveryTimeSlot: o.deliveryTimeSlot,
          deliveryNotes: o.deliveryNotes || undefined,
          recipientName: o.recipientName || undefined,
          recipientPhone: o.recipientPhone || undefined,
          cardMessage: o.cardMessage || undefined,
          lines: (o.items ?? []).map((line) => ({
            productName: line.productName,
            quantity: line.quantity,
            options: describeOptions(line.selectedOptions),
          })),
          subtotalFils: o.subtotalFils,
          deliveryFeeFils: o.deliveryFeeFils,
          totalFils: o.totalFils,
        },
        internal,
      ),
    );
  } catch (error) {
    payload.logger.error(
      `order ${order!.orderNumber} paid, but its emails could not be queued: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  return "marked-paid";
}
