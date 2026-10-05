import { describe, expect, it } from "vitest";
import type { Field } from "payload";
import { Orders } from "@/collections/Orders";
import {
  PAYMENT_PROVIDER_CONTEXT,
  QUOTE_CANCEL_REVERT_CONTEXT,
  guardInvoiceNumber,
  guardPaymentStatus,
  guardUnpaidQuoteFulfilment,
  validateBespokeLines,
  validateOrderTotals,
} from "./orderIntegrity";

/**
 * The order collection's own rules — the ones that hold whoever is writing:
 * the admin, a REST call, /cms, or server code with overrideAccess.
 */

type Doc = Record<string, unknown>;

const quote = (overrides: Doc = {}): Doc => ({
  source: "admin-quote",
  enquiry: 45,
  items: [
    {
      productName: "Bespoke arrangement",
      productSlug: "bespoke-arrangement",
      quantity: 1,
      unitPriceFils: 65000,
      lineTotalFils: 65000,
    },
  ],
  subtotalFils: 65000,
  deliveryFeeFils: 0,
  discountFils: 0,
  totalFils: 65000,
  ...overrides,
});

const shopOrder = (overrides: Doc = {}): Doc => ({
  source: "web-checkout-card",
  items: [
    { product: 7, productName: "Amber Hour", productSlug: "amber-hour", quantity: 1, unitPriceFils: 48000, lineTotalFils: 48000 },
  ],
  subtotalFils: 48000,
  deliveryFeeFils: 2500,
  discountFils: 0,
  totalFils: 50500,
  ...overrides,
});

const create = (data: Doc) => () => validateBespokeLines({ data, operation: "create" } as never);

describe("validateBespokeLines — a payment request", () => {
  it("accepts the shape quoteOrderData builds", () => {
    expect(create(quote())).not.toThrow();
    expect(() => validateOrderTotals({ data: quote(), operation: "create" } as never)).not.toThrow();
  });

  it("must be linked to its enquiry", () => {
    expect(create(quote({ enquiry: undefined }))).toThrow(/linked to the enquiry/);
    expect(create(quote({ enquiry: null }))).toThrow(/linked to the enquiry/);
  });

  it("cannot carry a catalogue product", () => {
    const [line] = quote().items as Doc[];
    expect(create(quote({ items: [{ ...line, product: 7 }] }))).toThrow(/bespoke arrangement/);
    expect(create(quote({ items: [{ ...line, productSlug: "amber-hour" }] }))).toThrow(/bespoke arrangement/);
  });

  it("has exactly one line, of one unit", () => {
    const [line] = quote().items as Doc[];
    expect(create(quote({ items: [line, line] }))).toThrow(/exactly one line/);
    expect(create(quote({ items: [{ ...line, quantity: 2 }] }))).toThrow(/quantity of one/);
  });

  it("cannot be for less than the minimum charge", () => {
    expect(create(quote({ totalFils: 199 }))).toThrow(/at least AED 2/);
    expect(create(quote({ totalFils: 200 }))).not.toThrow();
  });

  it("can never carry a discount, a code or a delivery fee", () => {
    expect(create(quote({ discountFils: 100 }))).toThrow(/discount cannot be applied/);
    expect(create(quote({ couponDiscountFils: 100 }))).toThrow(/discount cannot be applied/);
    expect(create(quote({ couponCode: "EID10" }))).toThrow(/discount cannot be applied/);
    /* …nor any other trace a discount leaves. */
    const [line] = quote().items as Doc[];
    expect(create(quote({ couponDiscount: 3 }))).toThrow(/discount cannot be applied/);
    expect(create(quote({ discountSnapshot: { coupon: null, sales: [] } }))).toThrow(/discount cannot be applied/);
    expect(create(quote({ items: [{ ...line, sale: 3 }] }))).toThrow(/discount cannot be applied/);
    expect(create(quote({ items: [{ ...line, compareAtUnitPriceFils: 80000 }] }))).toThrow(/discount cannot be applied/);
    expect(create(quote({ items: [{ ...line, saleLabelEn: "Eid offer" }] }))).toThrow(/discount cannot be applied/);
    expect(create(quote({ deliveryFeeFils: 2500 }))).toThrow(/delivery fee/);
  });
});

