"use server";

import { revalidatePath } from "next/cache";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { sendEmail } from "@backend/email/send";
import {
  floristJobSheet,
  orderConfirmation,
  orderStatus,
  ownerNewOrder,
  passwordReset,
  verifyAddress,
  isEmailableStatus,
} from "@backend/email/templates";
import { describeOptions } from "@backend/email/order-emails";
import type { EmailType, RecipientFacing, RenderedEmail } from "@backend/email/types";
import { env } from "@/lib/env";

export type ResendResult = { ok: true; status: string } | { ok: false; message: string };

/**
 * Send a logged email again.
 *
 * WHY IT RE-RENDERS RATHER THAN REPLAYS. The stored row keeps the subject
 * for the log, not the body — an email log that carried full HTML for every
 * message would be the largest table in the database within a season, and it
 * would freeze a customer's address and card message into a row that can
 * never be corrected. Rebuilding from the order means a resend reflects the
 * order as it stands now, which is what someone asking for one actually
 * wants.
 *
 * A RESEND WRITES A NEW ROW. The original is never touched: the history of
 * what was attempted, and when, is the reason the log exists.
 */
export async function resendLoggedEmail(id: string): Promise<ResendResult> {
  const payload = await getPayload({ config });

  /* Staff or owner only, checked against the real session rather than a
     hidden form field. */
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const role = (user as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "staff") {
    return { ok: false, message: "Only staff can resend an email." };
  }

  const original = (await payload
    .findByID({ collection: "email-log", id, depth: 0, overrideAccess: true })
    .catch(() => null)) as Record<string, unknown> | null;

  if (!original) return { ok: false, message: "That email is not in the log." };

  const type = String(original.type) as EmailType;
  const to = String(original.to);

  let rendered: RenderedEmail | null = null;
  let orderId: number | undefined;

  if (original.order) {
    const order = (await payload
      .findByID({
        collection: "orders",
        id: Number(original.order),
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)) as Record<string, unknown> | null;

    if (order) {
      orderId = Number(order.id);
      const facts: RecipientFacing = {
        audience: "recipient",
        orderNumber: String(order.orderNumber),
        customerName: String(order.customerName ?? ""),
        recipientName: order.recipientName ? String(order.recipientName) : undefined,
        deliveryDate: order.deliveryDate
          ? new Date(String(order.deliveryDate)).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          : "",
        deliveryTimeSlot: String(order.deliveryTimeSlot ?? ""),
        deliveryEmirate: String(order.deliveryEmirate ?? ""),
        deliveryAddress: String(order.deliveryAddress ?? ""),
        deliveryNotes: order.deliveryNotes ? String(order.deliveryNotes) : undefined,
        recipientPhone: order.recipientPhone ? String(order.recipientPhone) : undefined,
        cardMessage: order.cardMessage ? String(order.cardMessage) : undefined,
        lines: Array.isArray(order.items)
          ? order.items.map((i: Record<string, unknown>) => ({
              productName: String(i.productName ?? ""),
              quantity: Number(i.quantity ?? 1),
              options: describeOptions(
                i.selectedOptions as { label?: string | null; value?: string | null }[] | null,
              ),
            }))
          : [],
      };

      const priced = {
        ...facts,
        audience: "customer" as const,
        customerEmail: String(order.customerEmail ?? ""),
        customerPhone: String(order.customerPhone ?? ""),
        subtotal: { fils: Number(order.subtotalFils ?? 0), currency: "AED" as const },
        deliveryFee: { fils: Number(order.deliveryFeeFils ?? 0), currency: "AED" as const },
        total: { fils: Number(order.totalFils ?? 0), currency: "AED" as const },
      };

      if (type === "order-confirmation") rendered = orderConfirmation(priced);
      else if (type === "owner-new-order") rendered = ownerNewOrder({ ...priced, audience: "owner" });
      /* Still RecipientFacing — a resend cannot leak a price either. */
      else if (type === "florist-job-sheet") rendered = floristJobSheet({ ...facts, audience: "florist" });
      else if (type === "order-status") {
        const status = String(order.fulfilmentStatus ?? "");
        if (isEmailableStatus(status)) rendered = orderStatus(facts, status);
      }
    }
  }

  if (!rendered && (type === "verify-address" || type === "password-reset")) {
    /* These carry a one-time token that is deliberately not stored. Sending
       the old link again would send a dead one; the customer must ask for a
       fresh one from the site, which is the safer path anyway. */
    return {
      ok: false,
      message:
        "Verification and password-reset links are one-time and are not stored. Ask the customer to request a new one from the sign-in page.",
    };
  }

  if (!rendered) {
    return { ok: false, message: "This email cannot be rebuilt — its order no longer exists." };
  }

  const outcome = await sendEmail(
    payload,
    { to, type, rendered, orderId, orderNumber: original.orderNumber as string | undefined },
    { resentFrom: id },
  );

  revalidatePath("/admin/emails");
  return outcome.status === "sent"
    ? { ok: true, status: outcome.status }
    : { ok: false, message: outcome.error ?? `The email was ${outcome.status}.` };
}

/** Where owner and florist mail is going today, for the admin to display. */
export async function internalEmailDestination(): Promise<string | null> {
  return env.EMAIL_REPLY_TO ?? null;
}
