import { describe, expect, it } from "vitest";
import { BUSINESS, type BusinessDetails } from "@/lib/business";
import {
  buildInvoice,
  formatInvoiceNumber,
  invoiceYear,
  vatIncludedFils,
  type InvoiceOrder,
} from "./invoice";

const ORDER: InvoiceOrder = {
  invoiceNumber: "CAL-INV-2026-00001",
  paidAt: "2026-10-04T10:00:00.000Z",
  orderNumber: "CAL-000123",
  customerName: "Layla Ahmed",
  customerEmail: "layla@example.com",
  items: [{ productName: "Bespoke arrangement", quantity: 1, unitPriceFils: 65000, lineTotalFils: 65000 }],
  subtotalFils: 65000,
  deliveryFeeFils: 0,
  discountFils: 0,
  totalFils: 65000,
  vatRateBps: 0,
  vatIncludedFils: 0,
};

const VAT_BUSINESS: BusinessDetails = {
  ...BUSINESS,
  legalName: { en: "Calanthe Flowers LLC", ar: "كالانثي للزهور ذ.م.م" },
  addressLines: { en: ["Office 1, Al Reem Island"], ar: ["مكتب 1، جزيرة الريم"] },
  tradeLicence: "CN-1234567",
  trn: "100123456700003",
  vatRegistered: true,
  vatRateBps: 500,
};

describe("formatInvoiceNumber", () => {
  it("pads to five digits and widens past them", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("CAL-INV-2026-00001");
    expect(formatInvoiceNumber(2026, 99999)).toBe("CAL-INV-2026-99999");
    expect(formatInvoiceNumber(2026, 100000)).toBe("CAL-INV-2026-100000");
  });

  it("refuses a sequence below one", () => {
    expect(() => formatInvoiceNumber(2026, 0)).toThrow();
    expect(() => formatInvoiceNumber(2026, 1.5)).toThrow();
  });
});

describe("invoiceYear", () => {
  it("is the year in Dubai, not in UTC", () => {
    /* 21:00 UTC on 31 December is 01:00 on 1 January in Dubai. */
    expect(invoiceYear(new Date("2026-12-31T21:00:00Z"))).toBe(2027);
    expect(invoiceYear(new Date("2026-12-31T19:59:00Z"))).toBe(2026);
  });
});

describe("vatIncludedFils", () => {
  it("extracts the VAT inside a VAT-inclusive total", () => {
    expect(vatIncludedFils(10500, 500)).toBe(500);
    expect(vatIncludedFils(65000, 500)).toBe(3095);
  });

  it("is zero when the rate is zero — VAT is off", () => {
    expect(vatIncludedFils(65000, 0)).toBe(0);
    expect(vatIncludedFils(0, 500)).toBe(0);
  });

  it("is always whole fils", () => {
    for (const total of [1, 199, 200, 333, 9999, 65050, 123457]) {
      expect(Number.isInteger(vatIncludedFils(total, 500))).toBe(true);
    }
  });

  it("refuses an amount that is not whole, non-negative fils", () => {
    expect(() => vatIncludedFils(650.5, 500)).toThrow();
    expect(() => vatIncludedFils(-1, 500)).toThrow();
  });
});

