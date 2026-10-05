import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type Stripe from "stripe";

/* data/discounts.ts reads the Payload config at import; a unit test has none. */
vi.mock("@payload-config", () => ({ default: {} }));

import {
  DISCOUNT_HOLD_MINUTES,
  STALE_DISCOUNT_NOTE,
  SUPERSEDED_NOTE,
  couponClaimRefusal,
  isLimited,
  releaseCouponClaims,
  releaseUnpaidOrder,
  staleBefore,
  sweepStaleDiscountOrders,
} from "./coupon-claims";

/**
 * Making a code's limits enforceable: who holds a claim, when one more is
 * admitted, and how a stale claim is released so it can never be paid.
 *
 * A small in-memory `orders` table stands in for Payload, answering the few
 * query shapes these functions send.
 */

type Order = {
  id: number;
  orderNumber: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  source: string;
  customerEmail: string;
  couponDiscount: number | null;
  couponRedeemedAt: string | null;
  discountSnapshot: unknown;
  createdAt: string;
  stripePaymentIntentId: string | null;
  internalNotes: string | null;
};

const NOW = new Date("2026-10-05T10:00:00.000Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();

const order = (over: Partial<Order> = {}): Order => ({
  id: 1,
  orderNumber: "CAL-000001",
  paymentStatus: "PENDING",
  fulfilmentStatus: "NEW",
  source: "web-checkout-card",
  customerEmail: "layla@example.com",
  couponDiscount: 9,
  couponRedeemedAt: null,
  discountSnapshot: { coupon: { id: "9" }, sales: [] },
  createdAt: minutesAgo(5),
  stripePaymentIntentId: "pi_1",
  internalNotes: null,
  ...over,
});

type Clause = Record<string, unknown>;

/** Just enough of Payload's `where` to answer the queries under test. */
function matches(row: Order, where: Clause): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "and") return (condition as Clause[]).every((c) => matches(row, c));
    if (key === "or") return (condition as Clause[]).some((c) => matches(row, c));
    const value = (row as unknown as Record<string, unknown>)[key];
    const [[operator, operand]] = Object.entries(condition as Clause) as [[string, unknown]];
    switch (operator) {
      case "equals":
        return value === operand;
      case "not_equals":
        return value !== operand;
      case "exists":
        return (value !== null && value !== undefined) === operand;
      case "less_than":
        return String(value) < String(operand);
      default:
        throw new Error(`unsupported operator ${operator}`);
    }
  });
}

function world(rows: Order[], intents: Record<string, string> = {}) {
  const table = new Map(rows.map((r) => [r.id, { ...r }]));
  const statuses: Record<string, string> = { ...intents };
  const cancelled: string[] = [];

  const payload = {
    find: vi.fn(async ({ where, limit }: { where: Clause; limit: number }) => ({
      docs: [...table.values()]
        .filter((r) => matches(r, where))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit),
    })),
    count: vi.fn(async ({ where }: { where: Clause }) => ({
      totalDocs: [...table.values()].filter((r) => matches(r, where)).length,
    })),
    findByID: vi.fn(async ({ id }: { id: number }) => ({ ...table.get(id)! })),
    update: vi.fn(async ({ id, data }: { id: number; data: Partial<Order> }) => {
      const next = { ...table.get(id)!, ...data };
      table.set(id, next);
      return next;
    }),
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as Payload;

  const stripe = {
    paymentIntents: {
      cancel: vi.fn(async (id: string) => {
        const status = statuses[id] ?? "requires_payment_method";
        if (status === "succeeded" || status === "processing") {
          throw new Error(`You cannot cancel this PaymentIntent because it has a status of ${status}.`);
        }
        if (status === "unreachable") throw new Error("network");
        statuses[id] = "canceled";
        cancelled.push(id);
        return { id, status: "canceled" };
      }),
      retrieve: vi.fn(async (id: string) => {
        if (statuses[id] === "unreachable") throw new Error("network");
        return { id, status: statuses[id] ?? "requires_payment_method" };
      }),
    },
  } as unknown as Pick<Stripe, "paymentIntents">;

  return { payload, stripe, table, cancelled };
}

const limited = { id: "9", usageLimit: 2, timesUsed: 0, oncePerCustomer: false };
const oncePer = { id: "9", usageLimit: null, timesUsed: 0, oncePerCustomer: true };

