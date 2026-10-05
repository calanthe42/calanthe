import "server-only";
import type Stripe from "stripe";
import type { Payload } from "payload";
import { saleSavingsOfItems } from "@backend/domain/checkout-order";
import { buildInvoice, invoiceYear, vatIncludedFils } from "@backend/domain/invoice";
import { buildOrderEmails, describeOptions } from "@backend/email/order-emails";
import { buildQuotePaidEmails, quoteFactsFromOrder } from "@backend/email/quote-emails";
import { sendAfterCommit } from "@backend/email/send";
import { PAYMENT_PROVIDER_CONTEXT } from "@backend/payload/hooks/orderIntegrity";
import { BUSINESS, currentVatRateBps } from "@/lib/business";
import { DISCOUNT_HOLD_MINUTES } from "@/lib/discounts";
import { env } from "@/lib/env";
import { SITE_ORIGIN } from "@/lib/site";
import { claimInvoice, type ClaimInvoice } from "./invoice-number";
import { QUOTE_SOURCE, payLinkOrigin, payToken, payUrl } from "./pay-link";
import { redeemCoupon, type RedeemCoupon } from "./redeem";
import { paymentVerdict } from "./verdict";

type OrderDoc = {
  id: number;
  orderNumber: string | number;
  totalFils: number;
  subtotalFils: number;
  deliveryFeeFils: number;
  discountFils?: number | null;
  couponCode?: string | null;
  couponDiscountFils?: number | null;
  couponDiscount?: number | { id: number } | null;
  couponRedeemedAt?: string | null;
  discountSnapshot?: unknown;
  createdAt?: string | null;
  paymentStatus: string;
  fulfilmentStatus?: string | null;
  source?: string | null;
  enquiry?: number | { id: number } | null;
  locale?: "en" | "ar" | null;
  invoiceNumber?: string | null;
  paidAt?: string | null;
  stripePaymentIntentId?: string | null;
  payTokenSalt?: string | null;
  customerNote?: string | null;
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
  items?:
    | {
        productName: string;
        quantity: number;
        unitPriceFils: number;
        lineTotalFils: number;
        /** The regular unit price, when the line was sold on a sale. */
        compareAtUnitPriceFils?: number | null;
        selectedOptions?: { label?: string | null; value?: string | null }[] | null;
      }[]
    | null;
};

/** Injected in tests; the real ones in production. */
export type PaidDeps = {
  claimInvoice: ClaimInvoice;
  now: () => Date;
  /** Optional so callers written before discounts keep working. */
  redeemCoupon?: RedeemCoupon;
};

const DEFAULT_DEPS: PaidDeps = { claimInvoice, redeemCoupon, now: () => new Date() };

/**
 * How long after a payment Stripe may still be retrying its webhook. A
 * delivery inside this window that finds the order PAID but without an
 * invoice is OUR crash being healed; one outside it is somebody pressing
 * "resend" on an old event in the Stripe dashboard.
 */
const RETRY_HORIZON_MS = 72 * 3_600_000;

/** Written on the order where staff will see it. */
export const PAID_AFTER_CANCEL_NOTE =
  "⚠ PAID AFTER CANCELLATION — refund this payment in Stripe. Do not reinstate the order.";

/** The code was counted past its limit. The order is honoured; the owner is told. */
export const overLimitNote = (code: string): string =>
  `⚠ DISCOUNT CHECK: code ${code} was redeemed past its limit.`;

/** A discounted price was paid after the time it is held for. */
export const LATE_DISCOUNT_NOTE =
  "⚠ DISCOUNT CHECK: this discounted order was paid after its price hold ended — check the discount was still running.";

const appendNote = (existing: string | null | undefined, line: string): string =>
  `${existing ? `${existing}\n` : ""}${line}`.slice(0, 8000);

const relationId = (value: number | { id: number } | null | undefined): number | undefined =>
  typeof value === "number" ? value : value?.id;

