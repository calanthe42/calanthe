import type { Payload } from "payload";

/**
 * Counting a use of a discount code: when the order is PAID, exactly once.
 *
 * ONE SQL STATEMENT, and that is the whole design.
 *
 *   claim    stamps the order's `coupon_redeemed_at` — but only if it is
 *            empty, the order carries a code, and the order is settled;
 *   UPDATE   adds one to that code's `times_used`, only when `claim`
 *            produced a row.
 *
 * EXACTLY ONCE, because the stamp and the count change in the same statement
 * and the stamp can be taken only once. Stripe delivers a webhook more than
 * once, sometimes concurrently: the second delivery waits on the order row,
 * finds the stamp already there, claims nothing and counts nothing. A crash
 * before this statement leaves the stamp empty, so the retry counts it then.
 *
 * NEVER DECREMENTED. A refund or a cancellation does not give a use back —
 * the customer had the discount.
 *
 * `overLimit` reports that the count has now passed the code's limit. The
 * order is honoured regardless — the money is already captured — and the
 * caller writes a note for the owner (backend/payments/paid.ts). In normal
 * running this cannot happen, because a code is reserved when the order is
 * created (backend/payments/coupon-claims.ts); it exists for the case where
 * the limit was lowered, or a held order slipped through, after that.
 *
 * Run in AUTOCOMMIT — never inside a Payload transaction — so the row lock
 * lasts one statement. A discount deleted meanwhile leaves the order's
 * foreign key null, the claim matches nothing and nothing is counted.
 */

type DrizzleLike = { execute: (query: unknown) => Promise<unknown> };

export type RedeemResult = {
  /** True when THIS call counted the use. */
  redeemed: boolean;
  /** True when the count is now above the code's limit. */
  overLimit: boolean;
  timesUsed?: number;
  usageLimit?: number | null;
};

export type RedeemCoupon = (payload: Payload, orderId: number) => Promise<RedeemResult>;

function firstRow(result: unknown): Record<string, unknown> | undefined {
  /* node-postgres returns { rows: [...] }; some drivers return the array. */
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] })?.rows ?? []);
  return rows[0] as Record<string, unknown> | undefined;
}

export const redeemCoupon: RedeemCoupon = async (payload, orderId) => {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new Error(`redeemCoupon: orderId must be a positive integer, got ${orderId}`);
  }

  const { sql } = await import("@payloadcms/db-postgres");
  const drizzle = (payload.db as unknown as { drizzle: DrizzleLike }).drizzle;

  const result = await drizzle.execute(sql`
    WITH claim AS (
      UPDATE orders
      SET coupon_redeemed_at = now()
      WHERE id = ${orderId}::int
        AND coupon_redeemed_at IS NULL
        AND coupon_discount_id IS NOT NULL
        AND payment_status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')
      RETURNING coupon_discount_id
    )
    UPDATE discounts d
    SET times_used = d.times_used + 1
    FROM claim
    WHERE d.id = claim.coupon_discount_id
    RETURNING d.times_used AS times_used, d.usage_limit AS usage_limit
  `);

  const row = firstRow(result);
  if (!row) return { redeemed: false, overLimit: false };

  const timesUsed = Number(row.times_used);
  const usageLimit =
    row.usage_limit === null || row.usage_limit === undefined ? null : Number(row.usage_limit);
  return {
    redeemed: true,
    overLimit: usageLimit !== null && timesUsed > usageLimit,
    timesUsed,
    usageLimit,
  };
};