describe("who holds a claim", () => {
  it("an unlimited code needs no claim and is never refused", async () => {
    const w = world([order(), order({ id: 2 }), order({ id: 3 })]);
    const unlimited = { id: "9", usageLimit: null, timesUsed: 500, oncePerCustomer: false };
    expect(isLimited(unlimited)).toBe(false);
    expect(await couponClaimRefusal(w.payload, unlimited, "x@example.com")).toBeNull();
    expect(w.payload.count).not.toHaveBeenCalled();
  });

  it("counts PAID orders and unpaid ones that can still be paid", async () => {
    const w = world([
      order({ id: 1, paymentStatus: "PAID", couponRedeemedAt: minutesAgo(600) }),
      order({ id: 2 }),
    ]);
    expect(await couponClaimRefusal(w.payload, limited, "new@example.com")).toBe("exhausted");
  });

  it("does not count a cancelled unpaid order — an abandoned basket is not a use", async () => {
    const w = world([order({ id: 1, fulfilmentStatus: "CANCELLED" }), order({ id: 2 })]);
    expect(await couponClaimRefusal(w.payload, limited, "new@example.com")).toBeNull();
  });

  it("keeps counting a paid order after it is cancelled or refunded: a use is never given back", async () => {
    const w = world([
      order({ id: 1, paymentStatus: "REFUNDED", fulfilmentStatus: "CANCELLED", couponRedeemedAt: minutesAgo(900) }),
      order({ id: 2, paymentStatus: "PAID", couponRedeemedAt: minutesAgo(800) }),
    ]);
    expect(await couponClaimRefusal(w.payload, limited, "new@example.com")).toBe("exhausted");
  });

  it("ignores orders that used a different code", async () => {
    const w = world([order({ id: 1, couponDiscount: 4 }), order({ id: 2, couponDiscount: 4 }), order({ id: 3, couponDiscount: null })]);
    expect(await couponClaimRefusal(w.payload, limited, "new@example.com")).toBeNull();
  });

  it("respects timesUsed even where the orders cannot be seen", async () => {
    const w = world([]);
    expect(await couponClaimRefusal(w.payload, { ...limited, timesUsed: 2 }, "new@example.com")).toBe("exhausted");
  });
});

describe("the second look: the last use cannot be taken twice", () => {
  it("admits an order that is alone, asking about everybody else", async () => {
    const w = world([order({ id: 1, paymentStatus: "PAID", couponRedeemedAt: minutesAgo(90) }), order({ id: 7 })]);
    /* One paid, plus this order (7) itself: one use is left, and it is 7's. */
    expect(await couponClaimRefusal(w.payload, limited, "layla@example.com", 7)).toBeNull();
  });

  it("refuses BOTH of two orders racing for one remaining use — never admits both", async () => {
    const w = world([
      order({ id: 1, paymentStatus: "PAID", couponRedeemedAt: minutesAgo(90), customerEmail: "a@example.com" }),
      order({ id: 7, customerEmail: "b@example.com" }),
      order({ id: 8, customerEmail: "c@example.com" }),
    ]);
    expect(await couponClaimRefusal(w.payload, limited, "b@example.com", 7)).toBe("exhausted");
    expect(await couponClaimRefusal(w.payload, limited, "c@example.com", 8)).toBe("exhausted");
  });

  it("admits both when two uses remain", async () => {
    const w = world([order({ id: 7, customerEmail: "b@example.com" }), order({ id: 8, customerEmail: "c@example.com" })]);
    expect(await couponClaimRefusal(w.payload, limited, "b@example.com", 7)).toBeNull();
    expect(await couponClaimRefusal(w.payload, limited, "c@example.com", 8)).toBeNull();
  });
});