/**
 * Apply a signed `payment_intent.succeeded` to its order — the ONLY path that
 * marks an order paid (docs/PAYMENTS.md §2).
 *
 * THE SEQUENCE, written down once because two features share it:
 *
 *   1. verdict            is this intent, for this order, for this amount?
 *   2. PAID               one write, under the payment-provider context
 *   3. redeemCoupon       counts the discount code as used — its own
 *                         exactly-once claim, its own try/catch; runs for the
 *                         winner and for a recovering retry alike
 *   4. claimInvoice       gap-free number AND the single-winner gate
 *   5. emails             the winner of step 4 only
 *
 * IDEMPOTENT, AND SAFE UNDER CONCURRENCY. Stripe retries for days and can
 * deliver the same event twice at once. Both deliveries may pass the verdict
 * and both may write PAID — harmless, it is the same value. Only one can win
 * `claimInvoice`, and only the winner sends anything. Before this gate
 * existed, two deliveries meant two sets of emails.
 *
 * SELF-HEALING. A crash between step 2 and step 4 leaves an order PAID with
 * no invoice. Stripe's retry then arrives as "already paid", and instead of
 * returning early it carries on from step 3 and finishes the job. A throw
 * from `claimInvoice` propagates on purpose: the route answers 500 and
 * Stripe tries again.
 *
 * The emails are sent here, after the writes, because a card order is not
 * confirmed to anyone until the money is.
 */
