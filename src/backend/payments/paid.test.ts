import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";
import type Stripe from "stripe";

/* paid.ts is server-only and reads the environment at import; neither exists
   in a unit test. The secret is a fixed string so the pay link is stable. */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    PAYLOAD_SECRET: "s".repeat(40),
    EMAIL_FROM: "Calanthe <orders@calanthe.ae>",
    EMAIL_REPLY_TO: "owner@example.com",
    EMAIL_OWNER: "owner@example.com",
    EMAIL_STAFF: "owner@example.com",
    /* Outside production only allowlisted addresses are emailed. */
    EMAIL_ALLOWLIST: "@example.com",
  },
}));

import { setEmailProvider } from "@backend/email/send";
import type { SendRequest } from "@backend/email/types";
import { PAYMENT_PROVIDER_CONTEXT } from "@backend/payload/hooks/orderIntegrity";
import type { ClaimInvoice, StampPaid } from "./invoice-number";
import { LATE_DISCOUNT_NOTE, PAID_AFTER_CANCEL_NOTE, applySucceededIntent, overLimitNote } from "./paid";
import type { RedeemCoupon } from "./redeem";

/**
 * The paid path, end to end, with nothing real behind it: a fake Payload, an
 * injected invoice claim, and a provider that records what would be sent.
 */

type Doc = Record<string, unknown>;

const NOW = new Date("2026-10-04T10:00:00.000Z");

const quoteOrder = (overrides: Doc = {}): Doc => ({
  id: 12,
  orderNumber: "CAL-000012",
  source: "admin-quote",
  enquiry: 45,
  locale: "en",
  paymentStatus: "PENDING",
  fulfilmentStatus: "NEW",
  stripePaymentIntentId: "pi_1",
  payTokenSalt: "salt",
  customerName: "Layla Ahmed",
  customerEmail: "layla@example.com",
  customerPhone: "+971501234567",
  deliveryAddress: "Villa 4, Al Reem Island",
  deliveryEmirate: "abu-dhabi",
  deliveryDate: "2026-10-10T08:00:00.000Z",
  deliveryTimeSlot: "13:00 – 17:00",
  items: [{ productName: "Bespoke arrangement", quantity: 1, unitPriceFils: 65000, lineTotalFils: 65000 }],
  subtotalFils: 65000,
  deliveryFeeFils: 0,
  discountFils: 0,
  totalFils: 65000,
  ...overrides,
});

const shopOrder = (overrides: Doc = {}): Doc => ({
  ...quoteOrder(),
  source: "web-checkout-card",
  enquiry: null,
  payTokenSalt: null,
  items: [{ productName: "Amber Hour", quantity: 1, unitPriceFils: 62500, lineTotalFils: 62500 }],
  subtotalFils: 62500,
  deliveryFeeFils: 2500,
  ...overrides,
});

const intent = (overrides: Doc = {}): Stripe.PaymentIntent =>
  ({
    id: "pi_1",
    status: "succeeded",
    amount: 65000,
    amount_received: 65000,
    currency: "aed",
    metadata: { kind: "order", orderId: "12", orderNumber: "CAL-000012" },
    ...overrides,
  }) as unknown as Stripe.PaymentIntent;

function harness(order: Doc | null, claim: ClaimInvoice | "win" | "lose" | "throw" = "win") {
  const updates: { collection: string; id: unknown; data: Doc; context?: Doc }[] = [];
  const payload = {
    findByID: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === "orders") {
        if (!order) throw new Error("not found");
        return order;
      }
      return { id: 45, enquiryNumber: "CAL-E-000045" };
    }),
    update: vi.fn(async (args: { collection: string; id: unknown; data: Doc; context?: Doc }) => {
      updates.push(args);
      return args.collection === "enquiries" ? { id: 45, enquiryNumber: "CAL-E-000045" } : { ...order, ...args.data };
    }),
    /* The email log write. */
    create: vi.fn(async () => ({})),
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as Payload;

  const claimInvoice = vi.fn<ClaimInvoice>(
    typeof claim === "function"
      ? claim
      : async () => {
          if (claim === "throw") throw new Error("deadlock detected");
          return { invoiceNumber: "CAL-INV-2026-00001", claimedNow: claim === "win" };
        },
  );

  return { payload, updates, claimInvoice, deps: { claimInvoice, now: () => NOW } };
}

