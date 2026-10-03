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