describe("once per customer", () => {
  it("refuses an email that has a paid order with the code", async () => {
    const w = world([order({ id: 1, paymentStatus: "PAID", couponRedeemedAt: minutesAgo(900) })]);
    expect(await couponClaimRefusal(w.payload, oncePer, " Layla@Example.com ")).toBe("already_used");
    expect(await couponClaimRefusal(w.payload, oncePer, "someone-else@example.com")).toBeNull();
  });

  it("refuses a second unpaid order from the same email: ten open payment forms are not ten uses", async () => {
    const w = world([order({ id: 1 }), order({ id: 2 })]);
    expect(await couponClaimRefusal(w.payload, oncePer, "layla@example.com", 2)).toBe("already_used");
  });

  it("admits the same customer once her earlier unpaid order has been released", async () => {
    const w = world([order({ id: 1 })]);
    await releaseCouponClaims(w.payload, w.stripe, oncePer, "layla@example.com", NOW);
    expect(w.table.get(1)!.fulfilmentStatus).toBe("CANCELLED");
    expect(w.table.get(1)!.internalNotes).toBe(SUPERSEDED_NOTE);
    expect(w.cancelled).toEqual(["pi_1"]);
    expect(await couponClaimRefusal(w.payload, oncePer, "layla@example.com")).toBeNull();
  });

  it("still refuses when her earlier order is being paid at that moment", async () => {
    const w = world([order({ id: 1 })], { pi_1: "processing" });
    await releaseCouponClaims(w.payload, w.stripe, oncePer, "layla@example.com", NOW);
    /* Stripe refused the cancellation, so the order was put back. */
    expect(w.table.get(1)!.fulfilmentStatus).toBe("NEW");
    expect(w.table.get(1)!.internalNotes).toBe("");
    expect(await couponClaimRefusal(w.payload, oncePer, "layla@example.com")).toBe("already_used");
  });

  it("does not release another customer's fresh order", async () => {
    const w = world([order({ id: 1, customerEmail: "other@example.com" })]);
    await releaseCouponClaims(w.payload, w.stripe, oncePer, "layla@example.com", NOW);
    expect(w.table.get(1)!.fulfilmentStatus).toBe("NEW");
    expect(w.cancelled).toEqual([]);
  });
});