let sent: SendRequest[] = [];

beforeEach(() => {
  sent = [];
  setEmailProvider({
    name: "recording",
    send: async (request) => {
      sent.push(request);
      return { status: "sent", providerId: `id-${sent.length}` };
    },
  });
});

afterEach(() => setEmailProvider(null));

const types = () => sent.map((request) => request.type).sort();

describe("a payment request is paid", () => {
  it("marks it PAID under the provider context, confirms it, invoices it and sends the three emails once", async () => {
    const h = harness(quoteOrder());
    const outcome = await applySucceededIntent(h.payload, intent(), h.deps);

    expect(outcome).toBe("marked-paid");

    const paid = h.updates.find((u) => u.collection === "orders")!;
    expect(paid.context).toEqual({ [PAYMENT_PROVIDER_CONTEXT]: true });
    expect(paid.data).toMatchObject({
      paymentStatus: "PAID",
      stripePaymentIntentId: "pi_1",
      paidAt: NOW.toISOString(),
      fulfilmentStatus: "CONFIRMED",
    });
    expect(paid.data).not.toHaveProperty("internalNotes");

    expect(h.claimInvoice).toHaveBeenCalledTimes(1);
    expect(h.claimInvoice.mock.calls[0]![1]).toEqual({
      orderId: 12,
      year: 2026,
      /* VAT is off: the snapshot is zero. */
      vatRateBps: 0,
      vatIncludedFils: 0,
      paidAtIso: NOW.toISOString(),
    });

    expect(types()).toEqual(["florist-job-sheet", "owner-quote-paid", "payment-received"]);
    const customer = sent.find((r) => r.type === "payment-received")!;
    expect(customer.to).toBe("layla@example.com");
    expect(customer.rendered.html).toContain("CAL-INV-2026-00001");
    expect(customer.rendered.html).toContain("AED 650");

    const enquiry = h.updates.find((u) => u.collection === "enquiries")!;
    expect(enquiry).toMatchObject({ id: 45, data: { status: "CONVERTED" } });
  });

  it("tells the shop: the owner's notice names the order, the amount and the enquiry", async () => {
    const h = harness(quoteOrder());
    await applySucceededIntent(h.payload, intent(), h.deps);
    const owner = sent.find((r) => r.type === "owner-quote-paid")!;
    expect(owner.to).toBe("owner@example.com");
    expect(owner.rendered.subject).toBe("Paid: CAL-000012 — AED 650 (bespoke, CAL-E-000045)");
  });

  it("keeps the florist's sheet free of money", async () => {
    const h = harness(quoteOrder());
    await applySucceededIntent(h.payload, intent(), h.deps);
    const sheet = sent.find((r) => r.type === "florist-job-sheet")!;
    expect(sheet.rendered.html).not.toMatch(/AED|650/);
    expect(sheet.rendered.text).not.toMatch(/AED|650/);
    expect(sheet.rendered.html).toContain("Bespoke arrangement");
  });

  it("writes to an Arabic customer in Arabic", async () => {
    const h = harness(quoteOrder({ locale: "ar" }));
    await applySucceededIntent(h.payload, intent(), h.deps);
    const customer = sent.find((r) => r.type === "payment-received")!;
    expect(customer.rendered.html).toContain('dir="rtl"');
    expect(customer.rendered.subject).toContain("فاتورتكم");
  });
});

