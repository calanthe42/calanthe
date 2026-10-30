import { describe, expect, it } from "vitest";
import { OUTSIDE_PAYMENT_METHODS } from "@backend/payments/pay-link";
import {
  FEE_FREE_PAYMENT_METHODS,
  comparisonWindow,
  invoiceDay,
  invoiceSpend,
  isMonthKey,
  isPaidSaleIn,
  monthOf,
  monthWindow,
  moneyTotals,
  shiftMonth,
  type MoneyInvoiceLike,
  type MoneyOrderLike,
} from "./money";

const october = monthWindow("2026-10");

const order = (over: Partial<MoneyOrderLike> = {}): MoneyOrderLike => ({
  totalFils: 48000,
  paymentStatus: "PAID",
  fulfilmentStatus: "DELIVERED",
  paymentMethod: null,
  paidAt: "2026-10-12T08:00:00.000Z",
  createdAt: "2026-10-12T07:55:00.000Z",
  ...over,
});

describe("months, in the UAE", () => {
  it("reads and moves month keys", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("26-10")).toBe(false);
    expect(shiftMonth("2026-10", -1)).toBe("2026-09");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("puts 01:00 in Dubai on the 1st in the new month, though it is still the 31st in UTC", () => {
    expect(monthOf(new Date("2026-10-31T21:00:00.000Z"))).toBe("2026-11");
    expect(monthOf(new Date("2026-10-31T19:59:59.000Z"))).toBe("2026-10");
  });

  it("runs a month from UAE midnight to UAE midnight", () => {
    expect(october.start.toISOString()).toBe("2026-09-30T20:00:00.000Z");
    expect(october.end.toISOString()).toBe("2026-10-31T20:00:00.000Z");
  });

  it("compares the month she is in with the same stretch of the month before", () => {
    const now = new Date("2026-10-15T08:00:00.000Z"); // 15 Oct, 12:00 in Dubai
    const window = comparisonWindow("2026-10", now);
    expect(window.month).toBe("2026-09");
    expect(window.soFar).toBe(true);
    expect(window.start.toISOString()).toBe("2026-08-31T20:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-15T08:00:00.000Z");
  });

  it("never runs past the end of a shorter month before", () => {
    const window = comparisonWindow("2026-10", new Date("2026-10-31T15:00:00.000Z"));
    expect(window.end.toISOString()).toBe(monthWindow("2026-09").end.toISOString());
  });

  it("compares a month that is over with the whole month before", () => {
    const window = comparisonWindow("2026-09", new Date("2026-10-15T08:00:00.000Z"));
    expect(window).toMatchObject({ month: "2026-08", soFar: false });
    expect(window.end.toISOString()).toBe(monthWindow("2026-08").end.toISOString());
  });
});

describe("which orders count", () => {
  it("counts paid money in the month it was paid", () => {
    expect(isPaidSaleIn(order(), october)).toBe(true);
    expect(isPaidSaleIn(order({ paidAt: "2026-09-30T21:00:00.000Z" }), october)).toBe(true);
    expect(isPaidSaleIn(order({ paidAt: "2026-09-30T19:00:00.000Z" }), october)).toBe(false);
  });

  it("falls back to when the order was made when no payment time was recorded", () => {
    expect(isPaidSaleIn(order({ paidAt: null, createdAt: "2026-10-03T10:00:00.000Z" }), october)).toBe(true);
  });

  it("leaves out unpaid, failed, refunded and cancelled orders", () => {
    for (const paymentStatus of ["PENDING", "AUTHORIZED", "FAILED", "REFUNDED"]) {
      expect(isPaidSaleIn(order({ paymentStatus }), october), paymentStatus).toBe(false);
    }
    expect(isPaidSaleIn(order({ fulfilmentStatus: "CANCELLED" }), october)).toBe(false);
  });

  it("knows every payment method the shop records", () => {
    for (const method of FEE_FREE_PAYMENT_METHODS) {
      expect((OUTSIDE_PAYMENT_METHODS as readonly string[]).includes(method)).toBe(true);
    }
  });
});

