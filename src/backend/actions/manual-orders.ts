"use server";

import { headers as nextHeaders } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import type { Order } from "@/payload-types";
import { recordActivity } from "@backend/activity/record";
import { dubaiDateInputValue } from "@backend/domain/dates";
import { buildInvoice, invoiceYear, vatIncludedFils } from "@backend/domain/invoice";
import {
  manualOrderData,
  parseManualOrderForm,
  type ManualProduct,
} from "@backend/domain/manual-order";
import {
  buildPaymentRequestEmail,
  buildQuotePaidEmails,
  quoteFactsFromOrder,
} from "@backend/email/quote-emails";
import { sendAfterCommit, sendEmail } from "@backend/email/send";
import { MANUAL_PAYMENT_CONTEXT } from "@backend/payload/hooks/orderIntegrity";
import { claimInvoice } from "@backend/payments/invoice-number";
import {
  MANUAL_SOURCE,
  OUTSIDE_PAYMENT_METHODS,
  hashPayToken,
  isSettled,
  newPayTokenSalt,
  payLinkExpiry,
  payLinkOrigin,
  payToken,
  payUrl,
  type OutsidePaymentMethod,
} from "@backend/payments/pay-link";
import { cardPaymentsConfigured, getStripe } from "@backend/payments/stripe";
import { BUSINESS, currentVatRateBps } from "@/lib/business";
import { timeSlots } from "@/lib/data";
import { env } from "@/lib/env";
import { formatFils } from "@/lib/money";
import { SITE_ORIGIN } from "@/lib/site";
import { actorOf, failure, type ActionResult } from "./admin-shared";

/**
 * Orders the shop writes by hand: a sale that arrived on WhatsApp, by phone
 * or in person, kept in the same order history as every website order.
 *
 * TWO WAYS SUCH AN ORDER IS PAID, and no third:
 *
 *   · by the customer, through its payment link — Stripe's signed webhook
 *     marks it paid, exactly as for a payment request (backend/payments/
 *     paid.ts);
 *   · outside the website — cash, bank transfer or the card machine —
 *     recorded here by the OWNER, never by staff, and named in the activity
 *     log.
 *
 * Either way the invoice number comes from the one gap-free counter
 * (claimInvoice), at the moment the order becomes paid.
 */

type Session = { payload: Payload; user: NonNullable<Awaited<ReturnType<Payload["auth"]>>["user"]> };

const PERMISSION: ActionResult = {
  ok: false,
  message: "You do not have permission to do that.",
  code: "actions.permission",
};
const OWNER_ONLY: ActionResult = {
  ok: false,
  message: "Only the owner can record a payment taken outside the website.",
  code: "actions.manual.ownerOnly",
};
const NOT_PAYABLE: ActionResult = {
  ok: false,
  message: "This order is already paid or cancelled.",
  code: "actions.manual.notPayable",
};
const CARD_IN_PROGRESS: ActionResult = {
  ok: false,
  message: "A card payment for this order is in progress or has just arrived. Check again in a minute.",
  code: "actions.manual.cardInProgress",
};

async function staffSession(): Promise<Session | null> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const role = (user as { role?: string } | null)?.role;
  if (!user || (role !== "admin" && role !== "staff")) return null;
  return { payload, user };
}

const isOwner = (user: Session["user"]): boolean => (user as { role?: string }).role === "admin";

function origin(): string {
  return payLinkOrigin(SITE_ORIGIN, {
    env: process.env.VERCEL_ENV,
    branchUrl: process.env.VERCEL_BRANCH_URL,
  });
}

function linkOf(order: Pick<Order, "payTokenSalt" | "locale">): string {
  const locale = order.locale === "ar" ? "ar" : "en";
  return order.payTokenSalt
    ? payUrl(origin(), payToken(env.PAYLOAD_SECRET, order.payTokenSalt), locale)
    : origin();
}