describe("the single-winner gate", () => {
  it("sends NOTHING when another delivery already claimed the invoice", async () => {
    const h = harness(quoteOrder(), "lose");
    const outcome = await applySucceededIntent(h.payload, intent(), h.deps);
    expect(outcome).toBe("already-paid");
    expect(sent).toEqual([]);
    expect(h.updates.some((u) => u.collection === "enquiries")).toBe(false);
  });

  it("does nothing at all for a replay of an order that is paid and invoiced", async () => {
    const h = harness(quoteOrder({ paymentStatus: "PAID", invoiceNumber: "CAL-INV-2026-00001" }));
    const outcome = await applySucceededIntent(h.payload, intent(), h.deps);
    expect(outcome).toBe("already-paid");
    expect(h.updates).toEqual([]);
    expect(h.claimInvoice).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("rejects when the claim throws, so the route answers 500 and Stripe retries", async () => {
    const h = harness(quoteOrder(), "throw");
    await expect(applySucceededIntent(h.payload, intent(), h.deps)).rejects.toThrow(/deadlock/);
    expect(sent).toEqual([]);
  });
});

describe("crash recovery: PAID but never invoiced", () => {
  it("claims the invoice and sends the emails when it is the same payment, inside Stripe's retry window", async () => {
    const h = harness(
      quoteOrder({ paymentStatus: "PAID", fulfilmentStatus: "CONFIRMED", paidAt: "2026-10-04T09:58:00.000Z" }),
    );
    const outcome = await applySucceededIntent(h.payload, intent(), h.deps);
    expect(outcome).toBe("marked-paid");
    /* No second PAID write. */
    expect(h.updates.filter((u) => u.collection === "orders")).toEqual([]);
    expect(h.claimInvoice).toHaveBeenCalledTimes(1);
    /* The original payment time is kept. */
    expect(h.claimInvoice.mock.calls[0]![1].paidAtIso).toBe("2026-10-04T09:58:00.000Z");
    expect(types()).toEqual(["florist-job-sheet", "owner-quote-paid", "payment-received"]);
  });

  it("issues the invoice SILENTLY for an old order whose event was resent from the dashboard", async () => {
    const old = harness(
      shopOrder({ paymentStatus: "PAID", fulfilmentStatus: "DELIVERED", paidAt: "2026-06-01T09:00:00.000Z" }),
    );
    expect(await applySucceededIntent(old.payload, intent(), old.deps)).toBe("invoice-issued");
    expect(old.claimInvoice).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);

    /* An order from before intent ids were stored: also silent. */
    const legacy = harness(shopOrder({ paymentStatus: "PAID", stripePaymentIntentId: null, paidAt: null }));
    expect(await applySucceededIntent(legacy.payload, intent(), legacy.deps)).toBe("invoice-issued");
    expect(sent).toEqual([]);
  });
});

describe("money that disagrees is flagged, never applied", () => {
  it("flags an amount mismatch on a payment request: no PAID, no invoice, no emails", async () => {
    const h = harness(quoteOrder());
    const outcome = await applySucceededIntent(h.payload, intent({ amount: 64900, amount_received: 64900 }), h.deps);
    expect(outcome).toBe("flagged");
    expect(h.claimInvoice).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0]!.data).not.toHaveProperty("paymentStatus");
    expect(String(h.updates[0]!.data.internalNotes)).toMatch(/PAYMENT CHECK: amount mismatch/);
  });

  it("flags a SECOND intent on a paid order instead of swallowing the double charge", async () => {
    const h = harness(quoteOrder({ paymentStatus: "PAID", invoiceNumber: "CAL-INV-2026-00001" }));
    const outcome = await applySucceededIntent(h.payload, intent({ id: "pi_2" }), h.deps);
    expect(outcome).toBe("flagged");
    expect(String(h.updates[0]!.data.internalNotes)).toMatch(/second payment for a paid order/);
    expect(String(h.updates[0]!.data.internalNotes)).toContain("pi_2");
    expect(sent).toEqual([]);
  });

  it("writes the same warning only once, however often Stripe repeats the event", async () => {
    const reason =
      "⚠ PAYMENT CHECK: second payment for a paid order — refund pi_2 in Stripe (the order was paid by pi_1)";
    const h = harness(quoteOrder({ paymentStatus: "PAID", invoiceNumber: "CAL-INV-2026-00001", internalNotes: reason }));
    expect(await applySucceededIntent(h.payload, intent({ id: "pi_2" }), h.deps)).toBe("flagged");
    expect(h.updates).toEqual([]);
  });

  it("ignores an intent that is not an order's, or has not succeeded", async () => {
    const h = harness(quoteOrder());
    expect(await applySucceededIntent(h.payload, intent({ metadata: { kind: "membership" } }), h.deps)).toBe("ignore");
    expect(await applySucceededIntent(h.payload, intent({ status: "processing" }), h.deps)).toBe("ignore");
    expect(h.updates).toEqual([]);
  });
});

