import { describe, expect, it } from "vitest";
import { paymentVerdict, type IntentFacts } from "./verdict";

const intent = (over: Partial<IntentFacts> = {}): IntentFacts => ({
  id: "pi_1",
  status: "succeeded",
  amount: 48000,
  amountReceived: 48000,
  currency: "aed",
  metadata: { kind: "order", orderId: "7" },
  ...over,
});
const order = { id: 7, totalFils: 48000, paymentStatus: "PENDING" };

describe("paymentVerdict", () => {
  it("marks paid only when everything agrees", () => {
    expect(paymentVerdict(intent(), order)).toEqual({ action: "mark-paid" });
  });

  it("is idempotent: a replayed success changes nothing", () => {
    expect(paymentVerdict(intent(), { ...order, paymentStatus: "PAID" })).toEqual({ action: "already-paid" });
  });

  it("never marks paid on an amount that differs from our total", () => {
    expect(paymentVerdict(intent({ amountReceived: 100 }), order).action).toBe("flag");
    expect(paymentVerdict(intent({ amount: 100, amountReceived: 100 }), order).action).toBe("flag");
  });

  it("refuses a non-AED intent, another order's intent, or a missing order", () => {
    expect(paymentVerdict(intent({ currency: "usd" }), order).action).toBe("flag");
    expect(paymentVerdict(intent({ metadata: { kind: "order", orderId: "8" } }), order).action).toBe("flag");
    expect(paymentVerdict(intent(), null).action).toBe("flag");
  });

  it("ignores intents that did not succeed, and intents that are not orders", () => {
    expect(paymentVerdict(intent({ status: "processing" }), order).action).toBe("ignore");
    expect(paymentVerdict(intent({ metadata: { kind: "membership" } }), order).action).toBe("ignore");
  });
});

/**
 * ONE ORDER, ONE INTENT. The order stores the id of the PaymentIntent that
 * was created for it; a succeeded intent with any other id is a second
 * charge or another environment's payment, and must be flagged — never
 * swallowed as "already paid".
 */
describe("paymentVerdict — the stored intent", () => {
  const stored = { ...order, orderNumber: "CAL-000007", stripePaymentIntentId: "pi_1" };

  it("marks paid when the intent is the one stored on the order", () => {
    expect(paymentVerdict(intent(), stored)).toEqual({ action: "mark-paid" });
  });

  it("FLAGS a second successful intent for an order that is already paid — a double charge", () => {
    const verdict = paymentVerdict(intent({ id: "pi_2" }), { ...stored, paymentStatus: "PAID" });
    expect(verdict.action).toBe("flag");
    expect(verdict).toMatchObject({ reason: expect.stringMatching(/second payment for a paid order/) });
    expect(verdict).toMatchObject({ reason: expect.stringContaining("pi_2") });
  });

  it("flags a different intent on an unpaid order too, rather than marking it paid", () => {
    const verdict = paymentVerdict(intent({ id: "pi_2" }), stored);
    expect(verdict.action).toBe("flag");
    expect(verdict).toMatchObject({ reason: expect.stringMatching(/not the one created for this order/) });
  });

  it("is still idempotent for a replay of the SAME intent", () => {
    expect(paymentVerdict(intent(), { ...stored, paymentStatus: "PAID" })).toEqual({ action: "already-paid" });
  });

  it("treats a refunded order as already paid, never as payable again", () => {
    for (const paymentStatus of ["REFUNDED", "PARTIALLY_REFUNDED"]) {
      expect(paymentVerdict(intent(), { ...stored, paymentStatus })).toEqual({ action: "already-paid" });
    }
  });

  it("accepts an order from before the id was stored", () => {
    expect(paymentVerdict(intent(), { ...order, stripePaymentIntentId: null })).toEqual({ action: "mark-paid" });
  });

  it("flags an intent whose order NUMBER is another environment's, though the id matches", () => {
    /* Preview and production share a Stripe test account; "order 7" exists
       in both databases. */
    const foreign = intent({ metadata: { kind: "order", orderId: "7", orderNumber: "CAL-000999" } });
    expect(paymentVerdict(foreign, stored).action).toBe("flag");
    const own = intent({ metadata: { kind: "order", orderId: "7", orderNumber: "CAL-000007" } });
    expect(paymentVerdict(own, stored)).toEqual({ action: "mark-paid" });
  });

  it("flags an amount mismatch on a payment request exactly as on a shop order", () => {
    const quote = { id: 7, totalFils: 65000, paymentStatus: "PENDING", stripePaymentIntentId: "pi_1" };
    expect(paymentVerdict(intent({ amount: 64900, amountReceived: 64900 }), quote).action).toBe("flag");
    expect(paymentVerdict(intent({ amount: 65000, amountReceived: 65000 }), quote)).toEqual({ action: "mark-paid" });
  });
});

describe("paymentVerdict — a discounted order", () => {
  /* AED 480 with a code taking AED 48 off: the order's total IS the
     discounted total, so nothing in the verdict had to change for discounts. */
  const discounted = { id: 7, totalFils: 43200, paymentStatus: "PENDING" };

  it("is paid when the intent is for the discounted total", () => {
    expect(paymentVerdict(intent({ amount: 43200, amountReceived: 43200 }), discounted)).toEqual({
      action: "mark-paid",
    });
  });

  it("is flagged when the intent is for the undiscounted amount", () => {
    const verdict = paymentVerdict(intent({ amount: 48000, amountReceived: 48000 }), discounted);
    expect(verdict.action).toBe("flag");
  });
});