function refresh(orderNumber: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderNumber}`);
  revalidatePath("/admin/invoices");
  revalidatePath("/admin");
}

const METHOD_WORDS: Record<OutsidePaymentMethod, string> = {
  cash: "cash",
  "bank-transfer": "bank transfer",
  "card-machine": "card machine",
};

/**
 * Marks an admin-written order paid outside the website, issues its invoice
 * and sends the thank-you. The caller has already checked this is the owner.
 *
 * ORDER OF EVENTS. (1) Any card payment still open at Stripe is cancelled
 * first — if it cannot be cancelled, money is arriving by card and nothing
 * is recorded. (2) PAID, with the method, in one guarded write. (3) The
 * invoice number, from the same statement the webhook uses; only the caller
 * that issued it sends the emails.
 */
async function settleOutside(
  payload: Payload,
  user: Session["user"],
  order: Order,
  method: OutsidePaymentMethod,
  reference: string | undefined,
  now: Date,
): Promise<ActionResult> {
  const orderNumber = String(order.orderNumber ?? order.id);

  if (order.stripePaymentIntentId) {
    const stripe = getStripe();
    if (!stripe) return CARD_IN_PROGRESS;
    let cancelled = false;
    try {
      await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
      cancelled = true;
    } catch {
      const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId).catch(() => null);
      cancelled = intent?.status === "canceled";
    }
    if (!cancelled) return CARD_IN_PROGRESS;
  }

  const paidAtIso = now.toISOString();
  await payload.update({
    collection: "orders",
    id: order.id,
    overrideAccess: true,
    context: { [MANUAL_PAYMENT_CONTEXT]: true },
    data: {
      paymentStatus: "PAID",
      paymentMethod: method,
      ...(reference ? { paymentReference: reference } : {}),
      paidAt: paidAtIso,
      /* Paid means agreed: it goes straight to the florist's queue. */
      ...(order.fulfilmentStatus === "NEW" ? { fulfilmentStatus: "CONFIRMED" as const } : {}),
    },
  });

  const vatRateBps = currentVatRateBps();
  const vatFils = vatIncludedFils(order.totalFils, vatRateBps);
  const claim = await claimInvoice(payload, {
    orderId: order.id,
    year: invoiceYear(now),
    vatRateBps,
    vatIncludedFils: vatFils,
    paidAtIso,
  });

  await recordActivity(payload, {
    actor: actorOf(user),
    action: "status",
    area: "orders",
    collection: "orders",
    itemId: order.id,
    itemLabel: orderNumber,
    summary: `${orderNumber} recorded as paid by ${METHOD_WORDS[method]} — ${formatFils(order.totalFils)}${
      reference ? ` (${reference})` : ""
    }, invoice ${claim.invoiceNumber || "pending"}`,
    changes: [{ field: "paymentStatus", label: "payment", before: "PENDING", after: `PAID (${METHOD_WORDS[method]})` }],
  });

  if (claim.claimedNow) {
    try {
      const locale = order.locale === "ar" ? "ar" : "en";
      const paid = {
        ...order,
        paymentStatus: "PAID" as const,
        paymentMethod: method,
        invoiceNumber: claim.invoiceNumber,
        paidAt: paidAtIso,
        vatRateBps,
        vatIncludedFils: vatFils,
      };
      const internal = env.EMAIL_REPLY_TO ? { owner: env.EMAIL_REPLY_TO, florist: env.EMAIL_REPLY_TO } : {};
      const requests = buildQuotePaidEmails(
        {
          order: quoteFactsFromOrder(paid),
          invoice: buildInvoice(paid, BUSINESS),
          payUrl: linkOf(order),
          adminOrderUrl: `${origin()}/admin/orders/${encodeURIComponent(orderNumber)}`,
          locale,
        },
        internal,
      );
      /* A customer who gave no email gets no email; the owner still does. */
      await sendAfterCommit(
        payload,
        requests.filter((request) => request.to.trim() !== ""),
      );
    } catch (error) {
      payload.logger.error(
        `order ${orderNumber} recorded as paid, but its emails could not be queued: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }
  }

  refresh(orderNumber);
  return {
    ok: true,
    message: `Recorded as paid. Invoice ${claim.invoiceNumber}.`,
    code: "actions.manual.recorded",
    vars: { invoice: claim.invoiceNumber, number: orderNumber },
    id: order.id,
  };
}

/**
 * Create an order — and with it its invoice — by hand.
 *
 * The form says how the customer is paying: "unpaid" keeps the order waiting
 * on its payment link (optionally emailed now, with one Pay button); a
 * method records it as paid outside the website straight away, which only
 * the owner may do.
 */
