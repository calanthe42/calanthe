import type { CollectionAfterChangeHook } from "payload";
import { sendEmail } from "@backend/email/send";
import { isEmailableStatus, orderStatus } from "@backend/email/templates";
import { describeOptions } from "@backend/email/order-emails";
import type { RecipientFacing } from "@backend/email/types";

/**
 * Tells the customer when their order moves.
 *
 * WHY afterChange AND NOT beforeChange. The email must describe something
 * that has actually happened. A beforeChange send can announce a status that
 * a later validation then rejects, and the customer is told their flowers
 * are on the way when nothing moved.
 *
 * ONLY ON A REAL TRANSITION. Payload runs afterChange on every save, so
 * comparing against `previousDoc` is what stops an unrelated edit — a staff
 * note, a corrected phone number — from emailing the customer again about a
 * status that has not changed. Saving the same status twice sends nothing.
 *
 * NEVER FAILS THE SAVE. `sendEmail` has no throwing path, and this is
 * wrapped anyway: staff moving an order to "out for delivery" must not see
 * an error because Resend had a bad minute. The attempt is in the email log
 * either way, with a resend button beside it.
 */
export const sendOrderStatusEmail: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== "update") return doc;

  const next = String(doc?.fulfilmentStatus ?? "");
  const previous = String(previousDoc?.fulfilmentStatus ?? "");
  if (!next || next === previous) return doc;
  if (!isEmailableStatus(next)) return doc;

  const to = String(doc?.customerEmail ?? "").trim();
  if (!to) return doc;

  try {
    /* Typed RecipientFacing: a status update carries no money, and the type
       makes that true rather than remembered. */
    const facts: RecipientFacing = {
      audience: "recipient",
      orderNumber: String(doc.orderNumber),
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
      lines: Array.isArray(doc.items)
        ? doc.items.map((i: Record<string, unknown>) => ({
            productName: String(i.productName ?? ""),
            quantity: Number(i.quantity ?? 1),
            options: describeOptions(
              i.selectedOptions as { label?: string | null; value?: string | null }[] | null,
            ),
          }))
        : [],
    };

    await sendEmail(req.payload, {
      to,
      type: "order-status",
      rendered: orderStatus(facts, next),
      orderId: doc.id as number,
      orderNumber: String(doc.orderNumber),
    });
  } catch (error) {
    req.payload.logger.error(
      `order ${doc?.orderNumber} moved to ${next}, but the status email could not be sent: ${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
  }

  return doc;
};
