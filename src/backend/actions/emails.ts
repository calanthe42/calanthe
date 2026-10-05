"use server";

import { revalidatePath } from "next/cache";
import { getAdminI18n } from "@admin/i18n/server";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { internalAddresses } from "@backend/email/internal";
import { activeRole } from "@backend/payload/access";
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
import { buildQuotePaidEmails, quoteFactsFromOrder } from "@backend/email/quote-emails";
import { buildInvoice } from "@backend/domain/invoice";
import { isPayLinkSource, payLinkOrigin, payToken, payUrl } from "@backend/payments/pay-link";
import type { Order } from "@/payload-types";
import { BUSINESS } from "@/lib/business";
import { SITE_ORIGIN } from "@/lib/site";
import { resendPaymentRequest } from "./quotes";
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
  const role = activeRole(user);
  if (role !== "admin" && role !== "staff") {
    return { ok: false, message: (await getAdminI18n()).t("emailLog.errors.notStaff") };
  }

  const original = (await payload
    .findByID({ collection: "email-log", id, depth: 0, overrideAccess: true })
    .catch(() => null)) as Record<string, unknown> | null;

  if (!original) {
    return { ok: false, message: (await getAdminI18n()).t("emailLog.errors.notInLog") };
  }

  const type = String(original.type) as EmailType;
  const to = String(original.to);

  let rendered: RenderedEmail | null = null;
  let orderId: number | undefined;

  /* A PAYMENT REQUEST IS NOT REPLAYED, IT IS RE-ISSUED. Sending the old
     email again would send a link that may have expired. The quotes action
     extends the link, replaces a cancelled intent, throttles, and writes its
     own log row and activity entry — so this hands over to it entirely. */
  if (type === "payment-request") {
    const i18n = await getAdminI18n();
    if (!original.order) return { ok: false, message: i18n.t("emailLog.errors.orderGone") };
    const result = await resendPaymentRequest(Number(original.order));
    revalidatePath("/admin/emails");
    const said = i18n.resolve(result.code, result.vars, result.message);
    return result.ok && result.code === "actions.quote.resent"
      ? { ok: true, status: "sent" }
      : { ok: false, message: said };
  }

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
                i.selectedOptions as
                  { label?: string | null; value?: string | null }[] | null,
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
        deliveryFee: {
          fils: Number(order.deliveryFeeFils ?? 0),
          currency: "AED" as const,
        },
        total: { fils: Number(order.totalFils ?? 0), currency: "AED" as const },
      };

      if (type === "order-confirmation") rendered = orderConfirmation(priced);
      else if (type === "owner-new-order")
        rendered = ownerNewOrder({ ...priced, audience: "owner" });
      /* Still RecipientFacing — a resend cannot leak a price either. */
      else if (type === "florist-job-sheet")
        rendered = floristJobSheet({ ...facts, audience: "florist" });
      else if (type === "order-status") {
        const status = String(order.fulfilmentStatus ?? "");
        if (isEmailableStatus(status)) rendered = orderStatus(facts, status);
      } else if (type === "payment-received" || type === "owner-quote-paid") {
        /* Both carry the invoice, so both need one to exist: an order that
           has not been paid has nothing to thank anybody for. */
        const quote = order as unknown as Order;
        if (!isPayLinkSource(quote.source) || !quote.invoiceNumber) {
          return { ok: false, message: (await getAdminI18n()).t("emailLog.errors.notPaidYet") };
        }
        const locale = quote.locale === "ar" ? "ar" : "en";
        const origin = payLinkOrigin(SITE_ORIGIN, {
          env: process.env.VERCEL_ENV,
          branchUrl: process.env.VERCEL_BRANCH_URL,
        });
        rendered =
          buildQuotePaidEmails(
            {
              order: quoteFactsFromOrder(quote),
              invoice: buildInvoice(quote, BUSINESS),
              payUrl: quote.payTokenSalt
                ? payUrl(origin, payToken(env.PAYLOAD_SECRET, quote.payTokenSalt), locale)
                : origin,
              adminOrderUrl: `${origin}/admin/orders/${encodeURIComponent(String(quote.orderNumber))}`,
              locale,
            },
            /* Rebuilt for whoever the original went to. */
            { owner: to },
          ).find((request) => request.type === type)?.rendered ?? null;
      }
    }
  }

  if (!rendered && (type === "verify-address" || type === "password-reset")) {
    /* These carry a one-time token that is deliberately not stored. Sending
       the old link again would send a dead one; the customer must ask for a
       fresh one from the site, which is the safer path anyway. */
    return {
      ok: false,
      message: (await getAdminI18n()).t("emailLog.errors.oneTimeLinks"),
    };
  }

  if (!rendered) {
    return { ok: false, message: (await getAdminI18n()).t("emailLog.errors.orderGone") };
  }

  const outcome = await sendEmail(
    payload,
    {
      to,
      type,
      rendered,
      orderId,
      orderNumber: original.orderNumber as string | undefined,
    },
    { resentFrom: id },
  );

  revalidatePath("/admin/emails");
  if (outcome.status === "sent") return { ok: true, status: outcome.status };
  /* A provider's own error is evidence and is kept as it came; only the
     fallback sentence is ours to translate. */
  const i18n = await getAdminI18n();
  return {
    ok: false,
    message:
      outcome.error ??
      i18n.t("emailLog.errors.notSent", {
        status: i18n.label("emailStatus", outcome.status),
      }),
  };
}

/** Where owner and florist mail is going today, for the admin to display. */
export async function internalEmailDestination(): Promise<string | null> {
  const { owner, florist } = internalAddresses();
  return owner === florist ? owner : `${owner}, ${florist}`;
}