describe("buildInvoice", () => {
  it("refuses an order that has not been invoiced", () => {
    expect(() => buildInvoice({ ...ORDER, invoiceNumber: null }, BUSINESS)).toThrow(/no invoice number/);
    expect(() => buildInvoice({ ...ORDER, paidAt: null }, BUSINESS)).toThrow(/no payment date/);
  });

  it("reconciles: lines + delivery − discount = total", () => {
    const invoice = buildInvoice(ORDER, BUSINESS);
    const lines = invoice.lines.reduce((sum, line) => sum + line.totalFils, 0);
    expect(lines + invoice.deliveryFeeFils - invoice.discountFils).toBe(invoice.totalFils);
    expect(invoice.number).toBe("CAL-INV-2026-00001");
    expect(invoice.issuedAt).toBe(ORDER.paidAt);
    expect(invoice.billTo).toEqual({ name: "Layla Ahmed", email: "layla@example.com" });
  });

  it("refuses to render an invoice that does not add up", () => {
    expect(() => buildInvoice({ ...ORDER, totalFils: 64900 }, BUSINESS)).toThrow(/does not reconcile/);
    expect(() => buildInvoice({ ...ORDER, subtotalFils: 64900 }, BUSINESS)).toThrow(/does not reconcile/);
  });

  it("prints the discount row, with its code, for a discounted shop order", () => {
    const invoice = buildInvoice(
      {
        ...ORDER,
        items: [
          {
            productName: "Amber Hour",
            quantity: 2,
            unitPriceFils: 48000,
            lineTotalFils: 96000,
            compareAtUnitPriceFils: 60000,
            selectedOptions: [{ label: "Size", value: "Deluxe" }],
          },
        ],
        subtotalFils: 96000,
        deliveryFeeFils: 2500,
        discountFils: 9600,
        couponCode: "EID10",
        totalFils: 88900,
      },
      BUSINESS,
    );
    expect(invoice.discount).toEqual({ code: "EID10", fils: 9600 });
    expect(invoice.lines[0]).toMatchObject({ detail: "Deluxe", wasUnitFils: 60000, totalFils: 96000 });
    expect(96000 + invoice.deliveryFeeFils - invoice.discountFils).toBe(invoice.totalFils);
  });

  it("has no discount row when nothing was discounted", () => {
    expect(buildInvoice(ORDER, BUSINESS).discount).toBeNull();
  });

  it("is a plain invoice while VAT is off: no VAT line, no TRN", () => {
    const invoice = buildInvoice(ORDER, BUSINESS);
    expect(invoice.vat).toBeNull();
    expect(invoice.seller).not.toHaveProperty("trn");
  });

  it("leaves out every seller detail the owner has not supplied", () => {
    const seller = buildInvoice(ORDER, BUSINESS).seller;
    expect(seller.tradingName).toBe("Calanthe");
    expect(seller.city.en).toBe("Abu Dhabi");
    expect(seller.country.en).toBe("United Arab Emirates");
    for (const key of ["legalName", "addressLines", "tradeLicence", "trn"]) {
      expect(seller, key).not.toHaveProperty(key);
    }
    expect(JSON.stringify(seller)).not.toMatch(/null|undefined|TO PROVIDE/);
  });

  it("becomes a tax invoice from the rate SNAPSHOTTED on the order", () => {
    const invoice = buildInvoice({ ...ORDER, vatRateBps: 500, vatIncludedFils: 3095 }, VAT_BUSINESS);
    expect(invoice.vat).toEqual({ rateBps: 500, includedFils: 3095 });
    expect(invoice.seller.trn).toBe("100123456700003");
    expect(invoice.seller.legalName?.en).toBe("Calanthe Flowers LLC");
    /* The total is unchanged: prices are VAT-inclusive. */
    expect(invoice.totalFils).toBe(65000);
  });

  it("keeps an old order VAT-free after VAT is switched on", () => {
    const invoice = buildInvoice(ORDER, VAT_BUSINESS);
    expect(invoice.vat).toBeNull();
    expect(invoice.seller).not.toHaveProperty("trn");
  });

  it("reads only the snapshot: renaming or repricing the product changes nothing", () => {
    const product = { id: 7, name: "Amber Hour", priceFils: 48000 };
    /* A saved order carries the relation alongside the snapshot. */
    const line = { product, productName: "Amber Hour", quantity: 1, unitPriceFils: 65000, lineTotalFils: 65000 };
    const order = { ...ORDER, items: [line] };
    const before = buildInvoice(order, BUSINESS);
    product.name = "Renamed";
    product.priceFils = 1;
    const after = buildInvoice(order, BUSINESS);
    expect(after).toEqual(before);
    expect(after.lines[0]?.description).toBe("Amber Hour");
    expect(after.lines[0]?.unitFils).toBe(65000);
  });
});

describe("buildInvoice — a discounted shop order", () => {
  /* Two Amber Hour on a 20% sale (480 → 384) with a vase (60): 444 each.
     Code EID10 takes AED 89 off the order; delivery AED 25. */
  const DISCOUNTED: InvoiceOrder = {
    ...ORDER,
    items: [
      {
        productName: "Amber Hour",
        quantity: 2,
        unitPriceFils: 44400,
        lineTotalFils: 88800,
        compareAtUnitPriceFils: 54000,
        selectedOptions: [
          { label: "Size", value: "Standard" },
          { label: "Add-on", value: "Vase" },
        ],
      },
      { productName: "Quiet Morning", quantity: 1, unitPriceFils: 30000, lineTotalFils: 30000 },
    ],
    subtotalFils: 118800,
    deliveryFeeFils: 2500,
    discountFils: 8900,
    couponCode: "EID10",
    totalFils: 112400,
  };

  it("prints the Discount row with its code, and reconciles lines + delivery − discount = total", () => {
    const invoice = buildInvoice(DISCOUNTED, BUSINESS);
    expect(invoice.discount).toEqual({ code: "EID10", fils: 8900 });
    const lines = invoice.lines.reduce((sum, line) => sum + line.totalFils, 0);
    expect(lines + invoice.deliveryFeeFils - invoice.discountFils).toBe(invoice.totalFils);
    expect(invoice.totalFils).toBe(112400);
  });

  it("carries the regular price on a line sold on a sale, and only on that line", () => {
    const [onSale, regular] = buildInvoice(DISCOUNTED, BUSINESS).lines;
    expect(onSale).toMatchObject({ unitFils: 44400, wasUnitFils: 54000, totalFils: 88800 });
    expect(regular).not.toHaveProperty("wasUnitFils");
  });

  it("refuses to render when the discount does not reconcile", () => {
    expect(() => buildInvoice({ ...DISCOUNTED, discountFils: 9000 }, BUSINESS)).toThrow(/does not reconcile/);
  });
});