export async function applySucceededIntent(
  payload: Payload,
  intent: Stripe.PaymentIntent,
  deps: PaidDeps = DEFAULT_DEPS,
): Promise<string> {
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
    order
      ? {
          id: order.id,
          totalFils: order.totalFils,
          paymentStatus: order.paymentStatus,
          orderNumber: order.orderNumber,
          stripePaymentIntentId: order.stripePaymentIntentId,
        }
      : null,
  );

  if (verdict.action === "ignore") return verdict.action;

  if (verdict.action === "flag") {
    /* Money was captured but something disagrees. Never roll back; tell a
       human, on the order itself where staff will see it. */
    payload.logger.error(`stripe: ${verdict.reason}`);
    const line = `⚠ PAYMENT CHECK: ${verdict.reason}`;
    /* Stripe may deliver the same event again; say it once. */
    if (order && !(order.internalNotes ?? "").includes(line)) {
      await payload.update({
        collection: "orders",
        id: order.id,
        overrideAccess: true,
        data: { internalNotes: appendNote(order.internalNotes, line) },
      });
    }
    return "flagged";
  }

  const o = order!;
  const now = deps.now();
  const isQuote = o.source === QUOTE_SOURCE;
  /* An order cancelled a moment before its payment landed — a payment
     request the florist withdrew, or a discounted web order released when
     its hold ended. The money is real, so the order is still marked PAID —
     and a human is told, loudly. */
  const paidAfterCancel = o.fulfilmentStatus === "CANCELLED";
  const recovering = verdict.action === "already-paid";

  if (recovering) {
    /* The ordinary replay: paid, invoiced, nothing to do. */
    if (o.invoiceNumber) return "already-paid";
  } else {
    /* mark-paid */
    await payload.update({
      collection: "orders",
      id: o.id,
      overrideAccess: true,
      context: { [PAYMENT_PROVIDER_CONTEXT]: true },
      data: {
        paymentStatus: "PAID",
        stripePaymentIntentId: intent.id,
        paidAt: now.toISOString(),
        /* The florist confirmed this arrangement when she asked for the
           money, so a paid request is already CONFIRMED. No "your order is
           confirmed" email is sent for this move: the thank-you says it. */
        ...(isQuote && o.fulfilmentStatus === "NEW" ? { fulfilmentStatus: "CONFIRMED" as const } : {}),
        ...(paidAfterCancel && !(o.internalNotes ?? "").includes(PAID_AFTER_CANCEL_NOTE)
          ? { internalNotes: appendNote(o.internalNotes, PAID_AFTER_CANCEL_NOTE) }
          : {}),
      },
    });
  }

  /* ---- 3. the discount code is counted as used ----------------------
     HERE: after PAID, before the invoice gate, for the winner and for a
     recovering retry alike. That ordering is what heals a crash between
     PAID and the count — the retry arrives as "already paid", has no
     invoice yet, and so reaches this line again; the statement's own claim
     on the order row makes a second count impossible. Its own try/catch: a
     failed count must never stop an invoice or undo PAID (a problem after
     capture never rolls back). Payment requests carry no code by rule. */
  await redeemAndFlag(payload, o, deps, now);

  /* ---- 4. the invoice, and with it the right to send anything ---- */
  const paidAtIso = o.paidAt ?? now.toISOString();
  const vatRateBps = currentVatRateBps();
  const vatFils = vatIncludedFils(o.totalFils, vatRateBps);
  const claim = await deps.claimInvoice(payload, {
    orderId: o.id,
    year: invoiceYear(new Date(paidAtIso)),
    vatRateBps,
    vatIncludedFils: vatFils,
    paidAtIso,
  });
  /* Another delivery of this event issued the invoice and sent the emails. */
  if (!claim.claimedNow) return "already-paid";

  if (recovering) {
    /* An invoice was owed and is now issued. Whether to EMAIL is a separate
       question: only when this is plainly the same payment still inside
       Stripe's retry window. An old event resent from the dashboard must not
       email a customer about an order from last spring. */
    const samePayment = o.stripePaymentIntentId === intent.id;
    const paidAtMs = o.paidAt ? new Date(o.paidAt).getTime() : now.getTime();
    const recent = now.getTime() - paidAtMs <= RETRY_HORIZON_MS;
    if (!samePayment || !recent) {
      payload.logger.warn(
        `order ${o.orderNumber}: invoice ${claim.invoiceNumber} issued on a late replay of ${intent.id}; no emails sent`,
      );
      return "invoice-issued";
    }
  }

  /* ---- 5. winner only ---- */
  const internal = env.EMAIL_REPLY_TO ? { owner: env.EMAIL_REPLY_TO, florist: env.EMAIL_REPLY_TO } : {};

  if (isQuote) {
    await afterQuotePaid(payload, o, {
      invoiceNumber: claim.invoiceNumber,
      paidAtIso,
      vatRateBps,
      vatIncludedFils: vatFils,
      internal,
    });
    return "marked-paid";
  }

  try {
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
          /* From the order's own snapshot — never from the live discount,
             which may have been edited or deleted since. */
          couponCode: o.couponCode || undefined,
          couponDiscountFils: Number(o.couponDiscountFils ?? 0),
          saleSavingsFils: saleSavingsOfItems(o.items),
        },
        internal,
      ),
    );
  } catch (error) {
    payload.logger.error(
      `order ${o.orderNumber} paid, but its emails could not be queued: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  return "marked-paid";
}

/**
 * Step 3 of the paid path: count the code, and tell the owner when a
 * discount was honoured that the rules would no longer have given.
 *
 * Two notes can be written, each at most once:
 *
 *   over the limit   the count is now above the code's usage limit;
 *   paid late        the order carried a sale price or a code and was paid
 *                    after the hold on that price had ended (the form was
 *                    kept open) — the sale may have finished since.
 *
 * In both cases the customer's money is already captured, so the order is
 * honoured exactly as it stands. Nothing here may throw.
 */
async function redeemAndFlag(
  payload: Payload,
  o: OrderDoc,
  deps: PaidDeps,
  now: Date,
): Promise<void> {
  const notes: string[] = [];

  if (o.couponDiscount != null || o.couponCode) {
    try {
      const result = await (deps.redeemCoupon ?? redeemCoupon)(payload, o.id);
      if (result.redeemed && result.overLimit) notes.push(overLimitNote(o.couponCode ?? "?"));
    } catch (error) {
      /* Reconcilable later: orders with a code and no couponRedeemedAt. */
      payload.logger.error(
        `order ${o.orderNumber} paid, but its discount code could not be counted: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  const discounted = o.discountSnapshot != null || Number(o.couponDiscountFils ?? 0) > 0;
  const createdMs = o.createdAt ? new Date(o.createdAt).getTime() : Number.NaN;
  if (
    discounted &&
    Number.isFinite(createdMs) &&
    now.getTime() - createdMs > DISCOUNT_HOLD_MINUTES * 60_000
  ) {
    notes.push(LATE_DISCOUNT_NOTE);
  }

  if (notes.length === 0) return;
  try {
    /* Re-read: the PAID write above may have added a note of its own. */
    const fresh = (await payload.findByID({
      collection: "orders",
      id: o.id,
      depth: 0,
      overrideAccess: true,
    })) as { internalNotes?: string | null };
    const missing = notes.filter((line) => !(fresh.internalNotes ?? "").includes(line));
    if (missing.length === 0) return;
    await payload.update({
      collection: "orders",
      id: o.id,
      overrideAccess: true,
      data: { internalNotes: missing.reduce((all, line) => appendNote(all, line), fresh.internalNotes) },
    });
  } catch (error) {
    payload.logger.error(
      `order ${o.orderNumber}: could not write its discount check note: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}

/**
 * A payment request has been paid: move the enquiry on, thank the customer
 * with their invoice, tell the owner and give the florist her job sheet.
 *
 * Nothing here may throw. The money is recorded and the invoice issued; a
 * failed email or a failed enquiry update must not turn that into a 500 that
 * makes Stripe retry a payment which has already been applied.
 */
async function afterQuotePaid(
  payload: Payload,
  o: OrderDoc,
  paid: {
    invoiceNumber: string;
    paidAtIso: string;
    vatRateBps: number;
    vatIncludedFils: number;
    internal: { owner?: string; florist?: string };
  },
): Promise<void> {
  const enquiryId = relationId(o.enquiry);
  let enquiryNumber: string | undefined;

  if (enquiryId) {
    try {
      /* overrideAccess: the webhook has no user. Only the status moves. */
      const enquiry = await payload.update({
        collection: "enquiries",
        id: enquiryId,
        overrideAccess: true,
        data: { status: "CONVERTED" },
      });
      enquiryNumber = enquiry.enquiryNumber ?? undefined;
    } catch (error) {
      payload.logger.error(
        `order ${o.orderNumber} paid, but enquiry ${enquiryId} could not be marked converted: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  try {
    const locale = o.locale === "ar" ? "ar" : "en";
    const origin = payLinkOrigin(SITE_ORIGIN, {
      env: process.env.VERCEL_ENV,
      branchUrl: process.env.VERCEL_BRANCH_URL,
    });
    const invoice = buildInvoice(
      {
        ...o,
        invoiceNumber: paid.invoiceNumber,
        paidAt: paid.paidAtIso,
        vatRateBps: paid.vatRateBps,
        vatIncludedFils: paid.vatIncludedFils,
      },
      BUSINESS,
    );
    await sendAfterCommit(
      payload,
      buildQuotePaidEmails(
        {
          order: quoteFactsFromOrder(o),
          invoice,
          /* The same link now shows the invoice. Without a salt (it should
             never be missing) the button simply opens the site. */
          payUrl: o.payTokenSalt
            ? payUrl(origin, payToken(env.PAYLOAD_SECRET, o.payTokenSalt), locale)
            : origin,
          enquiryNumber,
          adminOrderUrl: `${origin}/admin/orders/${encodeURIComponent(String(o.orderNumber))}`,
          locale,
        },
        paid.internal,
      ),
    );
  } catch (error) {
    payload.logger.error(
      `order ${o.orderNumber} paid, but its emails could not be queued: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}

/**
 * Something happened in Stripe AFTER a payment that a human needs to know
 * about — a refund, a dispute. Nothing here changes money state: the order
 * stays as it is and a line is written where staff will read it, because
 * both features that create "refund this in Stripe" situations would
 * otherwise leave an order reading PAID with a valid invoice and no trace of
 * what was done about it.
 *
 * Found by the stored PaymentIntent id, never by anything the event's
 * metadata claims. Says each thing once, however often Stripe repeats it.
 */
export async function noteStripeEventOnOrder(
  payload: Payload,
  intentId: string | null | undefined,
  line: string,
): Promise<"noted" | "already-noted" | "no-order"> {
  if (!intentId) return "no-order";
  const found = await payload.find({
    collection: "orders",
    where: { stripePaymentIntentId: { equals: intentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const order = found.docs[0] as { id: number; internalNotes?: string | null } | undefined;
  if (!order) return "no-order";
  if ((order.internalNotes ?? "").includes(line)) return "already-noted";
  await payload.update({
    collection: "orders",
    id: order.id,
    overrideAccess: true,
    data: { internalNotes: appendNote(order.internalNotes, line) },
  });
  return "noted";
}