export async function createManualOrder(form: FormData): Promise<ActionResult> {
  const session = await staffSession();
  if (!session) return PERMISSION;
  const { payload, user } = session;

  try {
    const now = new Date();
    const parsed = parseManualOrderForm(form, {
      todayDubai: dubaiDateInputValue(now.toISOString()),
      slots: timeSlots,
    });
    if (parsed.payment !== "unpaid" && !isOwner(user)) return OWNER_ONLY;

    const ids = [...new Set(parsed.lines.flatMap((line) => (line.productId ? [line.productId] : [])))];
    const products = new Map<number, ManualProduct>();
    if (ids.length > 0) {
      const found = await payload.find({
        collection: "products",
        where: { id: { in: ids } },
        limit: ids.length,
        depth: 0,
        overrideAccess: true,
        select: { name: true, slug: true },
      });
      for (const product of found.docs) {
        products.set(product.id, { id: product.id, name: product.name, slug: product.slug });
      }
    }

    const salt = newPayTokenSalt();
    const token = payToken(env.PAYLOAD_SECRET, salt);
    const expiresAt = payLinkExpiry(now);

    const order = await payload.create({
      collection: "orders",
      overrideAccess: true,
      data: manualOrderData(parsed, products, {
        salt,
        tokenHash: hashPayToken(token),
        expiresAt,
        staffId: Number((user as { id?: number }).id) || undefined,
      }),
    });
    const orderNumber = String(order.orderNumber ?? order.id);
    const amount = formatFils(order.totalFils);

    await recordActivity(payload, {
      actor: actorOf(user),
      action: "create",
      area: "orders",
      collection: "orders",
      itemId: order.id,
      itemLabel: orderNumber,
      summary: `Order ${orderNumber} written by hand (${parsed.salesChannel}) — ${amount} for ${order.customerName}`,
      changes: [{ field: "totalFils", label: "amount", after: amount }],
    });

    if (parsed.payment !== "unpaid") {
      const settled = await settleOutside(payload, user, order, parsed.payment, parsed.paymentReference, now);
      if (!settled.ok) {
        /* The order exists; only the payment could not be recorded. Say so
           rather than pretend nothing was saved. */
        refresh(orderNumber);
        return {
          ok: true,
          message: `Order ${orderNumber} saved, but the payment was not recorded. Open the order and record it there.`,
          code: "actions.manual.savedPaymentNotRecorded",
          vars: { number: orderNumber },
          id: order.id,
        };
      }
      return {
        ok: true,
        message: `Order ${orderNumber} saved and recorded as paid.`,
        code: "actions.manual.createdPaid",
        vars: { number: orderNumber, invoice: settled.vars?.invoice ?? "" },
        id: order.id,
      };
    }

    let emailed = false;
    if (parsed.sendEmail && order.customerEmail && getStripe() && cardPaymentsConfigured()) {
      const locale = order.locale === "ar" ? "ar" : "en";
      const outcome = await sendEmail(
        payload,
        buildPaymentRequestEmail({
          order: quoteFactsFromOrder(order),
          payUrl: payUrl(origin(), token, locale),
          expiresAt,
          locale,
        }),
      );
      emailed = outcome.status === "sent";
    }

    refresh(orderNumber);
    return emailed
      ? {
          ok: true,
          message: `Order ${orderNumber} saved. Invoice and pay button sent to ${order.customerEmail}.`,
          code: "actions.manual.createdSent",
          vars: { number: orderNumber, email: order.customerEmail },
          id: order.id,
        }
      : {
          ok: true,
          message: `Order ${orderNumber} saved. Share its payment link, or record the payment.`,
          code: "actions.manual.created",
          vars: { number: orderNumber },
          id: order.id,
        };
  } catch (error) {
    return failure(error, "The order could not be saved.", "actions.manual.failed");
  }
}

/** The owner records that an admin-written order was paid outside the website. */
export async function recordOutsidePayment(orderId: number, form: FormData): Promise<ActionResult> {
  const session = await staffSession();
  if (!session) return PERMISSION;
  const { payload, user } = session;
  if (!isOwner(user)) return OWNER_ONLY;

  try {
    const method = String(form.get("method") ?? "");
    if (!(OUTSIDE_PAYMENT_METHODS as readonly string[]).includes(method)) {
      return {
        ok: false,
        message: "Choose how the customer paid.",
        code: "actions.validation.paymentMethod",
      };
    }
    const reference = String(form.get("reference") ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);

    const order = await payload
      .findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
      .catch(() => null);
    if (!order || order.source !== MANUAL_SOURCE) return NOT_PAYABLE;
    if (isSettled(order.paymentStatus) || order.fulfilmentStatus === "CANCELLED") return NOT_PAYABLE;

    return await settleOutside(
      payload,
      user,
      order,
      method as OutsidePaymentMethod,
      reference || undefined,
      new Date(),
    );
  } catch (error) {
    return failure(error, "The payment could not be recorded.", "actions.manual.recordFailed");
  }
}
