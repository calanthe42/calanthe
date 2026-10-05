import { describe, expect, it } from "vitest";
import { ar } from "@admin/i18n/ar";
import { en } from "@admin/i18n/en";
import { createTranslator } from "@admin/i18n/translate";
import type { Discount } from "@/payload-types";
import {
  blankDiscountValues,
  datesText,
  discountFormValues,
  duplicateDiscountValues,
  instantFromInputs,
  scopeText,
  statusLine,
  summaryLine,
  termsOf,
  valueText,
} from "./discount-view";

/**
 * A discount in the words the owner reads — the list row, the editor's
 * summary and the confirmation all take their sentences from here.
 */

const english = createTranslator("en", en);
const arabic = createTranslator("ar", ar);

const doc = (over: Partial<Discount> = {}): Discount => ({
  id: 4,
  title: "Eid 2026",
  kind: "automatic",
  valueType: "percentage",
  percentOff: 20,
  amountOffFils: null,
  appliesTo: "products",
  products: [11, 12, 13],
  occasions: [],
  categories: [],
  labelEn: "Eid offer",
  labelAr: "عرض العيد",
  /* 18:00 and 23:59 in Abu Dhabi. */
  startsAt: "2026-10-01T14:00:00.000Z",
  endsAt: "2026-10-10T19:59:00.000Z",
  active: true,
  timesUsed: 0,
  updatedAt: "2026-09-30T08:00:00.000Z",
  createdAt: "2026-09-30T08:00:00.000Z",
  ...over,
});

const code = (over: Partial<Discount> = {}): Discount =>
  doc({
    title: "EID10",
    kind: "code",
    code: "EID10",
    valueType: "fixed",
    percentOff: null,
    amountOffFils: 5000,
    appliesTo: "all",
    products: [],
    labelEn: null,
    labelAr: null,
    minSubtotalFils: 30000,
    usageLimit: 100,
    oncePerCustomer: true,
    ...over,
  });

describe("a new discount", () => {
  it("opens as a draft, for both kinds", () => {
    expect(blankDiscountValues("automatic").active).toBe(false);
    expect(blankDiscountValues("code").active).toBe(false);
  });

  it("starts with no dates, so nothing is scheduled by accident", () => {
    const blank = blankDiscountValues("automatic");
    expect([blank.startDate, blank.startTime, blank.endDate, blank.endTime]).toEqual(["", "", "", ""]);
  });
});

describe("discountFormValues", () => {
  it("shows the stored instants as Abu Dhabi wall time", () => {
    const values = discountFormValues(doc());
    expect(values.startDate).toBe("2026-10-01");
    expect(values.startTime).toBe("18:00");
    expect(values.endDate).toBe("2026-10-10");
    expect(values.endTime).toBe("23:59");
  });

  it("shows fils as the dirhams an amount box holds", () => {
    expect(discountFormValues(code()).amountOffAed).toBe("50");
    expect(discountFormValues(code({ amountOffFils: 5050 })).amountOffAed).toBe("50.50");
    expect(discountFormValues(code()).minSubtotalAed).toBe("300");
    expect(discountFormValues(doc()).amountOffAed).toBe("");
  });

  it("reads relationships whether they are ids or populated", () => {
    const populated = doc({ products: [{ id: 11 } as never, 12] });
    expect(discountFormValues(populated).productIds).toEqual(["11", "12"]);
  });
});

