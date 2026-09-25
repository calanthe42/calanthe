/**
 * The "your flowers are being made" email, built from a saved order.
 *
 * WHY THIS IS NOT A COLLECTION HOOK — the short version of a long debugging
 * session. It began as an `afterChange` hook on Orders, then `afterOperation`.
 * Both run while Payload's transaction is still open, and `sendEmail` writes
 * a row to `email_log` through a SEPARATE connection. The outer transaction
 * held one connection while the inner write waited for another, and the
 * database ended it the only way it could:
 *
 *     error: terminating connection due to idle-in-transaction timeout
 *
 * It failed with the email provider disabled too, which is what ruled the
 * provider out and pointed at the nested write. A hook that writes to the
 * database through its own connection, inside someone else's transaction, is
 * a deadlock waiting for a slow day.
 *
 * So the send happens where checkout's already does: in the action, AFTER
 * the update has returned and the transaction has committed. Same rule,
 * same place, one fewer surprise.
 *
 * KNOWN GAP: a fulfilment status changed directly in Payload's own /cms does
 * not email, because that path does not run this. Staff work in /admin,
 * which does. Recorded in docs/OWNER_TODO.md rather than solved with a hook
 * that reintroduces the deadlock.
 */
import type { Payload } from "payload";
import { describeOptions } from "./order-emails";
import { sendEmail } from "./send";
import { isEmailableStatus, orderStatus } from "./templates";
import type { RecipientFacing } from "./types";

/** Turns a saved order document into the money-free facts an update needs. */
export function orderFactsFrom(doc: Record<string, unknown>): RecipientFacing {
  return {
    audience: "recipient",
    orderNumber: String(doc.orderNumber ?? ""),
    customerName: String(doc.customerName ?? ""),
    recipientName: doc.recipientName ? String(doc.recipientName) : undefined,
    deliveryDate: doc.deliveryDate
      ? new Date(String(doc.deliveryDate)).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : "",
    deliveryTimeSlot: String(doc.deliveryTimeSlot ?? ""),
    deliveryEmirate: String(doc.deliveryEmirate ?? ""),
    deliveryAddress: String(doc.deliveryAddress ?? ""),
    deliveryNotes: doc.deliveryNotes ? String(doc.deliveryNotes) : undefined,
    recipientPhone: doc.recipientPhone ? String(doc.recipientPhone) : undefined,
    cardMessage: doc.cardMessage ? String(doc.cardMessage) : undefined,
    lines: Array.isArray(doc.items)
      ? (doc.items as Record<string, unknown>[]).map((i) => ({
          productName: String(i.productName ?? ""),
          quantity: Number(i.quantity ?? 1),
          options: describeOptions(
            i.selectedOptions as { label?: string | null; value?: string | null }[] | null,
          ),
        }))
      : [],
  };
}

/**
 * Sends the status email if the move is one worth an email. Never throws:
 * a florist marking an order ready must not see an error because a provider
 * was slow.
 */
export async function sendStatusEmailAfterCommit(
  payload: Payload,
  doc: Record<string, unknown> | null,
  previousStatus: string,
  nextStatus: string,
): Promise<void> {
  if (!doc) return;
  if (!nextStatus || nextStatus === previousStatus) return;
  if (!isEmailableStatus(nextStatus)) return;

  const to = String(doc.customerEmail ?? "").trim();
  if (!to) return;

  try {
    await sendEmail(payload, {
      to,
      type: "order-status",
      rendered: orderStatus(orderFactsFrom(doc), nextStatus),
      orderId: doc.id as number,
      orderNumber: String(doc.orderNumber ?? ""),
    });
  } catch (error) {
    payload.logger.error(
      `order ${doc.orderNumber} moved to ${nextStatus}, but the status email could not be sent: ${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
  }
}
