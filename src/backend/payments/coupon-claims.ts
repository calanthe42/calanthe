import type Stripe from "stripe";
import type { Payload, Where } from "payload";
import { DISCOUNT_HOLD_MINUTES, type CouponRefusal, type CouponRule } from "@/lib/discounts";
import { countCouponClaims } from "@backend/data/discounts";

/**
 * Making a code's limits real: a usage limit, once per customer, and an end.
 *
 * THE PROBLEM. A code is checked when the order is created and counted when
 * the order is paid — and a PaymentIntent never expires. Left there, a
 * "first 20 customers" code can be attached to two hundred unpaid orders
 * whose payment forms are kept open and paid at leisure, a once-per-customer
 * code can be used as often as its holder likes, and an order created during
 * a sale can be paid weeks after the sale ended.
 *
 * THE RULE. An order that can still be paid HOLDS a claim on its code
 * (backend/data/discounts.ts `claimWhere`). A new order is admitted only
 * while the claims are under the limit. And a claim cannot be held open for
 * ever: an unpaid discounted order older than DISCOUNT_HOLD_MINUTES is
 * cancelled — its PaymentIntent first, so the form somebody kept open stops
 * working at the same moment the claim is released.
 *
 * RACE-FREE WITHOUT A LOCK. An order is admitted in two looks:
 *
 *   before it is created   refuse early, creating nothing;
 *   after it is created    count everybody ELSE's claims again, and if the
 *                          limit is already met, cancel this order.
 *
 * Two customers racing for the last use both create their order and both
 * look again. For both to be admitted, each would have to look before the
 * other's order existed — but each looks only after its own exists, so at
 * least one of them sees the other. The worst outcome is that both are
 * refused and one retries; a limit is never exceeded. (An advisory lock
 * inside one statement would not do this: the statement's snapshot is taken
 * before the lock is acquired, so the waiter would count stale rows.)
 *
 * THE SAME CUSTOMER, STARTING AGAIN. Changing the basket at checkout creates
 * a new order and leaves the old one unpaid. That old order must not turn
 * the customer's own code into "already used", so before a new claim is
 * counted, the same email's earlier unpaid orders with this code are
 * released (cancelled, with their intents). If one of them cannot be
 * cancelled because it is being paid at that very moment, it stays a claim —
 * correctly.
 */

/* How long an unpaid discounted order may hold its price and its claim is
   DISCOUNT_HOLD_MINUTES, defined with the other discount rules. */
export { DISCOUNT_HOLD_MINUTES };

/** Web checkout's `source`. Payment requests are never discounted. */
const WEB_SOURCE = "web-checkout-card";

export const STALE_DISCOUNT_NOTE =
  "Cancelled automatically: this discounted order was not paid in time, so its price is no longer held.";
export const SUPERSEDED_NOTE =
  "Cancelled automatically: the customer started checkout again with the same discount code.";
export const LOST_CLAIM_NOTE =
  "Cancelled automatically: the discount code ran out while this order was being placed. Nothing was charged.";

type StripeLike = Pick<Stripe, "paymentIntents">;

type HeldOrder = {
  id: number;
  orderNumber?: string | number | null;
  paymentStatus?: string | null;
  fulfilmentStatus?: string | null;
  stripePaymentIntentId?: string | null;
  internalNotes?: string | null;
};

export type ReleaseOutcome = "released" | "in-flight";

const message = (error: unknown): string => (error instanceof Error ? error.message : "unknown");

const appendNote = (existing: string | null | undefined, line: string): string =>
  `${existing ? `${existing}\n` : ""}${line}`.slice(0, 8000);

/** Intent states in which the customer has paid or is paying. */
const IN_FLIGHT = new Set(["succeeded", "processing", "requires_capture"]);

/**
 * Cancel one unpaid web order so that it can no longer be paid.
 *
 * ORDER OF OPERATIONS (the same lesson as cancelling a payment request):
 * mark the order CANCELLED first, THEN re-read its PaymentIntent id and
 * cancel that. Checkout stores the intent id and then re-reads the order, so
 * whichever of the two writes lands second sees the other — an intent can
 * never be left alive on a cancelled order. If Stripe refuses because the
 * customer is paying right now, the order is put back as it was and
 * reported "in-flight": it is about to be paid, and it keeps its claim.
 */
export async function releaseUnpaidOrder(
  payload: Payload,
  stripe: StripeLike,
  order: HeldOrder,
  note: string,
): Promise<ReleaseOutcome> {
  const previous = order.fulfilmentStatus ?? "NEW";

  await payload.update({
    collection: "orders",
    id: order.id,
    overrideAccess: true,
    data: {
      fulfilmentStatus: "CANCELLED",
      internalNotes: appendNote(order.internalNotes, note),
    },
  });

  const revert = async (): Promise<ReleaseOutcome> => {
    await payload.update({
      collection: "orders",
      id: order.id,
      overrideAccess: true,
      data: { fulfilmentStatus: previous as never, internalNotes: order.internalNotes ?? "" },
    });
    return "in-flight";
  };

  const fresh = (await payload.findByID({
    collection: "orders",
    id: order.id,
    depth: 0,
    overrideAccess: true,
  })) as HeldOrder;

  /* Paid between our read and our write: the webhook has it. */
  if (fresh.paymentStatus && fresh.paymentStatus !== "PENDING") return revert();

  const intentId = fresh.stripePaymentIntentId;
  if (!intentId) return "released";

  try {
    await stripe.paymentIntents.cancel(intentId);
    return "released";
  } catch (cancelError) {
    /* Already cancelled is success. Anything else — being paid, or Stripe
       unreachable — leaves the intent alive, so the order must stay alive. */
    try {
      const intent = await stripe.paymentIntents.retrieve(intentId);
      if (intent.status === "canceled") return "released";
      if (!IN_FLIGHT.has(intent.status)) {
        payload.logger.error(
          `order ${order.orderNumber ?? order.id}: could not cancel ${intentId} (${message(cancelError)}); left payable`,
        );
      }
    } catch (retrieveError) {
      payload.logger.error(
        `order ${order.orderNumber ?? order.id}: could not cancel or read ${intentId} (${message(retrieveError)}); left payable`,
      );
    }
    return revert();
  }
}

