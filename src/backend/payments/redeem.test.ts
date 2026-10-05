import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { redeemCoupon } from "./redeem";

/**
 * Counting a use of a code, with a fake `execute` standing in for Postgres.
 *
 * What a fake cannot prove is the locking itself — that needs a real
 * database. What it can prove is the statement's SHAPE: that the count and
 * the claim are one statement, and that the claim is conditional on the
 * order not having been counted already. Those two facts are what make the
 * count exactly-once, so they are asserted on the SQL text.
 */

function harness(rows: Record<string, unknown>[] | { rows: Record<string, unknown>[] }) {
  const execute = vi.fn<(query: unknown) => Promise<unknown>>(async () => rows);
  const payload = { db: { drizzle: { execute } } } as unknown as Payload;
  return { payload, execute };
}

/** The statement as text, with its bound parameters. */
function rendered(query: unknown): { text: string; params: unknown[] } {
  const chunks = (query as { queryChunks: unknown[] }).queryChunks;
  const params: unknown[] = [];
  const text = chunks
    .map((chunk) => {
      if (chunk && typeof chunk === "object" && "value" in chunk) {
        return (chunk as { value: string[] }).value.join("");
      }
      params.push(chunk);
      return "$?";
    })
    .join("");
  return { text: text.replace(/\s+/g, " "), params };
}

/* redeem.ts loads the Postgres adapter lazily, for its `sql` tag. The first
   load is slow when the whole suite runs at once, so it is paid for here
   rather than inside whichever test happens to run first. */
beforeAll(async () => {
  await import("@payloadcms/db-postgres");
}, 60_000);

describe("redeemCoupon", () => {
  it("reports a use counted, within the limit", async () => {
    const h = harness([{ times_used: "3", usage_limit: "20" }]);
    expect(await redeemCoupon(h.payload, 12)).toEqual({
      redeemed: true,
      overLimit: false,
      timesUsed: 3,
      usageLimit: 20,
    });
  });

  it("reads the row whichever shape the driver returns", async () => {
    const h = harness({ rows: [{ times_used: 1, usage_limit: null }] });
    expect(await redeemCoupon(h.payload, 12)).toEqual({
      redeemed: true,
      overLimit: false,
      timesUsed: 1,
      usageLimit: null,
    });
  });

  it("flags a count that has passed the limit, and not one exactly at it", async () => {
    expect((await redeemCoupon(harness([{ times_used: 20, usage_limit: 20 }]).payload, 12)).overLimit).toBe(false);
    expect((await redeemCoupon(harness([{ times_used: 21, usage_limit: 20 }]).payload, 12)).overLimit).toBe(true);
  });

  it("never flags a code with no limit", async () => {
    const result = await redeemCoupon(harness([{ times_used: 10_000, usage_limit: null }]).payload, 12);
    expect(result).toMatchObject({ redeemed: true, overLimit: false });
  });

  it("counts nothing when no row comes back: already counted, no code, or the discount was deleted", async () => {
    expect(await redeemCoupon(harness([]).payload, 12)).toEqual({ redeemed: false, overLimit: false });
    expect(await redeemCoupon(harness({ rows: [] }).payload, 12)).toEqual({ redeemed: false, overLimit: false });
  });

  it("is ONE statement whose claim can be taken only once", async () => {
    const h = harness([]);
    await redeemCoupon(h.payload, 12);
    expect(h.execute).toHaveBeenCalledTimes(1);

    const { text, params } = rendered(h.execute.mock.calls[0]![0]);
    /* The claim: stamp the order, only if it has not been stamped. */
    expect(text).toMatch(/WITH claim AS \( UPDATE orders SET coupon_redeemed_at = now\(\)/);
    expect(text).toContain("coupon_redeemed_at IS NULL");
    expect(text).toContain("coupon_discount_id IS NOT NULL");
    /* Only a settled order is ever counted. */
    expect(text).toContain("payment_status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')");
    /* The count happens only FROM the claim, in the same statement. */
    expect(text).toMatch(/UPDATE discounts d SET times_used = d\.times_used \+ 1 FROM claim WHERE d\.id = claim\.coupon_discount_id/);
    /* Never decremented anywhere. */
    expect(text).not.toMatch(/times_used\s*-\s*1/);
    /* The order id is a bound parameter, not text. */
    expect(params).toEqual([12]);
    expect(text).not.toContain("12");
  });

  it("refuses an id that is not a positive integer, before touching the database", async () => {
    const h = harness([]);
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await expect(redeemCoupon(h.payload, bad)).rejects.toThrow(/positive integer/);
    }
    expect(h.execute).not.toHaveBeenCalled();
  });
});
