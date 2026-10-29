import { cache } from "react";
import { unstable_cache } from "next/cache";
import { headers as nextHeaders } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { getPayload, type Payload } from "payload";
import config from "@payload-config";
import { discountStatus, type CouponRule } from "@/lib/discounts";
import type { WelcomeGift } from "@/lib/welcome-offer";
import {
  PAID_PAYMENT_STATES,
  WELCOME_TAG,
  accountAwaitsConfirmation,
  accountMayHaveWelcome,
  emailIdentityKey,
  welcomeOpenOnceReleased,
  welcomeUsedUp,
  type WelcomeAccount,
  type WelcomeStanding,
} from "@backend/domain/welcome";
import { toCouponRule } from "./discounts";

/**
 * THE WELCOME GIFT — the only place it is read from the database.
 *
 * It is one discount row (`discounts.welcome`), applied by the SERVER to a
 * confirmed customer's first order. The browser never names it and never
 * sends its code: the basket says "I am showing the welcome gift", and the
 * quote and the payment each decide here, from the session's own account,
 * whether that is true (backend/actions/checkout.ts).
 *
 * ONCE PER PERSON is asked of the orders, not of a flag on the account. A
 * flag says nothing about a second account opened with the same Gmail inbox;
 * the orders do, because they are matched on the inbox key
 * (backend/domain/welcome.ts), on the person's own orders and on the orders
 * of every account that shares her key.
 *
 * Same overrideAccess note as data/discounts.ts: the discounts collection is
 * owner-only, a shopper has no rights to read it, and this module is the
 * allow-list of what may leave it.
 */

/** The gift row, live or not — or null when there is none. */
export async function loadWelcomeCoupon(payload: Payload): Promise<CouponRule | null> {
  const found = await payload.find({
    collection: "discounts",
    overrideAccess: true,
    where: { and: [{ kind: { equals: "code" } }, { welcome: { equals: true } }] },
    depth: 0,
    limit: 1,
    pagination: false,
  });
  const doc = found.docs[0];
  return doc ? toCouponRule(doc) : null;
}

type DrizzleLike = { execute: (query: unknown) => Promise<unknown> };
type StandingRow = {
  paid?: number | string | null;
  claims?: number | string | null;
  own_held?: number | string | null;
};
const rowsOf = (result: unknown): StandingRow[] =>
  Array.isArray(result)
    ? (result as StandingRow[])
    : (((result as { rows?: StandingRow[] })?.rows ?? []) as StandingRow[]);

/* emailIdentityKey, in SQL, for one fixed column. The column is one of two
   literals named here, never a value from a request. */
const keyOf = (column: "o.customer_email" | "u.email"): string => {
  const address = `lower(btrim(${column}))`;
  const local = `split_part(split_part(${address}, '@', 1), '+', 1)`;
  const domain = `split_part(${address}, '@', 2)`;
  return `CASE WHEN ${domain} IN ('gmail.com', 'googlemail.com') THEN replace(${local}, '.', '') || '@gmail.com' ELSE ${local} || '@' || ${domain} END`;
};

/**
 * What the orders say about this person: how many were paid for, how many
 * hold the gift, and how many of those are this account's own unpaid
 * checkouts — the orders `findHeld` releases (backend/payments/coupon-claims.ts:
 * PENDING, NEW, from the web checkout). `excludeOrderId` leaves the caller's
 * own new order out, for the second look after it is created.
 */
export async function welcomeStanding(
  payload: Payload,
  user: { id: number | string; email?: string | null },
  couponId: string,
  excludeOrderId?: number,
): Promise<WelcomeStanding> {
  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;
  const userId = Number(user.id);
  const key = emailIdentityKey(user.email ?? "");
  const exclude = excludeOrderId ?? null;
  const paidStates = sql.raw(PAID_PAYMENT_STATES.map((s) => `'${s}'`).join(", "));

  const rows = rowsOf(
    await drizzle.execute(sql`
      WITH people AS (
        SELECT u.id FROM users u WHERE u.id = ${userId} OR ${sql.raw(keyOf("u.email"))} = ${key}
      ),
      hers AS (
        SELECT o.id, o.customer_id, o.source, o.payment_status, o.fulfilment_status,
               o.coupon_discount_id, o.coupon_redeemed_at
        FROM orders o
        WHERE o.customer_id IN (SELECT id FROM people) OR ${sql.raw(keyOf("o.customer_email"))} = ${key}
      ),
      gift_claims AS (
        SELECT * FROM hers
        WHERE coupon_discount_id = ${Number(couponId)}
          AND (coupon_redeemed_at IS NOT NULL OR fulfilment_status <> 'CANCELLED')
          AND (${exclude}::int IS NULL OR id <> ${exclude}::int)
      )
      SELECT
        (SELECT count(*) FROM hers WHERE payment_status IN (${paidStates}))::int AS paid,
        (SELECT count(*) FROM gift_claims)::int AS claims,
        (SELECT count(*) FROM gift_claims
          WHERE customer_id = ${userId}
            AND coupon_redeemed_at IS NULL
            AND payment_status = 'PENDING'
            AND fulfilment_status = 'NEW'
            AND source = 'web-checkout-card')::int AS own_held
    `),
  );
  const row = rows[0] ?? {};
  return {
    paidOrders: Number(row.paid ?? 0),
    claims: Number(row.claims ?? 0),
    ownHeld: Number(row.own_held ?? 0),
  };
}

