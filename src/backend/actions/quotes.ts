"use server";

import { headers as nextHeaders } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import type { Order } from "@/payload-types";
import { recordActivity } from "@backend/activity/record";
import { dubaiDateInputValue } from "@backend/domain/dates";
import {
  isQuotableEnquiry,
  parseQuoteForm,
  quoteCustomerId,
  quoteOrderData,
  type QuoteEnquiry,
} from "@backend/domain/quote";
import { buildPaymentRequestEmail, quoteFactsFromOrder } from "@backend/email/quote-emails";
import { sendEmail } from "@backend/email/send";
import type { SendOutcome } from "@backend/email/types";
import { QUOTE_CANCEL_REVERT_CONTEXT } from "@backend/payload/hooks/orderIntegrity";
import { ensureOrderPaymentIntent } from "@backend/payments/intent";
import {
  QUOTE_SOURCE,
  hashPayToken,
  isSettled,
  newPayTokenSalt,
  payLinkExpiry,
  payLinkOrigin,
  payRequestState,
  payToken,
  payUrl,
} from "@backend/payments/pay-link";
import { cardPaymentsConfigured, getStripe } from "@backend/payments/stripe";
import { LIMITS, throttle } from "@backend/security/throttle";
import { timeSlots } from "@/lib/data";
import { env } from "@/lib/env";
import { formatFils } from "@/lib/money";
import { SITE_ORIGIN } from "@/lib/site";
import { actorOf, failure, type ActionResult } from "./admin-shared";

/**
 * Payment requests: confirm an enquiry, resend its link, cancel it.
 *
 * THE SECOND DOCUMENTED overrideAccess EXCEPTION (the first is
 * actions/checkout.ts). `orders.create` is owner-only by collection rule —
 * staff do not invent orders by hand. But the owner has decided that a
 * florist may confirm an enquiry and ask for payment, and that creates an
 * order. So this file, and only this file, creates one on a staff member's
 * behalf. It is safe for the reasons checkout's exception is safe, plus one:
 *
 *   · the caller is an authenticated owner or staff session, checked against
 *     Payload's own auth on every action — never a hidden field;
 *   · every amount is parsed and bounded on the server (backend/domain/
 *     quote.ts) and then frozen by the order's own field access;
 *   · the collection re-checks the shape of what is written
 *     (validateBespokeLines), whoever writes it;
 *   · who confirmed what, for how much, is named in the activity log, which
 *     is the owner's control over a power she has chosen to share.
 *
 * The other overrideAccess writes here touch only server-only fields — the
 * link's hash and expiry — which no role can write through the API at all.
 * Every write that CAN run as the signed-in person does.
 *
 * NO PAYMENT IS TAKEN HERE AND NOTHING IS MARKED PAID. Confirming creates a
 * PENDING order and sends a link. The PaymentIntent is created when the
 * customer presses pay, and only Stripe's signed webhook marks the order
 * paid (backend/payments/paid.ts).
 *
 * EMAILS ARE SENT AFTER THE WRITES HAVE RETURNED, never inside a hook — see
 * backend/email/status-email.ts for what happens otherwise.
 */

type Session = { payload: Payload; user: NonNullable<Awaited<ReturnType<Payload["auth"]>>["user"]> };

const PERMISSION: ActionResult = {
  ok: false,
  message: "You do not have permission to do that.",
  code: "actions.permission",
};

/** Owner or staff, by the real session. Anything else gets nothing. */
async function staffSession(): Promise<Session | null> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const role = (user as { role?: string } | null)?.role;
  if (!user || (role !== "admin" && role !== "staff")) return null;
  return { payload, user };
}

const relationId = (value: number | { id: number } | null | undefined): number | undefined =>
  typeof value === "number" ? value : value?.id;

function linkFor(order: Pick<Order, "payTokenSalt" | "locale">): { token: string; url: string } | null {
  if (!order.payTokenSalt) return null;
  const token = payToken(env.PAYLOAD_SECRET, order.payTokenSalt);
  const origin = payLinkOrigin(SITE_ORIGIN, {
    env: process.env.VERCEL_ENV,
    branchUrl: process.env.VERCEL_BRANCH_URL,
  });
  return { token, url: payUrl(origin, token, order.locale === "ar" ? "ar" : "en") };
}