describe("paid after cancellation", () => {
  it("still marks it PAID, leaves it cancelled, and tells a human loudly", async () => {
    const h = harness(quoteOrder({ fulfilmentStatus: "CANCELLED" }));
    const outcome = await applySucceededIntent(h.payload, intent(), h.deps);
    expect(outcome).toBe("marked-paid");

    const paid = h.updates.find((u) => u.collection === "orders")!;
    expect(paid.data.paymentStatus).toBe("PAID");
    /* Not un-cancelled: a human decides, and the decision is "refund". */
    expect(paid.data).not.toHaveProperty("fulfilmentStatus");
    expect(paid.data.internalNotes).toBe(PAID_AFTER_CANCEL_NOTE);

    const owner = sent.find((r) => r.type === "owner-quote-paid")!;
    expect(owner.rendered.html).toMatch(/cancelled before the payment arrived/);
    expect(owner.rendered.text).toMatch(/Refund the payment in Stripe — do not reinstate/);
  });
});

describe("a website order", () => {
  it("still sends the original three emails, and now gets an invoice number too", async () => {
    const h = harness(shopOrder());
    const outcome = await applySucceededIntent(h.payload, intent(), h.deps);
    expect(outcome).toBe("marked-paid");
    expect(types()).toEqual(["florist-job-sheet", "order-confirmation", "owner-new-order"]);
    expect(h.claimInvoice).toHaveBeenCalledTimes(1);

    const paid = h.updates.find((u) => u.collection === "orders")!;
    expect(paid.data.paymentStatus).toBe("PAID");
    /* Only a payment request is confirmed by being paid. */
    expect(paid.data).not.toHaveProperty("fulfilmentStatus");
    expect(h.updates.some((u) => u.collection === "enquiries")).toBe(false);
  });

  it("stores the intent id on an order created before ids were stored", async () => {
    const h = harness(shopOrder({ stripePaymentIntentId: null }));
    await applySucceededIntent(h.payload, intent(), h.deps);
    expect(h.updates.find((u) => u.collection === "orders")!.data.stripePaymentIntentId).toBe("pi_1");
  });
});