describe("what an invoice spent", () => {
  const invoice: MoneyInvoiceLike = {
    invoiceDate: "2026-10-26",
    deliveryFils: 2000,
    vatFils: 4100,
    lines: [
      { group: "flowers", lineTotalFils: 30000 },
      { group: "greenery", lineTotalFils: 10000 },
      { group: "packaging", lineTotalFils: 20000 },
      { group: "extra", lineTotalFils: 20000 },
    ],
  };

  it("shares delivery and VAT over every line by value, as the price for one does", () => {
    const spend = invoiceSpend(invoice, false);
    /* Extras AED 61 over AED 800 of lines: flowers + greenery take half, packaging a quarter. */
    expect(spend.flowersFils).toBeCloseTo(40000 + 3050, 6);
    expect(spend.packagingFils).toBeCloseTo(20000 + 1525, 6);
  });

  it("leaves VAT out once the shop is VAT-registered", () => {
    const spend = invoiceSpend(invoice, true);
    expect(spend.flowersFils).toBeCloseTo(40000 + 1000, 6);
    expect(spend.packagingFils).toBeCloseTo(20000 + 500, 6);
  });

  it("counts a line whose item has left the list with the flowers, never as nothing", () => {
    const spend = invoiceSpend({ invoiceDate: "2026-10-01", lines: [{ group: null, lineTotalFils: 5000 }] }, false);
    expect(spend.flowersFils).toBe(5000);
  });

  it("reads the day printed on it, whichever way it was stored", () => {
    expect(invoiceDay("2026-10-26")).toBe("2026-10-26");
    expect(invoiceDay("2026-10-26T00:00:00.000Z")).toBe("2026-10-26");
    expect(invoiceDay("2026-10-25T20:00:00.000Z")).toBe("2026-10-26");
  });
});

describe("the month", () => {
  const invoices: MoneyInvoiceLike[] = [
    {
      invoiceDate: "2026-10-26T00:00:00.000Z",
      deliveryFils: 2000,
      vatFils: 4100,
      lines: [
        { group: "flowers", lineTotalFils: 30000 },
        { group: "packaging", lineTotalFils: 50000 },
      ],
    },
    /* September's invoice is not October's spending. */
    { invoiceDate: "2026-09-29", lines: [{ group: "flowers", lineTotalFils: 99900 }] },
  ];

  it("works out what she kept, card fees included and cash fee-free", () => {
    const totals = moneyTotals(
      [order(), order({ totalFils: 66600, paymentMethod: "cash" }), order({ paymentStatus: "PARTIALLY_REFUNDED" })],
      invoices,
      october,
      false,
    );
    expect(totals.paidFils).toBe(48000 + 66600 + 48000);
    expect(totals.orders).toBe(3);
    expect(totals.partlyRefunded).toBe(1);
    expect(totals.invoiceCount).toBe(1);
    /* AED 61 of extras over AED 800: 22.875 to the flowers, 38.125 to the packaging. */
    expect(totals.flowersFils).toBe(32288);
    expect(totals.packagingFils).toBe(53813);
    /* Two card payments of AED 480: 2.9% + AED 1 each = AED 14.92. */
    expect(totals.cardFeesFils).toBe(2 * 1492);
    expect(totals.keptFils).toBe(totals.paidFils - 32288 - 53813 - 2984);
  });

  it("says nothing about what she kept until there is an invoice", () => {
    const totals = moneyTotals([order()], [], october, false);
    expect(totals.paidFils).toBe(48000);
    expect(totals.keptFils).toBeNull();
  });

  it("can show spending above what customers paid, as a negative", () => {
    const totals = moneyTotals([], invoices, october, false);
    expect(totals.keptFils).toBe(-(32288 + 53813));
  });
});
