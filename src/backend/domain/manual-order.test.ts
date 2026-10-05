import { describe, expect, it } from "vitest";
import { FormInputError } from "./form-error";
import { buildInvoice, buildInvoiceSheet, fitsOnePage } from "./invoice";
import {
  describeLines,
  manualOrderData,
  normalisePhone,
  parseManualOrderForm,
  type ManualProduct,
} from "./manual-order";
import {
  MANUAL_PAYMENT_CONTEXT,
  PAYMENT_PROVIDER_CONTEXT,
  guardPaymentStatus,
  guardUnpaidQuoteFulfilment,
  validateBespokeLines,
  validateOrderTotals,
} from "@backend/payload/hooks/orderIntegrity";
import { CUSTOM_SLUG, MANUAL_SOURCE } from "@backend/payments/pay-link";
import { BUSINESS } from "@/lib/business";

const CTX = { todayDubai: "2026-10-05", slots: ["10:00 – 13:00", "13:00 – 17:00"] };

function form(over: Record<string, string> = {}, lines: unknown[] | null = null) {
  const data = new FormData();
  const base: Record<string, string> = {
    customerName: "Mariam Al Mansoori",
    customerPhone: "050 123 4567",
    customerEmail: "",
    salesChannel: "whatsapp",
    deliveryDate: "2026-10-06",
    deliveryTimeSlot: "10:00 – 13:00",
    deliveryAddress: "Villa 12, Al Bateen, Abu Dhabi",
    locale: "en",
    payment: "unpaid",
    lines: JSON.stringify(
      lines ?? [
        { productId: 7, description: "", detail: "Signature size", unitAed: "480", quantity: 1 },
        { description: "Seasonal candle", unitAed: "85.50", quantity: 2 },
      ],
    ),
    ...over,
  };
  for (const [key, value] of Object.entries(base)) data.set(key, value);
  return data;
}

const PRODUCTS = new Map<number, ManualProduct>([[7, { id: 7, name: "Amber Hour", slug: "amber-hour" }]]);
const EXTRA = { salt: "s", tokenHash: "h", expiresAt: new Date("2026-10-12T08:00:00Z") };

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof FormInputError ? error.code : `not a form error: ${String(error)}`;
  }
  return "did not throw";
};

describe("normalisePhone", () => {
  it("accepts a UAE mobile the way people type it", () => {
    expect(normalisePhone("050 123 4567")).toBe("+971501234567");
    expect(normalisePhone("501234567")).toBe("+971501234567");
    expect(normalisePhone("00971 50 123 4567")).toBe("+971501234567");
    expect(normalisePhone("971501234567")).toBe("+971501234567");
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
  });
});