describe("a discounted website order", () => {
  /* AED 480 on a 20% sale (384) + vase 60 = 444; EID10 takes 45 → 399. */
  const discounted = (overrides: Doc = {}): Doc =>
    shopOrder({
      items: [
        { productName: "Amber Hour", quantity: 1, unitPriceFils: 44400, lineTotalFils: 44400, compareAtUnitPriceFils: 54000 },
      ],
      subtotalFils: 44400,
      deliveryFeeFils: 0,
      discountFils: 4500,
      couponDiscountFils: 4500,
      couponCode: "EID10",
      couponDiscount: 9,
      discountSnapshot: { coupon: { id: "9", code: "EID10" }, sales: [{ id: "3" }] },
      totalFils: 39900,
      createdAt: "2026-10-04T09:50:00.000Z",
      ...overrides,
    });
  const paidIntent = (overrides: Doc = {}) => intent({ amount: 39900, amount_received: 39900, ...overrides });

  const withRedeem = (order: Doc | null, redeem: RedeemCoupon, claim: Parameters<typeof harness>[1] = "win") => {
    const h = harness(order, claim);
    const redeemCoupon = vi.fn<RedeemCoupon>(redeem);
    return { ...h, redeemCoupon, deps: { ...h.deps, redeemCoupon } };
  };
  const counted: RedeemCoupon = async () => ({ redeemed: true, overLimit: false, timesUsed: 3, usageLimit: 20 });

  it("is paid for its DISCOUNTED total, and the code is counted once, after PAID and before the invoice", async () => {
    const calls: string[] = [];
    const h = withRedeem(discounted(), async () => {
      calls.push("redeem");
      return { redeemed: true, overLimit: false };
    });
    h.claimInvoice.mockImplementation(async () => {
      calls.push("invoice");
      return { invoiceNumber: "CAL-INV-2026-00001", claimedNow: true };
    });
    (h.payload.update as ReturnType<typeof vi.fn>).mockImplementation(async (args: { collection: string; data: Doc }) => {
      if (args.collection === "orders" && args.data.paymentStatus === "PAID") calls.push("paid");
      h.updates.push(args as never);
      return {};
    });

    expect(await applySucceededIntent(h.payload, paidIntent(), h.deps)).toBe("marked-paid");
    expect(calls).toEqual(["paid", "redeem", "invoice"]);
    expect(h.redeemCoupon).toHaveBeenCalledTimes(1);
    expect(h.redeemCoupon.mock.calls[0]![1]).toBe(12);
    /* Nothing to tell the owner: no note was written. */
    expect(h.updates.filter((u) => "internalNotes" in u.data)).toEqual([]);
  });

  it("is flagged, not paid, when the intent is for the UNDISCOUNTED amount", async () => {
    const h = withRedeem(discounted(), counted);
    expect(await applySucceededIntent(h.payload, paidIntent({ amount: 54000, amount_received: 54000 }), h.deps)).toBe("flagged");
    expect(h.redeemCoupon).not.toHaveBeenCalled();
    expect(h.claimInvoice).not.toHaveBeenCalled();
  });

  it("puts the code and the savings in the customer's and the owner's email, from the order's snapshot", async () => {
    const h = withRedeem(discounted(), counted);
    await applySucceededIntent(h.payload, paidIntent(), h.deps);
    const confirmation = sent.find((r) => r.type === "order-confirmation")!;
    expect(confirmation.rendered.text).toContain("Discount (EID10): −AED 45");
    /* (540 − 444) on the sale + 45 on the code. */
    expect(confirmation.rendered.text).toContain("You saved AED 141 on this order.");
    expect(confirmation.rendered.text).toContain("Total: AED 399");
    const owner = sent.find((r) => r.type === "owner-new-order")!;
    expect(owner.rendered.text).toContain("Discount code EID10");
    expect(owner.rendered.text).toContain("Sale savings included: AED 96.");
    const sheet = sent.find((r) => r.type === "florist-job-sheet")!;
    expect(sheet.rendered.text).not.toMatch(/AED|EID10/);
  });

  it("does not call redeem at all for an order with no code", async () => {
    const h = withRedeem(shopOrder(), counted);
    await applySucceededIntent(h.payload, intent(), h.deps);
    expect(h.redeemCoupon).not.toHaveBeenCalled();
  });

  it("does not redeem again on the ordinary replay of a paid, invoiced order", async () => {
    const h = withRedeem(discounted({ paymentStatus: "PAID", invoiceNumber: "CAL-INV-2026-00001" }), counted);
    expect(await applySucceededIntent(h.payload, paidIntent(), h.deps)).toBe("already-paid");
    expect(h.redeemCoupon).not.toHaveBeenCalled();
  });

  it("HEALS a crash between PAID and the count: the retry redeems, then invoices", async () => {
    const h = withRedeem(
      discounted({ paymentStatus: "PAID", paidAt: "2026-10-04T09:58:00.000Z", couponRedeemedAt: null }),
      counted,
    );
    expect(await applySucceededIntent(h.payload, paidIntent(), h.deps)).toBe("marked-paid");
    expect(h.redeemCoupon).toHaveBeenCalledTimes(1);
    expect(h.claimInvoice).toHaveBeenCalledTimes(1);
    /* No second PAID write. */
    expect(h.updates.filter((u) => u.data.paymentStatus === "PAID")).toEqual([]);
  });

  it("still redeems for the delivery that LOSES the invoice — the statement itself is exactly-once", async () => {
    const h = withRedeem(discounted(), async () => ({ redeemed: false, overLimit: false }), "lose");
    expect(await applySucceededIntent(h.payload, paidIntent(), h.deps)).toBe("already-paid");
    expect(h.redeemCoupon).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
  });

  it("never lets a failed count undo PAID, stop the invoice or stop the emails", async () => {
    const h = withRedeem(discounted(), async () => {
      throw new Error("connection terminated");
    });
    expect(await applySucceededIntent(h.payload, paidIntent(), h.deps)).toBe("marked-paid");
    expect(h.updates.find((u) => u.data.paymentStatus === "PAID")).toBeDefined();
    expect(h.claimInvoice).toHaveBeenCalledTimes(1);
    expect(types()).toEqual(["florist-job-sheet", "order-confirmation", "owner-new-order"]);
    expect((h.payload.logger.error as ReturnType<typeof vi.fn>).mock.calls.join(" ")).toMatch(/could not be counted/);
  });

  it("honours a use past the limit and tells the owner on the order, once", async () => {
    const over: RedeemCoupon = async () => ({ redeemed: true, overLimit: true, timesUsed: 21, usageLimit: 20 });
    const h = withRedeem(discounted(), over);
    expect(await applySucceededIntent(h.payload, paidIntent(), h.deps)).toBe("marked-paid");
    const note = h.updates.find((u) => typeof u.data.internalNotes === "string")!;
    expect(note.data.internalNotes).toBe(overLimitNote("EID10"));
    expect(types()).toEqual(["florist-job-sheet", "order-confirmation", "owner-new-order"]);

    /* The note is already there: nothing is written a second time. */
    const again = withRedeem(discounted({ internalNotes: overLimitNote("EID10") }), over);
    await applySucceededIntent(again.payload, paidIntent(), again.deps);
    expect(again.updates.filter((u) => "internalNotes" in u.data)).toEqual([]);
  });

  it("flags a discounted order paid after its price hold ended", async () => {
    /* Created 3 hours before it was paid: the payment form was kept open. */
    const h = withRedeem(discounted({ createdAt: "2026-10-04T07:00:00.000Z" }), counted);
    expect(await applySucceededIntent(h.payload, paidIntent(), h.deps)).toBe("marked-paid");
    const note = h.updates.find((u) => typeof u.data.internalNotes === "string")!;
    expect(note.data.internalNotes).toBe(LATE_DISCOUNT_NOTE);
  });

  it("does not flag a full-price order paid late, nor a discounted one paid in time", async () => {
    const fullPrice = withRedeem(shopOrder({ createdAt: "2026-10-01T07:00:00.000Z" }), counted);
    await applySucceededIntent(fullPrice.payload, intent(), fullPrice.deps);
    expect(fullPrice.updates.filter((u) => "internalNotes" in u.data)).toEqual([]);

    const inTime = withRedeem(discounted({ createdAt: "2026-10-04T09:01:00.000Z" }), counted);
    await applySucceededIntent(inTime.payload, paidIntent(), inTime.deps);
    expect(inTime.updates.filter((u) => "internalNotes" in u.data)).toEqual([]);
  });

  it("marks a web order PAID and tells a human when it was released before the payment landed", async () => {
    const h = withRedeem(discounted({ fulfilmentStatus: "CANCELLED" }), counted);
    expect(await applySucceededIntent(h.payload, paidIntent(), h.deps)).toBe("marked-paid");
    const paid = h.updates.find((u) => u.data.paymentStatus === "PAID")!;
    expect(paid.data.internalNotes).toBe(PAID_AFTER_CANCEL_NOTE);
    expect(paid.data).not.toHaveProperty("fulfilmentStatus");
  });
});