describe("validateBespokeLines — every other order", () => {
  it("passes a normal shop order unchanged", () => {
    const data = shopOrder();
    expect(validateBespokeLines({ data, operation: "create" } as never)).toBe(data);
  });

  it("refuses a line with no product", () => {
    const [line] = shopOrder().items as Doc[];
    expect(create(shopOrder({ items: [{ ...line, product: undefined }] }))).toThrow(/must name its product/);
    expect(create(shopOrder({ items: [{ ...line, product: null }] }))).toThrow(/must name its product/);
  });

  it("refuses the bespoke slug", () => {
    const [line] = shopOrder().items as Doc[];
    expect(create(shopOrder({ items: [{ ...line, productSlug: "bespoke-arrangement" }] }))).toThrow(
      /reserved for payment requests/,
    );
  });

  it("refuses to be linked to an enquiry", () => {
    expect(create(shopOrder({ enquiry: 45 }))).toThrow(/Only a payment request/);
  });

  it("checks creation only: an update carries no items to check", () => {
    const data = { fulfilmentStatus: "PREPARING" };
    expect(validateBespokeLines({ data, operation: "update" } as never)).toBe(data);
  });
});

describe("validateOrderTotals — sales and codes", () => {
  const totals = (data: Doc) => () => validateOrderTotals({ data, operation: "create" } as never);

  /* AED 480 on a 20% sale (384), one unit, with code EID10 taking AED 39 off. */
  const discounted = (overrides: Doc = {}, item: Doc = {}): Doc =>
    shopOrder({
      items: [
        {
          product: 7,
          productName: "Amber Hour",
          productSlug: "amber-hour",
          quantity: 1,
          unitPriceFils: 38400,
          lineTotalFils: 38400,
          compareAtUnitPriceFils: 48000,
          saleLabelEn: "Eid offer",
          saleLabelAr: "عرض العيد",
          sale: 3,
          ...item,
        },
      ],
      subtotalFils: 38400,
      deliveryFeeFils: 0,
      discountFils: 3900,
      couponDiscountFils: 3900,
      couponCode: "EID10",
      couponDiscount: 4,
      totalFils: 34500,
      ...overrides,
    });

  it("accepts an order written by the checkout shape of before, with no discount fields at all", () => {
    expect(totals(shopOrder())).not.toThrow();
  });

  it("accepts a sale line and a code together", () => {
    expect(totals(discounted())).not.toThrow();
    expect(create(discounted())).not.toThrow();
  });

  it("requires the regular price to be HIGHER than the price paid", () => {
    expect(totals(discounted({}, { compareAtUnitPriceFils: 48000 }))).not.toThrow();
    expect(totals(discounted({}, { compareAtUnitPriceFils: 38400 }))).toThrow(/higher than the price paid/);
    expect(totals(discounted({}, { compareAtUnitPriceFils: 30000 }))).toThrow(/higher than the price paid/);
    expect(totals(discounted({}, { compareAtUnitPriceFils: 48000.5 }))).toThrow(/higher than the price paid/);
    /* Absent means "not on sale". */
    expect(totals(discounted({}, { compareAtUnitPriceFils: null }))).not.toThrow();
  });

  it("allows no order-level discount that is not the code's own", () => {
    /* total stays consistent with discountFils so only this rule can fire. */
    expect(totals(discounted({ couponDiscountFils: 2000 }))).toThrow(/must come from a code/);
    expect(totals(discounted({ couponDiscountFils: 5000 }))).toThrow(/must come from a code/);
    expect(totals(discounted({ couponDiscountFils: undefined, couponCode: undefined }))).toThrow(/must come from a code/);
    expect(totals(shopOrder({ discountFils: 500, totalFils: 50000 }))).toThrow(/must come from a code/);
  });

  it("requires a code discount to name its code", () => {
    expect(totals(discounted({ couponCode: "" }))).toThrow(/must name its code/);
    expect(totals(discounted({ couponCode: "   " }))).toThrow(/must name its code/);
    expect(totals(discounted({ couponCode: undefined }))).toThrow(/must name its code/);
  });

  it("refuses a code recorded with nothing taken off", () => {
    expect(totals(shopOrder({ couponCode: "EID10" }))).toThrow(/took nothing off/);
    expect(totals(shopOrder({ couponCode: "EID10", couponDiscountFils: 0 }))).toThrow(/took nothing off/);
    expect(totals(shopOrder({ couponDiscountFils: 0 }))).not.toThrow();
  });

  it("never lets a code reach into the delivery fee", () => {
    expect(
      totals(
        shopOrder({ discountFils: 49000, couponDiscountFils: 49000, couponCode: "BIG", totalFils: 1500 }),
      ),
    ).toThrow(/cannot exceed the subtotal/);
  });

  it("refuses a fractional or negative discount", () => {
    expect(totals(shopOrder({ discountFils: 10.5, couponDiscountFils: 10.5, couponCode: "X10", totalFils: 50489.5 }))).toThrow(/whole fils/);
    expect(totals(shopOrder({ discountFils: -100, couponDiscountFils: -100, couponCode: "X10", totalFils: 50600 }))).toThrow(/whole fils/);
  });

  it("does not re-validate an update", () => {
    const data = { couponDiscountFils: 999, discountFils: 0 };
    expect(validateOrderTotals({ data, operation: "update" } as never)).toBe(data);
  });
});