describe("parseManualOrderForm", () => {
  it("reads a WhatsApp order with no email, and adds it up in fils", () => {
    const parsed = parseManualOrderForm(form(), CTX);
    expect(parsed.customerPhone).toBe("+971501234567");
    expect(parsed.customerEmail).toBe("");
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.totalFils).toBe(48000 + 2 * 8550);
    expect(parsed.payment).toBe("unpaid");
    expect(parsed.sendEmail).toBe(false);
  });

  it("only offers to email when there is an address and the order is unpaid", () => {
    expect(parseManualOrderForm(form({ sendEmail: "on" }), CTX).sendEmail).toBe(false);
    expect(parseManualOrderForm(form({ sendEmail: "on", customerEmail: "M@Example.com" }), CTX)).toMatchObject({
      sendEmail: true,
      customerEmail: "m@example.com",
    });
    expect(
      parseManualOrderForm(form({ sendEmail: "on", customerEmail: "m@example.com", payment: "cash" }), CTX)
        .sendEmail,
    ).toBe(false);
  });

  it("keeps the payment note only for a payment taken outside the website", () => {
    expect(parseManualOrderForm(form({ paymentReference: "TRF-1" }), CTX).paymentReference).toBeUndefined();
    expect(
      parseManualOrderForm(form({ payment: "bank-transfer", paymentReference: "TRF-1" }), CTX).paymentReference,
    ).toBe("TRF-1");
  });

  it("uses the pickup wording instead of an address when the customer collects", () => {
    expect(parseManualOrderForm(form({ pickup: "on", deliveryAddress: "" }), CTX).deliveryAddress).toBe(
      "Collected from Calanthe",
    );
    expect(
      parseManualOrderForm(form({ pickup: "on", deliveryAddress: "", locale: "ar" }), CTX).deliveryAddress,
    ).toBe("استلام من كالانث");
  });

  it("allows a sale written up afterwards, but not from another year", () => {
    expect(parseManualOrderForm(form({ deliveryDate: "2026-09-20" }), CTX).deliveryDate).toContain("2026-09-20");
    expect(codeOf(() => parseManualOrderForm(form({ deliveryDate: "2025-01-01" }), CTX))).toBe(
      "deliveryDateTooOld",
    );
    expect(codeOf(() => parseManualOrderForm(form({ deliveryDate: "2026-02-31" }), CTX))).toBe(
      "deliveryDateRequired",
    );
  });

  it("refuses what cannot be an order", () => {
    expect(codeOf(() => parseManualOrderForm(form({ customerName: " " }), CTX))).toBe("customerNameRequired");
    expect(codeOf(() => parseManualOrderForm(form({ customerPhone: "12" }), CTX))).toBe("phoneFormat");
    expect(codeOf(() => parseManualOrderForm(form({ customerEmail: "not-an-email" }), CTX))).toBe("emailFormat");
    expect(codeOf(() => parseManualOrderForm(form({}, []), CTX))).toBe("linesRequired");
    expect(codeOf(() => parseManualOrderForm(form({ lines: "not json" }), CTX))).toBe("linesRequired");
    expect(codeOf(() => parseManualOrderForm(form({}, [{ description: "", unitAed: "10", quantity: 1 }]), CTX))).toBe(
      "lineDescription",
    );
    expect(codeOf(() => parseManualOrderForm(form({}, [{ description: "x", unitAed: "", quantity: 1 }]), CTX))).toBe(
      "linePrice",
    );
    expect(codeOf(() => parseManualOrderForm(form({}, [{ description: "x", unitAed: "0", quantity: 1 }]), CTX))).toBe(
      "linePrice",
    );
    expect(codeOf(() => parseManualOrderForm(form({}, [{ description: "x", unitAed: "10", quantity: 0 }]), CTX))).toBe(
      "lineQuantity",
    );
    expect(
      codeOf(() => parseManualOrderForm(form({}, [{ description: "x", unitAed: "10", quantity: 1.5 }]), CTX)),
    ).toBe("lineQuantity");
    expect(codeOf(() => parseManualOrderForm(form({}, [{ description: "x", unitAed: "1", quantity: 1 }]), CTX))).toBe(
      "amountTooLow",
    );
    expect(codeOf(() => parseManualOrderForm(form({ deliveryAddress: "" }), CTX))).toBe("addressRequired");
    expect(codeOf(() => parseManualOrderForm(form({ deliveryTimeSlot: "noon" }), CTX))).toBe("slotRequired");
    expect(codeOf(() => parseManualOrderForm(form({ salesChannel: "fax" }), CTX))).toBe("channelRequired");
    expect(codeOf(() => parseManualOrderForm(form({ payment: "cheque" }), CTX))).toBe("paymentMethod");
    const many = Array.from({ length: 41 }, () => ({ description: "x", unitAed: "10", quantity: 1 }));
    expect(codeOf(() => parseManualOrderForm(form({}, many), CTX))).toBe("tooManyLines");
  });
});