describe("a payment request never redeems a code", () => {
  it("has none by rule, so the count is never asked for", async () => {
    const h = harness(quoteOrder());
    const redeemCoupon = vi.fn<RedeemCoupon>(async () => ({ redeemed: true, overLimit: false }));
    await applySucceededIntent(h.payload, intent(), { ...h.deps, redeemCoupon });
    expect(redeemCoupon).not.toHaveBeenCalled();
  });
});

/**
 * AN INVOICE WRITTEN BY HAND HAS ITS NUMBER BEFORE IT IS PAID. Paying it by
 * card must keep that number, must not touch the counter, and must still
 * thank the customer exactly once — the gate is the payment stamp.
 */
describe("an invoice written by hand is paid by card", () => {
  const manualOrder = (overrides: Doc = {}): Doc =>
    quoteOrder({
      source: "admin-manual",
      enquiry: null,
      invoiceNumber: "CAL-INV-2026-00009",
      paidAt: null,
      items: [
        { productName: "Amber Hour", quantity: 1, unitPriceFils: 48000, lineTotalFils: 48000 },
        { productName: "Seasonal candle", quantity: 2, unitPriceFils: 8500, lineTotalFils: 17000 },
      ],
      ...overrides,
    });

  it("keeps its number, leaves the counter alone, stamps the payment and sends the emails once", async () => {
    const h = harness(manualOrder());
    const stampPaid = vi.fn<StampPaid>(async () => true);
    const outcome = await applySucceededIntent(h.payload, intent(), { ...h.deps, stampPaid });

    expect(outcome).toBe("marked-paid");
    expect(h.claimInvoice).not.toHaveBeenCalled();
    expect(stampPaid).toHaveBeenCalledTimes(1);
    expect(stampPaid.mock.calls[0]![1]).toEqual({ orderId: 12, paidAtIso: NOW.toISOString() });

    const paid = h.updates.find((u) => u.collection === "orders")!;
    expect(paid.data).toMatchObject({ paymentStatus: "PAID", fulfilmentStatus: "CONFIRMED" });
    /* The stamp writes the payment time, once — never the whole-row update. */
    expect(paid.data).not.toHaveProperty("paidAt");

    expect(types()).toEqual(["florist-job-sheet", "owner-quote-paid", "payment-received"]);
    const thanks = sent.find((request) => request.type === "payment-received")!;
    expect(thanks.rendered.subject).toContain("CAL-INV-2026-00009");
    expect(thanks.rendered.html).toContain("Amber Hour");
    expect(thanks.rendered.html).toContain("Seasonal candle");
  });

  it("sends NOTHING when another delivery already stamped the payment", async () => {
    const h = harness(manualOrder());
    const outcome = await applySucceededIntent(h.payload, intent(), { ...h.deps, stampPaid: async () => false });
    expect(outcome).toBe("already-paid");
    expect(sent).toHaveLength(0);
  });

  it("does nothing at all for a replay once it is paid and stamped", async () => {
    const h = harness(manualOrder({ paymentStatus: "PAID", paidAt: NOW.toISOString() }));
    const stampPaid = vi.fn<StampPaid>(async () => true);
    const outcome = await applySucceededIntent(h.payload, intent(), { ...h.deps, stampPaid });
    expect(outcome).toBe("already-paid");
    expect(stampPaid).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("recovers a crash between PAID and the stamp: the retry stamps and sends", async () => {
    const h = harness(manualOrder({ paymentStatus: "PAID", paidAt: null }));
    const stampPaid = vi.fn<StampPaid>(async () => true);
    const outcome = await applySucceededIntent(h.payload, intent(), { ...h.deps, stampPaid });
    expect(outcome).toBe("marked-paid");
    expect(stampPaid).toHaveBeenCalledTimes(1);
    expect(h.claimInvoice).not.toHaveBeenCalled();
    expect(types()).toContain("payment-received");
  });

  it("sends the customer nothing when they gave no email, and still tells the shop", async () => {
    const h = harness(manualOrder({ customerEmail: "" }));
    await applySucceededIntent(h.payload, intent(), { ...h.deps, stampPaid: async () => true });
    expect(types()).toEqual(["florist-job-sheet", "owner-quote-paid"]);
  });
});