describe("guardInvoiceNumber", () => {
  const update = (data: Doc, originalDoc: Doc) => () =>
    guardInvoiceNumber({ data, operation: "update", originalDoc } as never);

  it("lets the number be set the first time", () => {
    expect(update({ invoiceNumber: "CAL-INV-2026-00001" }, { invoiceNumber: null })).not.toThrow();
  });

  it("refuses to change a number that has been issued", () => {
    expect(update({ invoiceNumber: "CAL-INV-2026-00002" }, { invoiceNumber: "CAL-INV-2026-00001" })).toThrow(
      /cannot be changed/,
    );
    expect(update({ invoiceNumber: null }, { invoiceNumber: "CAL-INV-2026-00001" })).toThrow(/cannot be changed/);
  });

  it("ignores updates that do not touch it, or repeat it", () => {
    expect(update({ fulfilmentStatus: "READY" }, { invoiceNumber: "CAL-INV-2026-00001" })).not.toThrow();
    expect(update({ invoiceNumber: "CAL-INV-2026-00001" }, { invoiceNumber: "CAL-INV-2026-00001" })).not.toThrow();
  });
});

describe("guardPaymentStatus (regression)", () => {
  const update = (context: Doc) => () =>
    guardPaymentStatus({
      context,
      data: { paymentStatus: "PAID" },
      operation: "update",
      originalDoc: { paymentStatus: "PENDING" },
    } as never);

  it("still refuses PENDING → PAID from anything but the payment provider", () => {
    expect(update({})).toThrow(/set by the payment provider/);
    expect(update({ [QUOTE_CANCEL_REVERT_CONTEXT]: true })).toThrow(/set by the payment provider/);
  });

  it("allows it under the provider context", () => {
    expect(update({ [PAYMENT_PROVIDER_CONTEXT]: true })).not.toThrow();
  });
});