describe("releasing an unpaid order", () => {
  it("marks it CANCELLED first, then cancels the intent it finds on a fresh read", async () => {
    const w = world([order({ id: 1, stripePaymentIntentId: null })]);
    /* Checkout stores the intent id between our read and our write. */
    (w.payload.update as ReturnType<typeof vi.fn>).mockImplementationOnce(async ({ id, data }: { id: number; data: Partial<Order> }) => {
      w.table.set(id, { ...w.table.get(id)!, ...data, stripePaymentIntentId: "pi_late" });
      return w.table.get(id);
    });
    expect(await releaseUnpaidOrder(w.payload, w.stripe, order({ id: 1, stripePaymentIntentId: null }), STALE_DISCOUNT_NOTE)).toBe("released");
    expect(w.cancelled).toEqual(["pi_late"]);
    expect(w.table.get(1)!.fulfilmentStatus).toBe("CANCELLED");
  });

  it("needs no Stripe call for an order that never got an intent", async () => {
    const w = world([order({ id: 1, stripePaymentIntentId: null })]);
    expect(await releaseUnpaidOrder(w.payload, w.stripe, w.table.get(1)!, STALE_DISCOUNT_NOTE)).toBe("released");
    expect(w.stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it("treats an intent that is already cancelled as released", async () => {
    const w = world([order({ id: 1 })], { pi_1: "canceled" });
    (w.stripe.paymentIntents.cancel as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("already canceled"));
    expect(await releaseUnpaidOrder(w.payload, w.stripe, w.table.get(1)!, STALE_DISCOUNT_NOTE)).toBe("released");
    expect(w.table.get(1)!.fulfilmentStatus).toBe("CANCELLED");
  });

  it("puts the order back when the payment has succeeded or Stripe cannot be reached", async () => {
    for (const status of ["succeeded", "processing", "unreachable"]) {
      const w = world([order({ id: 1, internalNotes: "Call before delivery" })], { pi_1: status });
      expect(await releaseUnpaidOrder(w.payload, w.stripe, w.table.get(1)!, STALE_DISCOUNT_NOTE)).toBe("in-flight");
      expect(w.table.get(1)!.fulfilmentStatus).toBe("NEW");
      expect(w.table.get(1)!.internalNotes).toBe("Call before delivery");
    }
  });

  it("puts the order back when the webhook marked it paid in between", async () => {
    const w = world([order({ id: 1 })]);
    (w.payload.findByID as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...order({ id: 1 }), paymentStatus: "PAID" });
    expect(await releaseUnpaidOrder(w.payload, w.stripe, w.table.get(1)!, STALE_DISCOUNT_NOTE)).toBe("in-flight");
    expect(w.table.get(1)!.fulfilmentStatus).toBe("NEW");
    expect(w.stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });
});

describe("the stale sweep: a discounted price is held for an hour, not for ever", () => {
  it("holds for sixty minutes", () => {
    expect(DISCOUNT_HOLD_MINUTES).toBe(60);
    expect(staleBefore(NOW)).toBe("2026-10-05T09:00:00.000Z");
  });

  it("cancels the intent and the order of a stale discounted order — sale price or code", async () => {
    const w = world([
      order({ id: 1, createdAt: minutesAgo(61), stripePaymentIntentId: "pi_code" }),
      /* A sale-only order: no code, but a discount snapshot. */
      order({ id: 2, createdAt: minutesAgo(600), couponDiscount: null, discountSnapshot: { coupon: null, sales: [{ id: "3" }] }, stripePaymentIntentId: "pi_sale" }),
    ]);
    expect(await sweepStaleDiscountOrders(w.payload, w.stripe, NOW)).toEqual({ released: 2, inFlight: 0 });
    expect(w.cancelled.sort()).toEqual(["pi_code", "pi_sale"]);
    for (const id of [1, 2]) {
      expect(w.table.get(id)!.fulfilmentStatus).toBe("CANCELLED");
      expect(w.table.get(id)!.internalNotes).toBe(STALE_DISCOUNT_NOTE);
    }
  });

  it("leaves everything else alone", async () => {
    const w = world([
      order({ id: 1, createdAt: minutesAgo(59) }) /* still held */,
      order({ id: 2, createdAt: minutesAgo(600), discountSnapshot: null, couponDiscount: null }) /* full price */,
      order({ id: 3, createdAt: minutesAgo(600), paymentStatus: "PAID" }),
      order({ id: 4, createdAt: minutesAgo(600), fulfilmentStatus: "CANCELLED" }),
      order({ id: 5, createdAt: minutesAgo(600), fulfilmentStatus: "CONFIRMED" }) /* staff are working on it */,
      order({ id: 6, createdAt: minutesAgo(600), source: "admin-quote" }) /* a payment request */,
    ]);
    expect(await sweepStaleDiscountOrders(w.payload, w.stripe, NOW)).toEqual({ released: 0, inFlight: 0 });
    expect(w.cancelled).toEqual([]);
    expect(w.payload.update).not.toHaveBeenCalled();
  });

  it("does not cancel a stale order that is being paid right now", async () => {
    const w = world([order({ id: 1, createdAt: minutesAgo(120) })], { pi_1: "processing" });
    expect(await sweepStaleDiscountOrders(w.payload, w.stripe, NOW)).toEqual({ released: 0, inFlight: 1 });
    expect(w.table.get(1)!.fulfilmentStatus).toBe("NEW");
  });

  it("works in small batches, oldest first, and one failure does not stop the rest", async () => {
    const w = world([
      order({ id: 1, createdAt: minutesAgo(300), stripePaymentIntentId: "pi_a" }),
      order({ id: 2, createdAt: minutesAgo(200), stripePaymentIntentId: "pi_b" }),
      order({ id: 3, createdAt: minutesAgo(100), stripePaymentIntentId: "pi_c" }),
    ]);
    (w.payload.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("connection reset"));
    expect(await sweepStaleDiscountOrders(w.payload, w.stripe, NOW, 2)).toEqual({ released: 1, inFlight: 1 });
    expect(w.cancelled).toEqual(["pi_b"]);
    expect(w.table.get(3)!.fulfilmentStatus).toBe("NEW");
  });

  it("releases a limited code's stale claims before the next customer is counted", async () => {
    const w = world([
      order({ id: 1, createdAt: minutesAgo(90), customerEmail: "a@example.com", stripePaymentIntentId: "pi_a" }),
      order({ id: 2, createdAt: minutesAgo(80), customerEmail: "b@example.com", stripePaymentIntentId: "pi_b" }),
    ]);
    /* Both uses are held by forms nobody finished. */
    expect(await couponClaimRefusal(w.payload, limited, "new@example.com")).toBe("exhausted");
    await releaseCouponClaims(w.payload, w.stripe, limited, "new@example.com", NOW);
    expect(w.cancelled.sort()).toEqual(["pi_a", "pi_b"]);
    expect(await couponClaimRefusal(w.payload, limited, "new@example.com")).toBeNull();
  });
});