describe("manualOrderData", () => {
  const parsed = parseManualOrderForm(form(), CTX);
  const data = manualOrderData(parsed, PRODUCTS, EXTRA);

  it("snapshots a catalogue line from the product and a typed line from the form", () => {
    expect(data.items[0]).toMatchObject({
      product: 7,
      productName: "Amber Hour",
      productSlug: "amber-hour",
      unitPriceFils: 48000,
      lineTotalFils: 48000,
      selectedOptions: [{ label: "Details", value: "Signature size" }],
    });
    expect(data.items[1]).toMatchObject({
      productName: "Seasonal candle",
      productSlug: CUSTOM_SLUG,
      quantity: 2,
      unitPriceFils: 8550,
      lineTotalFils: 17100,
    });
    expect(data.items[1]).not.toHaveProperty("product");
  });

  it("is created unpaid, by hand, with totals that are the lines and nothing else", () => {
    expect(data).toMatchObject({
      source: MANUAL_SOURCE,
      salesChannel: "whatsapp",
      paymentStatus: "PENDING",
      fulfilmentStatus: "NEW",
      customerType: "guest",
      customerEmail: "",
      subtotalFils: 65100,
      deliveryFeeFils: 0,
      discountFils: 0,
      totalFils: 65100,
    });
  });

  it("passes the collection's own integrity hooks", () => {
    const args = { data, operation: "create" } as never;
    expect(() => validateOrderTotals(args)).not.toThrow();
    expect(() => validateBespokeLines(args)).not.toThrow();
  });

  it("refuses a product that has left the catalogue", () => {
    expect(codeOf(() => manualOrderData(parsed, new Map(), EXTRA))).toBe("productMissing");
  });
});

describe("validateBespokeLines — orders written by hand", () => {
  const good = manualOrderData(parseManualOrderForm(form(), CTX), PRODUCTS, EXTRA);
  const run = (over: Record<string, unknown>) => () =>
    validateBespokeLines({ data: { ...good, ...over }, operation: "create" } as never);

  it("refuses a discount, a code, a delivery fee or a paid start", () => {
    expect(run({ deliveryFeeFils: 100, totalFils: 65200 })).toThrow(/delivery fee/);
    expect(run({ discountFils: 100, couponDiscountFils: 100, couponCode: "X" })).toThrow(/discount code/);
    expect(run({ paymentStatus: "PAID" })).toThrow(/starts unpaid/);
  });

  it("refuses a line that is neither a product nor a typed item, and the bespoke slug", () => {
    expect(run({ items: [{ ...good.items[1], product: 7 }] })).toThrow(/either a catalogue product or a typed item/);
    expect(run({ items: [{ ...good.items[0], product: undefined }] })).toThrow(/either a catalogue product/);
  });

  it("keeps a typed item out of every other kind of order", () => {
    expect(() =>
      validateBespokeLines({
        data: { ...good, source: "web-checkout-card", items: [{ ...good.items[1], product: 7 }] },
        operation: "create",
      } as never),
    ).toThrow(/reserved for orders written in the admin/);
  });
});

describe("the invoice of an order written by hand", () => {
  const data = manualOrderData(parseManualOrderForm(form(), CTX), PRODUCTS, EXTRA);
  const order = {
    ...data,
    orderNumber: "CAL-000031",
    createdAt: "2026-10-05T08:00:00.000Z",
    customerPhone: "+971501234567",
  };

  it("is an unpaid bill with no invoice number until it is paid", () => {
    const sheet = buildInvoiceSheet(order, BUSINESS);
    expect(sheet).toMatchObject({ status: "unpaid", number: null, paidAt: null, totalFils: 65100, fit: true });
    expect(sheet.billTo).toEqual({ name: "Mariam Al Mansoori", email: "", phone: "+971501234567" });
  });

  it("is void when it was cancelled unpaid", () => {
    expect(buildInvoiceSheet({ ...order, fulfilmentStatus: "CANCELLED" }, BUSINESS).status).toBe("void");
  });

  it("says how it was paid once the owner records the payment", () => {
    const paid = {
      ...order,
      paymentStatus: "PAID",
      paymentMethod: "bank-transfer",
      invoiceNumber: "CAL-INV-2026-00007",
      paidAt: "2026-10-05T09:00:00.000Z",
    };
    const sheet = buildInvoiceSheet(paid, BUSINESS);
    expect(sheet).toMatchObject({ status: "paid", number: "CAL-INV-2026-00007", paymentMethod: "bank-transfer" });
    expect(buildInvoice(paid, BUSINESS).paymentMethod).toBe("bank-transfer");
    expect(buildInvoice({ ...paid, paymentMethod: null }, BUSINESS).paymentMethod).toBe("card");
  });

  it("is never rendered when its figures do not add up", () => {
    expect(() => buildInvoiceSheet({ ...order, totalFils: 65000 }, BUSINESS)).toThrow(/does not reconcile/);
    const bent = { ...order, items: [{ ...order.items[0]!, lineTotalFils: 47000 }, order.items[1]!] };
    expect(() => buildInvoiceSheet(bent, BUSINESS)).toThrow(/does not reconcile/);
  });
});