describe("guardUnpaidQuoteFulfilment", () => {
  const unpaid = { source: "admin-quote", paymentStatus: "PENDING", fulfilmentStatus: "NEW" };
  const update = (data: Doc, originalDoc: Doc, context: Doc = {}) => () =>
    guardUnpaidQuoteFulfilment({ context, data, operation: "update", originalDoc } as never);

  it("refuses to advance a request nobody has paid for", () => {
    for (const fulfilmentStatus of ["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]) {
      expect(update({ fulfilmentStatus }, unpaid)).toThrow(/waiting for payment/);
    }
  });

  it("allows cancelling it", () => {
    expect(update({ fulfilmentStatus: "CANCELLED" }, unpaid)).not.toThrow();
  });

  it("refuses to un-cancel one — that would revive a dead pay link", () => {
    const cancelled = { ...unpaid, fulfilmentStatus: "CANCELLED" };
    expect(update({ fulfilmentStatus: "NEW" }, cancelled)).toThrow(/cannot be reopened/);
    expect(update({ fulfilmentStatus: "CONFIRMED" }, cancelled)).toThrow(/cannot be reopened/);
  });

  it("allows the one revert, when Stripe refused the cancellation", () => {
    const cancelled = { ...unpaid, fulfilmentStatus: "CANCELLED" };
    expect(update({ fulfilmentStatus: "NEW" }, cancelled, { [QUOTE_CANCEL_REVERT_CONTEXT]: true })).not.toThrow();
  });

  it("lets the webhook confirm it in the same write that marks it paid", () => {
    expect(update({ paymentStatus: "PAID", fulfilmentStatus: "CONFIRMED" }, unpaid)).not.toThrow();
  });

  it("leaves paid requests and ordinary orders alone", () => {
    expect(update({ fulfilmentStatus: "PREPARING" }, { ...unpaid, paymentStatus: "PAID" })).not.toThrow();
    expect(
      update({ fulfilmentStatus: "PREPARING" }, { source: "web-checkout-card", paymentStatus: "PENDING", fulfilmentStatus: "NEW" }),
    ).not.toThrow();
    expect(update({ internalNotes: "x" }, unpaid)).not.toThrow();
  });
});

/**
 * THE LEAK. `read` on orders lets a signed-in customer fetch their own order
 * through Payload's REST and GraphQL endpoints. These fields must not travel
 * with it: the florist's notes, who is making it, and the payment plumbing.
 */
describe("what a customer can read of their own order", () => {
  function flatten(fields: readonly Field[]): Field[] {
    return fields.flatMap((field) => {
      if ("name" in field) return [field];
      return "fields" in field ? flatten(field.fields) : [];
    });
  }

  const byName = new Map(
    flatten(Orders.fields).flatMap((field) => ("name" in field ? [[field.name, field] as const] : [])),
  );

  const canRead = (name: string, role: string | null): boolean => {
    const field = byName.get(name);
    if (!field) throw new Error(`orders has no field ${name}`);
    const read = (field as { access?: { read?: (args: never) => unknown } }).access?.read;
    if (!read) return true;
    return read({ req: { user: role ? { id: 1, role } : null } } as never) === true;
  };

  const STAFF_ONLY = [
    "internalNotes",
    "assignedStaff",
    "enquiry",
    "payLinkExpiresAt",
    "stripePaymentIntentId",
    /* The internal title of a discount, and the pointer into the owner list. */
    "discountSnapshot",
    "couponDiscount",
  ];
  const NOBODY = ["payTokenSalt", "payTokenHash"];

  it.each(STAFF_ONLY)("%s is hidden from a customer and from the public", (name) => {
    expect(canRead(name, "customer")).toBe(false);
    expect(canRead(name, null)).toBe(false);
    expect(canRead(name, "staff")).toBe(true);
    expect(canRead(name, "admin")).toBe(true);
  });

  it.each(NOBODY)("%s cannot be read through the API by anyone, owner included", (name) => {
    for (const role of ["customer", "staff", "admin", null]) expect(canRead(name, role)).toBe(false);
  });

  it("still lets a customer read what is theirs", () => {
    for (const name of ["orderNumber", "totalFils", "deliveryDate", "paymentStatus", "invoiceNumber", "couponCode", "couponDiscountFils"]) {
      expect(canRead(name, "customer")).toBe(true);
    }
  });

  it("hides the sale link on a line, and shows the label and the regular price", () => {
    const items = byName.get("items") as { fields: Field[] };
    const line = new Map(items.fields.flatMap((f) => ("name" in f ? [[f.name, f] as const] : [])));
    const read = (name: string, role: string | null) => {
      const access = (line.get(name) as { access?: { read?: (args: never) => unknown } }).access?.read;
      return access ? access({ req: { user: role ? { id: 1, role } : null } } as never) === true : true;
    };
    expect(read("sale", "customer")).toBe(false);
    expect(read("sale", null)).toBe(false);
    expect(read("sale", "staff")).toBe(true);
    for (const name of ["compareAtUnitPriceFils", "saleLabelEn", "saleLabelAr"]) {
      expect(read(name, "customer")).toBe(true);
    }
  });

  it("lets no role author when a code was counted", () => {
    const access = (byName.get("couponRedeemedAt") as { access?: Record<string, (args: never) => unknown> }).access;
    for (const role of ["customer", "staff", "admin"]) {
      const args = { req: { user: { id: 1, role } } } as never;
      expect(access?.create?.(args)).toBe(false);
      expect(access?.update?.(args)).toBe(false);
    }
  });

  it("lets no role author the money and invoice fields", () => {
    for (const name of ["payTokenSalt", "payTokenHash", "stripePaymentIntentId", "paidAt", "invoiceNumber", "vatRateBps", "vatIncludedFils"]) {
      const access = (byName.get(name) as { access?: Record<string, (args: never) => unknown> }).access;
      for (const role of ["customer", "staff", "admin"]) {
        const args = { req: { user: { id: 1, role } } } as never;
        expect(access?.create?.(args), `${name} create as ${role}`).toBe(false);
        expect(access?.update?.(args), `${name} update as ${role}`).toBe(false);
      }
    }
  });
});