export type WelcomeUser = WelcomeAccount & { id: number | string; email?: string | null };

/**
 * The gift for this signed-in account, or null. STRICT: a database failure
 * throws, so checkout can refuse rather than charge a total it was not shown.
 *
 * Her own unpaid checkouts holding the gift do not count against her here
 * (domain/welcome.ts `welcomeOpenOnceReleased`): the payment releases them
 * and only then counts every claim, strictly (backend/actions/checkout.ts).
 */
export async function welcomeFor(
  payload: Payload,
  user: WelcomeUser | null | undefined,
  now: Date,
): Promise<CouponRule | null> {
  if (!user || !accountMayHaveWelcome(user)) return null;
  const coupon = await loadWelcomeCoupon(payload);
  if (!coupon || discountStatus(coupon, now) !== "active" || welcomeUsedUp(coupon)) return null;
  const standing = await welcomeStanding(payload, user, coupon.id);
  return welcomeOpenOnceReleased(standing) ? coupon : null;
}

/* ------------------------------------------------------------------ */
/* For pages: what to offer this visitor                               */
/* ------------------------------------------------------------------ */

/** What the gift is worth, for words on a page (lib/welcome-offer.ts). */
export type WelcomeOffer = WelcomeGift;

export type WelcomeVisitor = {
  /** The gift as it stands now; null when there is none, it is switched off, or it could not be read. */
  offer: WelcomeOffer | null;
  /**
   *   guest        nobody is signed in: the popup may invite her
   *   eligible     a customer whose first order will take the gift
   *   unconfirmed  a customer whose gift waits only for her to confirm her
   *                address — which she may do in another tab at any moment
   *   other        signed in, but the gift is not hers (used, the team, ...)
   *   unknown      the gift could not be read: nothing is offered, and
   *                checkout asks again rather than take that for "not hers"
   */
  account: "guest" | "eligible" | "unconfirmed" | "other" | "unknown";
};

const NONE: WelcomeVisitor = { offer: null, account: "guest" };
const UNREAD: WelcomeVisitor = { offer: null, account: "unknown" };

/* The row changes when the owner edits it, which revalidates WELCOME_TAG
   (backend/actions/discounts.ts); five minutes is the backstop. */
const cachedWelcomeCoupon = unstable_cache(
  async () => loadWelcomeCoupon(await getPayload({ config })),
  ["welcome-offer-v1"],
  { tags: [WELCOME_TAG], revalidate: 300 },
);

/**
 * Once per request, for the storefront layout. NEVER throws: a page that
 * cannot read the gift does not offer it, says so ("unknown"), and checkout
 * — which is strict — decides for itself.
 */
export const getWelcomeVisitor = cache(async (): Promise<WelcomeVisitor> => {
  try {
    const rule = await cachedWelcomeCoupon();
    if (!rule || discountStatus(rule, new Date()) !== "active" || welcomeUsedUp(rule)) return NONE;
    const offer: WelcomeOffer =
      rule.valueType === "percentage"
        ? { percentOff: rule.percentOff, amountOffFils: null }
        : { percentOff: null, amountOffFils: rule.amountOffFils };

    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: await nextHeaders() });
    if (!user) return { offer, account: "guest" };
    if (accountAwaitsConfirmation(user as WelcomeUser)) return { offer, account: "unconfirmed" };
    if (!accountMayHaveWelcome(user as WelcomeUser)) return { offer, account: "other" };
    const standing = await welcomeStanding(payload, user as WelcomeUser, rule.id);
    return { offer, account: welcomeOpenOnceReleased(standing) ? "eligible" : "other" };
  } catch (error) {
    /* Next's own signals (a page that must render per request) are not
       failures: they pass straight through, or a page could be built once
       with no offer baked into it. */
    unstable_rethrow(error);
    console.error("[welcome] the offer could not be read; not offering it", error);
    return UNREAD;
  }
});