/** Unpaid web orders that are still payable and match `where`. */
async function findHeld(payload: Payload, where: Where, limit: number): Promise<HeldOrder[]> {
  const found = await payload.find({
    collection: "orders",
    overrideAccess: true,
    where: {
      and: [
        { paymentStatus: { equals: "PENDING" } },
        { fulfilmentStatus: { equals: "NEW" } },
        { source: { equals: WEB_SOURCE } },
        where,
      ],
    },
    sort: "createdAt",
    depth: 0,
    limit,
    pagination: false,
  });
  return found.docs as unknown as HeldOrder[];
}

async function releaseAll(
  payload: Payload,
  stripe: StripeLike,
  orders: readonly HeldOrder[],
  note: string,
): Promise<{ released: number; inFlight: number }> {
  let released = 0;
  let inFlight = 0;
  for (const order of orders) {
    try {
      const outcome = await releaseUnpaidOrder(payload, stripe, order, note);
      if (outcome === "released") released += 1;
      else inFlight += 1;
    } catch (error) {
      /* One order that will not update must not stop the rest. */
      inFlight += 1;
      payload.logger.error(
        `order ${order.orderNumber ?? order.id}: could not be released (${message(error)})`,
      );
    }
  }
  return { released, inFlight };
}

export const staleBefore = (now: Date): string =>
  new Date(now.getTime() - DISCOUNT_HOLD_MINUTES * 60_000).toISOString();

/**
 * Cancel unpaid discounted orders — a sale price or a code — that are older
 * than the hold. This is what stops an order created during a sale from
 * being paid after it. Lazy: it runs whenever somebody checks out, in small
 * batches, oldest first; nothing needs a scheduler.
 */
export async function sweepStaleDiscountOrders(
  payload: Payload,
  stripe: StripeLike,
  now: Date,
  limit = 10,
): Promise<{ released: number; inFlight: number }> {
  const stale = await findHeld(
    payload,
    {
      and: [
        { discountSnapshot: { exists: true } },
        { createdAt: { less_than: staleBefore(now) } },
      ],
    },
    limit,
  );
  return releaseAll(payload, stripe, stale, STALE_DISCOUNT_NOTE);
}

/**
 * Before a new claim on a limited code is counted: release this code's stale
 * claims, and this customer's own earlier unpaid ones.
 */
export async function releaseCouponClaims(
  payload: Payload,
  stripe: StripeLike,
  coupon: Pick<CouponRule, "id">,
  email: string,
  now: Date,
): Promise<void> {
  const address = email.trim().toLowerCase();
  const mine = address
    ? await findHeld(
        payload,
        { and: [{ couponDiscount: { equals: Number(coupon.id) } }, { customerEmail: { equals: address } }] },
        10,
      )
    : [];
  await releaseAll(payload, stripe, mine, SUPERSEDED_NOTE);

  const stale = await findHeld(
    payload,
    {
      and: [
        { couponDiscount: { equals: Number(coupon.id) } },
        { createdAt: { less_than: staleBefore(now) } },
      ],
    },
    25,
  );
  await releaseAll(payload, stripe, stale, STALE_DISCOUNT_NOTE);
}

/** Does this code need a claim at all? An unlimited code never runs out. */
export const isLimited = (coupon: Pick<CouponRule, "usageLimit" | "oncePerCustomer">): boolean =>
  coupon.usageLimit !== null || coupon.oncePerCustomer;

/**
 * May one more order claim this code? Null when it may.
 *
 * Called twice per checkout: before the order exists, and again after —
 * that time with `excludeOrderId`, so the order is asking about everybody
 * else. `timesUsed` is consulted as well as the orders, so a count that was
 * ever corrected by hand is still respected.
 */
export async function couponClaimRefusal(
  payload: Payload,
  coupon: Pick<CouponRule, "id" | "usageLimit" | "timesUsed" | "oncePerCustomer">,
  email: string,
  excludeOrderId?: number,
): Promise<Extract<CouponRefusal, "exhausted" | "already_used"> | null> {
  if (!isLimited(coupon)) return null;
  const claims = await countCouponClaims(payload, coupon.id, { email, excludeOrderId });

  if (coupon.usageLimit !== null && Math.max(claims.total, coupon.timesUsed) >= coupon.usageLimit) {
    return "exhausted";
  }
  if (coupon.oncePerCustomer && claims.forEmail >= 1) return "already_used";
  return null;
}

/**
 * The order lost the race for the last use: cancel it. No PaymentIntent
 * exists yet at this point in checkout, so there is nothing to cancel in
 * Stripe and nothing was charged.
 */
export async function abandonOrder(payload: Payload, orderId: number, note: string): Promise<void> {
  await payload.update({
    collection: "orders",
    id: orderId,
    overrideAccess: true,
    data: { fulfilmentStatus: "CANCELLED", internalNotes: note },
  });
}