describe("fitsOnePage and describeLines", () => {
  const line = { description: "Amber Hour", quantity: 1, unitFils: 1, totalFils: 1 };
  it("pins the foot only for a short invoice", () => {
    expect(fitsOnePage(Array.from({ length: 5 }, () => line))).toBe(true);
    expect(fitsOnePage(Array.from({ length: 6 }, () => line))).toBe(false);
    expect(fitsOnePage([{ ...line, detail: "x".repeat(500) }])).toBe(false);
  });
  it("writes several lines as one sentence", () => {
    expect(describeLines([{ productName: "Amber Hour", quantity: 2 }, { productName: "Candle", quantity: 1 }])).toBe(
      "Amber Hour × 2, Candle",
    );
    expect(describeLines(null)).toBe("");
  });
});

describe("guardPaymentStatus — a payment recorded by hand", () => {
  const manual = { source: MANUAL_SOURCE, paymentStatus: "PENDING" };
  const call =
    (context: Record<string, unknown>, originalDoc: Record<string, unknown>, data: Record<string, unknown>) =>
    () =>
      guardPaymentStatus({ context, data, operation: "update", originalDoc } as never);
  const byHand = { [MANUAL_PAYMENT_CONTEXT]: true };

  it("marks an order written by hand paid, with its method", () => {
    expect(call(byHand, manual, { paymentStatus: "PAID", paymentMethod: "cash" })).not.toThrow();
  });

  it("refuses without the owner's action behind it", () => {
    expect(call({}, manual, { paymentStatus: "PAID", paymentMethod: "cash" })).toThrow(/never by hand/);
  });

  it("refuses a website order or a payment request, whatever the context says", () => {
    for (const source of ["web-checkout-card", "admin-quote", null]) {
      expect(
        call(byHand, { source, paymentStatus: "PENDING" }, { paymentStatus: "PAID", paymentMethod: "cash" }),
      ).toThrow(/never by hand/);
    }
  });

  it("refuses a missing or unknown method, any status but PAID, and an order money already reached", () => {
    expect(call(byHand, manual, { paymentStatus: "PAID" })).toThrow(/never by hand/);
    expect(call(byHand, manual, { paymentStatus: "PAID", paymentMethod: "card" })).toThrow(/never by hand/);
    expect(call(byHand, manual, { paymentStatus: "REFUNDED", paymentMethod: "cash" })).toThrow(/never by hand/);
    expect(
      call(byHand, { ...manual, paymentStatus: "REFUNDED" }, { paymentStatus: "PAID", paymentMethod: "cash" }),
    ).toThrow(/never by hand/);
  });

  it("still lets Stripe's webhook pay it by card", () => {
    expect(call({ [PAYMENT_PROVIDER_CONTEXT]: true }, manual, { paymentStatus: "PAID" })).not.toThrow();
  });
});

describe("guardUnpaidQuoteFulfilment — orders written by hand", () => {
  const move = (originalDoc: Record<string, unknown>, data: Record<string, unknown>) => () =>
    guardUnpaidQuoteFulfilment({ context: {}, data, operation: "update", originalDoc } as never);
  const unpaid = { source: MANUAL_SOURCE, paymentStatus: "PENDING", fulfilmentStatus: "NEW" };

  it("cannot be prepared before it is paid, but can be cancelled", () => {
    expect(move(unpaid, { fulfilmentStatus: "PREPARING" })).toThrow(/waiting for payment/);
    expect(move(unpaid, { fulfilmentStatus: "CANCELLED" })).not.toThrow();
  });

  it("moves freely once paid, including in the write that pays it", () => {
    expect(move({ ...unpaid, paymentStatus: "PAID" }, { fulfilmentStatus: "PREPARING" })).not.toThrow();
    expect(move(unpaid, { paymentStatus: "PAID", fulfilmentStatus: "CONFIRMED" })).not.toThrow();
  });
});