function refresh(order: Pick<Order, "enquiry">): void {
  const enquiryId = relationId(order.enquiry);
  revalidatePath("/admin/enquiries");
  if (enquiryId) revalidatePath(`/admin/enquiries/${enquiryId}`);
  revalidatePath("/admin/orders");
  /* By pattern: orders are routed by number, these actions receive an id. */
  revalidatePath("/admin/orders/[orderNumber]", "page");
  revalidatePath("/admin");
}

/** Is this the database refusing a second live request for one enquiry? */
function isDuplicateQuote(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : "";
  const details = (error as { data?: { errors?: { message?: unknown; path?: unknown }[] } } | null)?.data
    ?.errors;
  const detail = Array.isArray(details)
    ? details.map((d) => `${String(d.message ?? "")} ${String(d.path ?? "")}`).join(" ")
    : "";
  return /unique|duplicate|orders_one_live_quote_per_enquiry/i.test(`${raw} ${detail}`);
}

const ALREADY_CONFIRMED: ActionResult = {
  ok: false,
  message: "This enquiry already has a payment request. Cancel it first to send a new amount.",
  code: "actions.quote.alreadyConfirmed",
};

/* ------------------------------------------------------------------ */
/* Confirm                                                             */
/* ------------------------------------------------------------------ */

/**
 * Confirm an enquiry and email the customer a link to pay.
 *
 * Form fields are listed at parseQuoteForm. The amount and the email address
 * are read from the form — the address so that a typo on the enquiry can be
 * corrected here, before money is asked for at it.
 */
