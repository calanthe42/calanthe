import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type { Discount } from "@/payload-types";

vi.mock("@payload-config", () => ({ default: {} }));

const {
  claimWhere,
  countCouponClaims,
  emailHasRedeemed,
  findCoupon,
  loadLiveSaleRules,
  toCouponRule,
  toSaleRule,
} = await import("./discounts");

/**
 * The storefront's and checkout's window onto the discounts collection.
 *
 * These tests assert on the QUERY, as data/products.test.ts does: the
 * guarantees here — the collection's access rule is bypassed on purpose, a
 * code is matched by equality only, a malformed code never reaches the
 * database — live in what Payload is asked, not in what comes back.
 */

const doc = (over: Partial<Discount> = {}): Discount =>
  ({
    id: 3,
    title: "Internal — Eid",
    kind: "automatic",
    code: null,
    valueType: "percentage",
    percentOff: 20,
    amountOffFils: null,
    appliesTo: "products",
    products: [7, { id: 8 }],
    occasions: [],
    categories: [],
    labelEn: "Eid offer",
    labelAr: "عرض العيد",
    startsAt: "2026-10-01T14:00:00.000Z",
    endsAt: null,
    active: true,
    timesUsed: 0,
    createdAt: "2026-09-30T00:00:00.000Z",
    updatedAt: "2026-09-30T00:00:00.000Z",
    ...over,
  }) as Discount;

function fake(docs: Discount[] = [], totalDocs = 0) {
  type Query = (args: Record<string, unknown>) => Promise<unknown>;
  const find = vi.fn<Query>(async () => ({ docs }));
  const count = vi.fn<Query>(async () => ({ totalDocs }));
  return { payload: { find, count } as unknown as Payload, find, count };
}

describe("mapping", () => {
  it("turns a sale document into a rule, with ids as strings whatever the depth", () => {
    expect(toSaleRule(doc())).toEqual({
      id: "3",
      title: "Internal — Eid",
      labelEn: "Eid offer",
      labelAr: "عرض العيد",
      appliesTo: "products",
      productIds: ["7", "8"],
      occasionIds: [],
      categories: [],
      valueType: "percentage",
      percentOff: 20,
      amountOffFils: 0,
      active: true,
      startsAt: "2026-10-01T14:00:00.000Z",
      endsAt: null,
    });
  });

  it("turns a code document into a rule; no limit is null, not zero", () => {
    const rule = toCouponRule(
      doc({ kind: "code", code: "EID10", valueType: "fixed", percentOff: null, amountOffFils: 5000, minSubtotalFils: 30000, usageLimit: null, timesUsed: 4, oncePerCustomer: true }),
    );
    expect(rule).toMatchObject({
      id: "3",
      code: "EID10",
      valueType: "fixed",
      percentOff: 0,
      amountOffFils: 5000,
      minSubtotalFils: 30000,
      usageLimit: null,
      timesUsed: 4,
      oncePerCustomer: true,
    });
    expect(toCouponRule(doc({ kind: "code", code: "X10", usageLimit: 0 as never })).usageLimit).toBe(0);
  });

  it("treats a missing active flag as off", () => {
    expect(toSaleRule(doc({ active: null })).active).toBe(false);
  });
});

describe("loadLiveSaleRules", () => {
  it("reads automatic, active sales inside their window — bypassing the owner-only access rule on purpose", async () => {
    const f = fake([doc()]);
    const rules = await loadLiveSaleRules(f.payload, new Date("2026-10-05T10:00:00.000Z"));
    expect(rules).toHaveLength(1);

    const args = f.find.mock.calls[0]![0];
    expect(args.collection).toBe("discounts");
    /* Without this, a shopper (no user) would read nothing and no sale would ever apply. */
    expect(args.overrideAccess).toBe(true);
    expect(args.depth).toBe(0);
    const where = JSON.stringify(args.where);
    expect(where).toContain('"kind":{"equals":"automatic"}');
    expect(where).toContain('"active":{"equals":true}');
    expect(where).toContain('"startsAt":{"less_than_equal":"2026-10-05T10:00:00.000Z"}');
    expect(where).toContain('"endsAt":{"greater_than":"2026-10-05T10:00:00.000Z"}');
  });
});

describe("findCoupon", () => {
  it("normalises what was typed and matches by EQUALITY on a code-kind row", async () => {
    const f = fake([doc({ kind: "code", code: "EID10" })]);
    expect((await findCoupon(f.payload, "  eid 10 "))?.code).toBe("EID10");
    const args = f.find.mock.calls[0]![0];
    expect(args.where).toEqual({ and: [{ kind: { equals: "code" } }, { code: { equals: "EID10" } }] });
    expect(args.overrideAccess).toBe(true);
    expect(args.limit).toBe(1);
  });

  it("never queries for something that cannot be a code", async () => {
    const f = fake();
    for (const raw of ["", "ab", "A".repeat(25), "EID10%", "' OR 1=1 --", "خصم"]) {
      expect(await findCoupon(f.payload, raw)).toBeNull();
    }
    expect(f.find).not.toHaveBeenCalled();
  });

  it("is null for a code that does not exist", async () => {
    expect(await findCoupon(fake([]).payload, "NOPE10")).toBeNull();
  });
});

describe("emailHasRedeemed", () => {
  it("counts only PAID uses (redeemed), for the lowercased address", async () => {
    const f = fake([], 1);
    expect(await emailHasRedeemed(f.payload, "9", " Layla@Example.com ")).toBe(true);
    expect(f.count.mock.calls[0]![0].where).toEqual({
      and: [
        { couponDiscount: { equals: 9 } },
        { customerEmail: { equals: "layla@example.com" } },
        { couponRedeemedAt: { exists: true } },
      ],
    });
  });

  it("is false with no uses, and does not query for an empty address", async () => {
    expect(await emailHasRedeemed(fake([], 0).payload, "9", "layla@example.com")).toBe(false);
    const f = fake([], 5);
    expect(await emailHasRedeemed(f.payload, "9", "  ")).toBe(false);
    expect(f.count).not.toHaveBeenCalled();
  });
});

describe("claims", () => {
  it("a claim is a redeemed order, or one that is not cancelled", () => {
    expect(claimWhere("9")).toEqual({
      and: [
        { couponDiscount: { equals: 9 } },
        {
          or: [
            { couponRedeemedAt: { exists: true } },
            { fulfilmentStatus: { not_equals: "CANCELLED" } },
          ],
        },
      ],
    });
  });

  it("can leave the asking order out, and counts the email separately", async () => {
    const f = fake([], 2);
    expect(await countCouponClaims(f.payload, "9", { email: "Layla@Example.com", excludeOrderId: 41 })).toEqual({
      total: 2,
      forEmail: 2,
    });
    const [total, forEmail] = f.count.mock.calls.map((call) => JSON.stringify(call[0].where));
    expect(total).toContain('"id":{"not_equals":41}');
    expect(total).not.toContain("customerEmail");
    expect(forEmail).toContain('"customerEmail":{"equals":"layla@example.com"}');
  });

  it("does not count by email when none is given", async () => {
    const f = fake([], 3);
    expect(await countCouponClaims(f.payload, "9")).toEqual({ total: 3, forEmail: 0 });
    expect(f.count).toHaveBeenCalledTimes(1);
  });
});
