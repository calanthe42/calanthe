import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import { ensureOrderPaymentIntent, type IntentOrder } from "./intent";

/**
 * One order, one PaymentIntent. A fake Stripe client and a fake Payload —
 * nothing here talks to either.
 */

type FakeIntent = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  client_secret: string | null;
  metadata: Record<string, string>;
};

const ORDER: IntentOrder = {
  id: 12,
  orderNumber: "CAL-000012",
  totalFils: 65000,
  customerEmail: "layla@example.com",
  source: "admin-quote",
};

const fakeIntent = (overrides: Partial<FakeIntent> = {}): FakeIntent => ({
  id: "pi_new",
  status: "requires_payment_method",
  amount: 65000,
  currency: "aed",
  client_secret: "pi_new_secret",
  metadata: { kind: "order", orderId: "12", orderNumber: "CAL-000012" },
  ...overrides,
});

function harness(options: { created?: FakeIntent; stored?: FakeIntent; updateFails?: boolean } = {}) {
  const create = vi.fn().mockResolvedValue(options.created ?? fakeIntent());
  const retrieve = vi.fn().mockResolvedValue(options.stored ?? fakeIntent());
  const cancel = vi.fn().mockResolvedValue({});
  const update = options.updateFails
    ? vi.fn().mockRejectedValue(new Error("database is down"))
    : vi.fn().mockResolvedValue({});
  const payload = { update, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown as Payload;
  const stripe = { paymentIntents: { create, retrieve, cancel } } as never;
  return { payload, stripe, create, retrieve, cancel, update };
}

describe("ensureOrderPaymentIntent — no intent yet", () => {
  it("creates one for exactly the order's total, in AED, keyed to the order", async () => {
    const h = harness();
    const result = await ensureOrderPaymentIntent(h.payload, h.stripe, ORDER);

    expect(result).toEqual({ kind: "ready", clientSecret: "pi_new_secret", intentId: "pi_new" });
    expect(h.create).toHaveBeenCalledTimes(1);
    const [params, options] = h.create.mock.calls[0]!;
    expect(params.amount).toBe(65000);
    expect(params.currency).toBe("aed");
    expect(params.receipt_email).toBe("layla@example.com");
    expect(params.metadata).toMatchObject({ kind: "order", orderId: "12", orderNumber: "CAL-000012" });
    expect(options).toEqual({ idempotencyKey: "order-12" });
    expect(h.retrieve).not.toHaveBeenCalled();
  });

  it("stores the intent id on the order before releasing the secret", async () => {
    const h = harness();
    await ensureOrderPaymentIntent(h.payload, h.stripe, ORDER);
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "orders", id: 12, data: { stripePaymentIntentId: "pi_new" } }),
    );
  });

  it("cancels the intent and returns NO secret when the id cannot be stored", async () => {
    const h = harness({ updateFails: true });
    const result = await ensureOrderPaymentIntent(h.payload, h.stripe, ORDER);
    expect(result.kind).toBe("failed");
    expect(result).not.toHaveProperty("clientSecret");
    expect(h.cancel).toHaveBeenCalledWith("pi_new");
  });

  it("returns no secret when Stripe's amount differs from the order total", async () => {
    const h = harness({ created: fakeIntent({ amount: 64900 }) });
    const result = await ensureOrderPaymentIntent(h.payload, h.stripe, ORDER);
    expect(result.kind).toBe("failed");
    expect(result).not.toHaveProperty("clientSecret");
    expect(h.update).not.toHaveBeenCalled();
  });

  it("returns no secret for a non-AED intent or another order's intent", async () => {
    for (const created of [
      fakeIntent({ currency: "usd" }),
      fakeIntent({ metadata: { kind: "order", orderId: "13", orderNumber: "CAL-000013" } }),
    ]) {
      const h = harness({ created });
      expect((await ensureOrderPaymentIntent(h.payload, h.stripe, ORDER)).kind).toBe("failed");
    }
  });

  it("never throws: a Stripe error is a failed result", async () => {
    const h = harness();
    h.create.mockRejectedValue(new Error("stripe is down"));
    expect(await ensureOrderPaymentIntent(h.payload, h.stripe, ORDER)).toEqual({
      kind: "failed",
      reason: "stripe is down",
    });
  });
});

describe("ensureOrderPaymentIntent — an intent is already stored", () => {
  const withStored = { ...ORDER, stripePaymentIntentId: "pi_old" };

  it("reuses it: retrieve only, never a second create", async () => {
    const h = harness({ stored: fakeIntent({ id: "pi_old", client_secret: "pi_old_secret" }) });
    const result = await ensureOrderPaymentIntent(h.payload, h.stripe, withStored);
    expect(result).toEqual({ kind: "ready", clientSecret: "pi_old_secret", intentId: "pi_old" });
    expect(h.retrieve).toHaveBeenCalledWith("pi_old");
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });

  it.each(["succeeded", "processing"])("reports %s as processing and creates nothing", async (status) => {
    const h = harness({ stored: fakeIntent({ id: "pi_old", status }) });
    const result = await ensureOrderPaymentIntent(h.payload, h.stripe, withStored);
    expect(result).toEqual({ kind: "processing", intentId: "pi_old" });
    expect(h.create).not.toHaveBeenCalled();
  });

  it("does NOT replace a cancelled intent for a customer", async () => {
    const h = harness({ stored: fakeIntent({ id: "pi_old", status: "canceled" }) });
    const result = await ensureOrderPaymentIntent(h.payload, h.stripe, withStored);
    expect(result).toEqual({ kind: "canceled", intentId: "pi_old" });
    expect(h.create).not.toHaveBeenCalled();
  });

  it("replaces a cancelled intent for staff, under a DIFFERENT idempotency key", async () => {
    const h = harness({ stored: fakeIntent({ id: "pi_old", status: "canceled" }) });
    const result = await ensureOrderPaymentIntent(h.payload, h.stripe, withStored, { replaceCanceled: true });
    expect(result).toEqual({ kind: "ready", clientSecret: "pi_new_secret", intentId: "pi_new" });
    const [params, options] = h.create.mock.calls[0]!;
    expect(params.amount).toBe(65000);
    expect(options.idempotencyKey).toBe("order-12-r-pi_old");
    expect(options.idempotencyKey).not.toBe("order-12");
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stripePaymentIntentId: "pi_new" } }),
    );
  });

  it("returns no secret when the stored intent's amount is not the order's total", async () => {
    const h = harness({ stored: fakeIntent({ id: "pi_old", amount: 1000 }) });
    const result = await ensureOrderPaymentIntent(h.payload, h.stripe, withStored);
    expect(result.kind).toBe("failed");
    expect(result).not.toHaveProperty("clientSecret");
  });
});