describe("duplicateDiscountValues", () => {
  it("keeps the terms", () => {
    const copy = duplicateDiscountValues(doc(), "Eid 2026 (copy)");
    expect(copy.percentOff).toBe("20");
    expect(copy.appliesTo).toBe("products");
    expect(copy.productIds).toEqual(["11", "12", "13"]);
    expect(copy.labelEn).toBe("Eid offer");
    expect(copy.labelAr).toBe("عرض العيد");
  });

  it("is a draft with no dates, whatever the original was", () => {
    const copy = duplicateDiscountValues(doc({ active: true }), "Eid 2026 (copy)");
    expect(copy.active).toBe(false);
    expect([copy.startDate, copy.startTime, copy.endDate, copy.endTime]).toEqual(["", "", "", ""]);
  });

  it("is a new record, and a code must be chosen afresh", () => {
    const copy = duplicateDiscountValues(code(), "EID10 (copy)");
    expect(copy.id).toBeUndefined();
    expect(copy.code).toBe("");
    expect(copy.title).toBe("EID10 (copy)");
    expect(copy.usageLimit).toBe("100");
    expect(copy.oncePerCustomer).toBe(true);
  });
});

describe("instantFromInputs", () => {
  it("reads the inputs as Abu Dhabi time", () => {
    expect(instantFromInputs("2026-10-10", "18:00")).toBe("2026-10-10T14:00:00.000Z");
  });

  it("uses the start of the day when no time is given", () => {
    expect(instantFromInputs("2026-10-10", "")).toBe("2026-10-09T20:00:00.000Z");
  });

  it("is null without a real date", () => {
    expect(instantFromInputs("", "18:00")).toBeNull();
    expect(instantFromInputs("10/10/2026", "18:00")).toBeNull();
  });
});

describe("the sentences", () => {
  it("says what a discount takes off", () => {
    expect(valueText(english, termsOf(doc()))).toBe("20% off");
    expect(valueText(english, termsOf(code()))).toBe("AED 50 off");
  });

  it("says what a sale applies to, with the right plural", () => {
    expect(scopeText(english, termsOf(doc()))).toBe("3 products");
    expect(scopeText(english, termsOf(doc({ products: [11] })))).toBe("1 product");
    expect(scopeText(english, termsOf(doc({ appliesTo: "all", products: [] })))).toBe("All products");
    expect(scopeText(english, termsOf(doc({ appliesTo: "occasions", occasions: [1, 2] })))).toBe(
      "2 occasions",
    );
    expect(
      scopeText(english, termsOf(doc({ appliesTo: "categories", categories: ["bouquet"] }))),
    ).toBe("1 category");
  });

  it("puts a sale's value and scope on one line", () => {
    expect(summaryLine(english, termsOf(doc()))).toBe("20% off · 3 products");
  });

  it("says a code is for the whole order, and its minimum", () => {
    expect(summaryLine(english, termsOf(code()))).toBe(
      "AED 50 off the entire order · Minimum purchase of AED 300",
    );
    expect(summaryLine(english, termsOf(code({ minSubtotalFils: null })))).toBe(
      "AED 50 off the entire order",
    );
  });

  it("reads as a sentence in Arabic too", () => {
    expect(summaryLine(arabic, termsOf(doc()))).toBe("خصم 20% · 3 منتجات");
    expect(scopeText(arabic, termsOf(doc({ products: [11, 12] })))).toBe("منتجان");
  });

  it("gives the dates in Abu Dhabi time, or says there are none", () => {
    /* 14:00Z is 18:00 in Abu Dhabi; the admin prints its clock the way every
       other screen does, so only the day and the hour are pinned here. */
    const both = datesText(english, doc().startsAt, doc().endsAt);
    expect(both).toContain("1 Oct");
    expect(both).toContain("10 Oct");
    expect(both).toMatch(/0?6:00|18:00/);
    expect(both).toMatch(/11:59|23:59/);
    expect(both).toContain(" – ");
    expect(datesText(english, null, null)).toBe("From activation – No end date");
  });

  it("explains each status under the Active switch", () => {
    expect(statusLine(english, "draft", null)).toBe("Draft. Nothing changes on the store.");
    expect(statusLine(english, "active", null)).toBe("Live on the store now.");
    expect(statusLine(english, "scheduled", doc().startsAt)).toMatch(
      /^Scheduled\. It starts by itself on 1 Oct, (0?6:00|18:00)/,
    );
    expect(statusLine(english, "expired", null)).toContain("Expired");
  });
});