export async function confirmEnquiryQuote(enquiryId: number, form: FormData): Promise<ActionResult> {
  const session = await staffSession();
  if (!session) return PERMISSION;
  const { payload, user } = session;

  try {
    /* As the signed-in person: staff may read the whole queue, and a
       customer session never reaches this line. */
    const enquiry = (await payload.findByID({
      collection: "enquiries",
      id: enquiryId,
      depth: 1,
      user,
      overrideAccess: false,
    })) as unknown as QuoteEnquiry;

    if (!isQuotableEnquiry(enquiry)) {
      return {
        ok: false,
        message: "This kind of enquiry cannot be sent a payment request.",
        code: "actions.quote.notQuotable",
      };
    }

    /* Never create an order nobody can pay. */
    if (!getStripe() || !cardPaymentsConfigured()) {
      return {
        ok: false,
        message: "Card payments are not set up on this site yet.",
        code: "actions.quote.paymentsOff",
      };
    }

    const now = new Date();
    const parsed = parseQuoteForm(form, {
      todayDubai: dubaiDateInputValue(now.toISOString()),
      slots: timeSlots,
    });

    /* The friendly answer to "already sent". The partial unique index is the
       real guard: it also stops two people pressing the button at once. */
    const live = await payload.count({
      collection: "orders",
      where: {
        and: [{ enquiry: { equals: enquiryId } }, { fulfilmentStatus: { not_equals: "CANCELLED" } }],
      },
      overrideAccess: true,
    });
    if (live.totalDocs > 0) return ALREADY_CONFIRMED;

    const salt = newPayTokenSalt();
    const token = payToken(env.PAYLOAD_SECRET, salt);
    const expiresAt = payLinkExpiry(now);

    let order: Order;
    try {
      order = await payload.create({
        collection: "orders",
        /* See the note at the top of this file. */
        overrideAccess: true,
        data: quoteOrderData(enquiry, parsed, {
          customerId: quoteCustomerId(enquiry),
          salt,
          tokenHash: hashPayToken(token),
          expiresAt,
        }),
      });
    } catch (error) {
      if (isDuplicateQuote(error)) return ALREADY_CONFIRMED;
      throw error;
    }

    const orderNumber = String(order.orderNumber ?? order.id);
    const amount = formatFils(order.totalFils);

    /* From here on the order EXISTS and can be paid, so nothing below may
       stop the customer — or the florist — from finding out. The enquiry
       update is bookkeeping: if it fails it is logged, and the email still
       goes. */
    try {
      await payload.update({
        collection: "enquiries",
        id: enquiryId,
        user,
        overrideAccess: false,
        data: { status: "QUOTED", lastContactedAt: now.toISOString(), lastContactMethod: "EMAIL" },
      });
    } catch (error) {
      payload.logger.error(
        `payment request ${orderNumber} created, but enquiry ${enquiryId} could not be updated: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }

    const locale = order.locale === "ar" ? "ar" : "en";
    const origin = payLinkOrigin(SITE_ORIGIN, {
      env: process.env.VERCEL_ENV,
      branchUrl: process.env.VERCEL_BRANCH_URL,
    });
    const outcome = await sendEmail(
      payload,
      buildPaymentRequestEmail({
        order: quoteFactsFromOrder(order),
        payUrl: payUrl(origin, token, locale),
        expiresAt,
        locale,
      }),
    );

    /* This is how the owner sees who asked whom for how much. */
    await recordActivity(payload, {
      actor: actorOf(user),
      action: "create",
      area: "orders",
      collection: "orders",
      itemId: order.id,
      itemLabel: orderNumber,
      summary: `Payment request ${orderNumber} — ${amount} sent to ${order.customerEmail} (enquiry ${
        enquiry.enquiryNumber ?? enquiryId
      })`,
      changes: [{ field: "totalFils", label: "amount", after: amount }],
    });

    refresh(order);

    if (outcome.status !== "sent") {
      /* Still a success — the request exists — but staff must know to copy
         the link and send it themselves. */
      return {
        ok: true,
        message: "Confirmed, but the email was not sent. Copy the payment link and send it yourself.",
        code: "actions.quote.confirmedEmailNotSent",
        id: order.id,
      };
    }
    return {
      ok: true,
      message: `Confirmed. Payment link sent to ${order.customerEmail}.`,
      code: "actions.quote.confirmed",
      vars: { email: order.customerEmail },
      id: order.id,
    };
  } catch (error) {
    return failure(error, "The payment request could not be created.", "actions.quote.failed");
  }
}

/* ------------------------------------------------------------------ */
/* Resend                                                              */
/* ------------------------------------------------------------------ */

const NOT_AWAITING: ActionResult = {
  ok: false,
  message: "This request is already paid or cancelled.",
  code: "actions.quote.notAwaiting",
};

const PAYMENT_IN_PROGRESS: ActionResult = {
  ok: false,
  message: "A payment is in progress or has just been received, so this cannot be cancelled.",
  code: "actions.quote.paymentInProgress",
};

/** The order behind a request, with its server-only fields. Session first. */
async function loadQuoteOrder(payload: Payload, orderId: number): Promise<Order | null> {
  const order = await payload
    .findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
    .catch(() => null);
  return order && order.source === QUOTE_SOURCE ? order : null;
}

/**
 * Send the payment email again, and make the link good for another week.
 *
 * The SAME link: the token is rebuilt from the stored salt, so the email
 * already in the customer's inbox keeps working too. If PAYLOAD_SECRET has
 * been rotated since, the old link is already dead; the new hash is stored
 * and this email carries the working one.
 */
export async function resendPaymentRequest(orderId: number): Promise<ActionResult> {
  const session = await staffSession();
  if (!session) return PERMISSION;
  const { payload, user } = session;

  try {
    const order = await loadQuoteOrder(payload, orderId);
    if (!order) return NOT_AWAITING;

    const now = new Date();
    const state = payRequestState(order, now);
    if (state !== "awaiting" && state !== "expired") return NOT_AWAITING;

    const sends = await throttle(LIMITS.payResend, `order-${order.id}`);
    if (!sends.allowed) {
      return {
        ok: false,
        message: "That was sent a moment ago. Please wait before sending again.",
        code: "actions.quote.tooOften",
      };
    }

    const link = linkFor(order);
    if (!link) return NOT_AWAITING;

    /* If the customer already pressed pay, the order holds an intent. A
       cancelled one is replaced here — by a florist, deliberately — and
       nowhere else; one that is being paid means there is nothing to resend. */
    if (order.stripePaymentIntentId) {
      const stripe = getStripe();
      if (!stripe || !cardPaymentsConfigured()) {
        return {
          ok: false,
          message: "Card payments are not set up on this site yet.",
          code: "actions.quote.paymentsOff",
        };
      }
      const intent = await ensureOrderPaymentIntent(payload, stripe, order, { replaceCanceled: true });
      if (intent.kind === "processing") return PAYMENT_IN_PROGRESS;
      if (intent.kind === "failed") {
        return {
          ok: false,
          message: "The payment request could not be created.",
          code: "actions.quote.failed",
        };
      }
    }

    const extended = payLinkExpiry(now);
    const current = order.payLinkExpiresAt ? new Date(order.payLinkExpiresAt) : null;
    const expiresAt = current && current.getTime() > extended.getTime() ? current : extended;
    const hash = hashPayToken(link.token);

    await payload.update({
      collection: "orders",
      id: order.id,
      /* Server-only fields: only these two, and no role can write them. */
      overrideAccess: true,
      data: {
        payLinkExpiresAt: expiresAt.toISOString(),
        ...(hash !== order.payTokenHash ? { payTokenHash: hash } : {}),
      },
    });

    const outcome = await sendEmail(
      payload,
      buildPaymentRequestEmail({
        order: quoteFactsFromOrder(order),
        payUrl: link.url,
        expiresAt,
        locale: order.locale === "ar" ? "ar" : "en",
        reminder: true,
      }),
    );

    const orderNumber = String(order.orderNumber ?? order.id);
    await recordActivity(payload, {
      actor: actorOf(user),
      action: "email",
      area: "orders",
      collection: "orders",
      itemId: order.id,
      itemLabel: orderNumber,
      summary: `Payment link for ${orderNumber} sent again to ${order.customerEmail}`,
    });

    const enquiryId = relationId(order.enquiry);
    if (enquiryId) {
      await noteContact(payload, user, enquiryId, now);
    }

    refresh(order);
    return resendResult(outcome);
  } catch (error) {
    return failure(error, "The payment link could not be sent again.", "actions.quote.resendFailed");
  }
}

function resendResult(outcome: SendOutcome): ActionResult {
  if (outcome.status !== "sent") {
    return {
      ok: true,
      message: "The link is valid again, but the email was not sent. Copy the payment link and send it yourself.",
      code: "actions.quote.renewedEmailNotSent",
    };
  }
  return { ok: true, message: "Payment link sent again.", code: "actions.quote.resent" };
}

async function noteContact(
  payload: Payload,
  user: Session["user"],
  enquiryId: number,
  now: Date,
): Promise<void> {
  try {
    await payload.update({
      collection: "enquiries",
      id: enquiryId,
      user,
      overrideAccess: false,
      data: { lastContactedAt: now.toISOString(), lastContactMethod: "EMAIL" },
    });
  } catch (error) {
    payload.logger.error(
      `enquiry ${enquiryId}: last-contact could not be recorded: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Cancel                                                              */
/* ------------------------------------------------------------------ */

/**
 * Cancel an unpaid payment request.
 *
 * THE ORDER OF THE STEPS IS THE SAFETY, so it is spelled out:
 *
 *   1. Mark the order CANCELLED. From this instant the pay page refuses to
 *      start a payment, so no NEW intent can be handed to the customer.
 *   2. Read the order again, to see the intent id as it is NOW — the
 *      customer may have pressed pay a moment ago.
 *   3. Cancel that intent at Stripe.
 *   4. If Stripe refuses because the customer is paying or has paid, put the
 *      order back exactly as it was and say so. Nothing has been cancelled.
 *
 * Done the other way round — intent first, status second — there is a window
 * in which the request still looks payable with a cancelled intent, the pay
 * page mints a replacement, and the customer ends up holding a way to pay
 * for an order the florist believes is dead. "Confirm again" would then give
 * them a second one. (The pay action closes the same window from its own
 * side; see startQuotePayment.)
 *
 * No email is sent to the customer: the link simply says "cancelled".
 */
export async function cancelPaymentRequest(orderId: number): Promise<ActionResult> {
  const session = await staffSession();
  if (!session) return PERMISSION;
  const { payload, user } = session;

  try {
    const order = await loadQuoteOrder(payload, orderId);
    if (!order) return NOT_AWAITING;

    const state = payRequestState(order, new Date());
    if (state !== "awaiting" && state !== "expired") return NOT_AWAITING;

    const previousStatus = order.fulfilmentStatus;
    const orderNumber = String(order.orderNumber ?? order.id);

    /* 1 — as the signed-in person: fulfilment is the one thing staff own. */
    await payload.update({
      collection: "orders",
      id: order.id,
      user,
      overrideAccess: false,
      data: { fulfilmentStatus: "CANCELLED" },
    });

    /* Put the request back the way it was. The webhook may have confirmed a
       payment in the meantime, in which case the order is PAID and belongs
       at CONFIRMED, not at whatever it was before. */
    const restore = async (paid: boolean): Promise<void> => {
      await payload.update({
        collection: "orders",
        id: order.id,
        overrideAccess: true,
        context: { [QUOTE_CANCEL_REVERT_CONTEXT]: true },
        data: { fulfilmentStatus: paid ? "CONFIRMED" : previousStatus },
      });
      refresh(order);
    };

    /* 2 */
    const fresh = await payload.findByID({
      collection: "orders",
      id: order.id,
      depth: 0,
      overrideAccess: true,
    });
    if (isSettled(fresh.paymentStatus)) {
      await restore(true);
      return PAYMENT_IN_PROGRESS;
    }

    /* 3 */
    if (fresh.stripePaymentIntentId) {
      const stripe = getStripe();
      let cancelled = false;
      if (stripe) {
        try {
          await stripe.paymentIntents.cancel(fresh.stripePaymentIntentId);
          cancelled = true;
        } catch {
          /* Stripe refuses to cancel an intent that is processing or has
             succeeded — and one that is already cancelled. Ask which. */
          const intent = await stripe.paymentIntents
            .retrieve(fresh.stripePaymentIntentId)
            .catch(() => null);
          cancelled = intent?.status === "canceled";
        }
      }
      /* 4 — not provably dead, so the request is NOT cancelled. */
      if (!cancelled) {
        await restore(false);
        return PAYMENT_IN_PROGRESS;
      }
    }

    /* The enquiry goes back into the queue, unless someone has already moved
       it on by hand. */
    const enquiryId = relationId(order.enquiry);
    if (enquiryId) {
      try {
        const enquiry = await payload.findByID({
          collection: "enquiries",
          id: enquiryId,
          depth: 0,
          user,
          overrideAccess: false,
        });
        if (enquiry.status === "QUOTED") {
          await payload.update({
            collection: "enquiries",
            id: enquiryId,
            user,
            overrideAccess: false,
            data: { status: "IN_REVIEW" },
          });
        }
      } catch (error) {
        payload.logger.error(
          `${orderNumber} cancelled, but enquiry ${enquiryId} could not be reopened: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        );
      }
    }

    await recordActivity(payload, {
      actor: actorOf(user),
      action: "status",
      area: "orders",
      collection: "orders",
      itemId: order.id,
      itemLabel: orderNumber,
      changes: [
        { field: "fulfilmentStatus", label: "status", before: String(previousStatus), after: "CANCELLED" },
      ],
      summary: `${orderNumber} payment request cancelled`,
    });

    refresh(order);
    return { ok: true, message: "Payment request cancelled.", code: "actions.quote.cancelled" };
  } catch (error) {
    return failure(error, "The payment request could not be cancelled.", "actions.quote.cancelFailed");
  }
}
