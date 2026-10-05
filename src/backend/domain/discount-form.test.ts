import { describe, expect, it } from "vitest";
import { validateDiscount } from "@backend/payload/hooks/validateDiscount";
import { discountFields, parseDiscountForm } from "./discount-form";
import {
  discountImpact,
  liveTermsChanged,
  tooDeepFor,
  type ImpactProduct,
} from "./discount-impact";
import { FormInputError } from "./form-error";

/**
 * The discount editor, read into a record — and what saving it live would do.
 */

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const sale = (over: Record<string, string | string[]> = {}) =>
  form({
    title: "Eid 2026",
    labelEn: "Eid offer",
    labelAr: "عرض العيد",
    valueType: "percentage",
    percentOff: "20",
    appliesTo: "all",
    ...over,
  });

const code = (over: Record<string, string | string[]> = {}) =>
  form({ code: "eid10", valueType: "fixed", amountOffAed: "50", ...over });

const refusal = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof FormInputError) return error.code;
    throw error;
  }
  return undefined;
};

describe("parseDiscountForm — an automatic sale", () => {
  it("parses a percentage sale", () => {
    expect(parseDiscountForm(sale(), "automatic")).toEqual({
      kind: "automatic",
      title: "Eid 2026",
      code: null,
      valueType: "percentage",
      percentOff: 20,
      amountOffFils: null,
      appliesTo: "all",
      productIds: [],
      occasionIds: [],
      categories: [],
      labelEn: "Eid offer",
      labelAr: "عرض العيد",
      startsAt: null,
      endsAt: null,
      active: false,
      confirmed: false,
      minSubtotalFils: null,
      usageLimit: null,
      oncePerCustomer: false,
    });
  });

  it("is a DRAFT unless the form asks for active — and reports the confirmation separately", () => {
    expect(parseDiscountForm(sale(), "automatic").active).toBe(false);
    const asked = parseDiscountForm(sale({ active: "on" }), "automatic");
    expect(asked).toMatchObject({ active: true, confirmed: false });
    const confirmed = parseDiscountForm(sale({ active: "on", confirmActivation: "on" }), "automatic");
    expect(confirmed).toMatchObject({ active: true, confirmed: true });
  });

  it("turns dirhams into fils for a fixed amount", () => {
    const parsed = parseDiscountForm(sale({ valueType: "fixed", amountOffAed: "480.50" }), "automatic");
    expect(parsed).toMatchObject({ valueType: "fixed", amountOffFils: 48050, percentOff: null });
  });

  it("never reads a raw fils amount smuggled into the form", () => {
    const parsed = parseDiscountForm(sale({ amountOffFils: "999999", valueType: "percentage" }), "automatic");
    expect(parsed.amountOffFils).toBeNull();
  });

  it("refuses a percentage that is not a whole number from 1 to 90", () => {
    for (const percentOff of ["20.5", "0", "91", "-5", "", "ten", "100"]) {
      expect(refusal(() => parseDiscountForm(sale({ percentOff }), "automatic"))).toBe("percentRange");
    }
    expect(parseDiscountForm(sale({ percentOff: "1" }), "automatic").percentOff).toBe(1);
    expect(parseDiscountForm(sale({ percentOff: "90" }), "automatic").percentOff).toBe(90);
  });

  it("refuses a fixed amount under one dirham, or none", () => {
    for (const amountOffAed of ["", "0", "0.99"]) {
      expect(refusal(() => parseDiscountForm(sale({ valueType: "fixed", amountOffAed }), "automatic"))).toBe("amountMin");
    }
    expect(refusal(() => parseDiscountForm(sale({ valueType: "fixed", amountOffAed: "abc" }), "automatic"))).toBe("amountFormat");
  });

  it("refuses a missing value type", () => {
    expect(refusal(() => parseDiscountForm(sale({ valueType: "" }), "automatic"))).toBe("valueTypeRequired");
  });

  it("requires a title and both customer labels", () => {
    expect(refusal(() => parseDiscountForm(sale({ title: " " }), "automatic"))).toBe("discountTitle");
    expect(refusal(() => parseDiscountForm(sale({ labelEn: "" }), "automatic"))).toBe("labelRequired");
    expect(refusal(() => parseDiscountForm(sale({ labelAr: "" }), "automatic"))).toBe("labelRequired");
    expect(refusal(() => parseDiscountForm(sale({ labelEn: "x".repeat(29) }), "automatic"))).toBe("tooLong");
  });

  it("keeps only the list that matches what the sale applies to", () => {
    const parsed = parseDiscountForm(
      sale({ appliesTo: "products", productIds: ["7", "8", "7"], occasionIds: ["3"], categories: ["plant"] }),
      "automatic",
    );
    expect(parsed).toMatchObject({ appliesTo: "products", productIds: [7, 8], occasionIds: [], categories: [] });

    const byCategory = parseDiscountForm(
      sale({ appliesTo: "categories", categories: ["plant", "nonsense", "bouquet"] }),
      "automatic",
    );
    expect(byCategory.categories).toEqual(["plant", "bouquet"]);
  });

  it("refuses a specific scope with nothing chosen", () => {
    for (const appliesTo of ["products", "occasions", "categories"]) {
      expect(refusal(() => parseDiscountForm(sale({ appliesTo }), "automatic"))).toBe("pickAtLeastOne");
    }
    expect(refusal(() => parseDiscountForm(sale({ appliesTo: "everything" }), "automatic"))).toBe("appliesToUnknown");
  });

  it("drops code-only fields, whatever the form sent", () => {
    const parsed = parseDiscountForm(
      sale({ code: "SNEAK", minSubtotalAed: "300", usageLimit: "5", oncePerCustomer: "on" }),
      "automatic",
    );
    expect(parsed).toMatchObject({ code: null, minSubtotalFils: null, usageLimit: null, oncePerCustomer: false });
  });
});

describe("parseDiscountForm — a discount code", () => {
  it("parses a fixed code with a minimum and limits, uppercased and trimmed", () => {
    const parsed = parseDiscountForm(
      code({ code: "  eid 10 ", minSubtotalAed: "300", usageLimit: "100", oncePerCustomer: "on" }),
      "code",
    );
    expect(parsed).toMatchObject({
      kind: "code",
      code: "EID10",
      /* The internal name defaults to the code. */
      title: "EID10",
      valueType: "fixed",
      amountOffFils: 5000,
      minSubtotalFils: 30000,
      usageLimit: 100,
      oncePerCustomer: true,
      appliesTo: "all",
      labelEn: null,
      labelAr: null,
    });
  });

  it("keeps an internal name when one is given", () => {
    expect(parseDiscountForm(code({ title: "Welcome offer" }), "code").title).toBe("Welcome offer");
  });

  it("refuses a code that is too short, too long, or has anything but letters, digits, - and _", () => {
    for (const bad of ["ab", "A".repeat(25), "has%sign", "", "-EID10", "خصم10"]) {
      expect(refusal(() => parseDiscountForm(code({ code: bad }), "code"))).toBe("codeFormat");
    }
    /* Inner spaces are removed, as they are when a customer types the code. */
    expect(parseDiscountForm(code({ code: "has space" }), "code").code).toBe("HASSPACE");
  });

  it("forces the whole order and ignores any product list", () => {
    const parsed = parseDiscountForm(code({ appliesTo: "products", productIds: ["7"] }), "code");
    expect(parsed).toMatchObject({ appliesTo: "all", productIds: [] });
  });

  it("treats no minimum, or zero, as no minimum", () => {
    expect(parseDiscountForm(code(), "code").minSubtotalFils).toBeNull();
    expect(parseDiscountForm(code({ minSubtotalAed: "0" }), "code").minSubtotalFils).toBeNull();
  });

  it("refuses a usage limit below one or not whole", () => {
    for (const usageLimit of ["0", "-3", "2.5", "many"]) {
      expect(refusal(() => parseDiscountForm(code({ usageLimit }), "code"))).toBe("usageLimitMin");
    }
    expect(parseDiscountForm(code({ usageLimit: "" }), "code").usageLimit).toBeNull();
  });
});

describe("parseDiscountForm — dates, in Abu Dhabi time", () => {
  it("reads 18:00 on 10 October as 14:00 UTC", () => {
    const parsed = parseDiscountForm(sale({ startDate: "2026-10-10", startTime: "18:00" }), "automatic");
    expect(parsed.startsAt).toBe("2026-10-10T14:00:00.000Z");
    expect(parsed.endsAt).toBeNull();
  });

  it("allows an end with no start", () => {
    const parsed = parseDiscountForm(sale({ endDate: "2026-10-20", endTime: "23:59" }), "automatic");
    expect(parsed).toMatchObject({ startsAt: null, endsAt: "2026-10-20T19:59:00.000Z" });
  });

  it("refuses an end at or before the start", () => {
    const window = { startDate: "2026-10-10", startTime: "18:00", endDate: "2026-10-10" };
    expect(refusal(() => parseDiscountForm(sale({ ...window, endTime: "18:00" }), "automatic"))).toBe("endBeforeStart");
    expect(refusal(() => parseDiscountForm(sale({ ...window, endTime: "09:00" }), "automatic"))).toBe("endBeforeStart");
    expect(parseDiscountForm(sale({ ...window, endTime: "18:01" }), "automatic").endsAt).toBe("2026-10-10T14:01:00.000Z");
  });

  it("refuses a date that is not real", () => {
    expect(refusal(() => parseDiscountForm(sale({ startDate: "2026-02-31", startTime: "10:00" }), "automatic"))).toBe("dateTimeFormat");
  });
});

describe("discountFields", () => {
  it("is what the collection's own hook accepts, for both kinds", () => {
    const automatic = parseDiscountForm(sale({ appliesTo: "products", productIds: ["7"] }), "automatic");
    const coded = parseDiscountForm(code({ minSubtotalAed: "300", usageLimit: "10" }), "code");
    for (const parsed of [automatic, coded]) {
      const data = { kind: parsed.kind, ...discountFields(parsed, false) };
      expect(() => validateDiscount({ data, operation: "create" } as never)).not.toThrow();
    }
  });

  it("saves the active flag it is GIVEN, not the one the form asked for", () => {
    const asked = parseDiscountForm(sale({ active: "on" }), "automatic");
    expect(discountFields(asked, false).active).toBe(false);
    expect(discountFields(asked, true).active).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* What going live would change                                        */
/* ------------------------------------------------------------------ */

const NOW = new Date("2026-10-05T10:00:00.000Z");

const product = (over: Partial<ImpactProduct> = {}): ImpactProduct => ({
  id: "1",
  name: "Amber Hour",
  priceFils: 48000,
  occasionIds: ["3"],
  category: "bouquet",
  ...over,
});

const CATALOGUE: ImpactProduct[] = [
  product(),
  product({ id: "2", name: "Peony Cloud", priceFils: 12000, category: "single-stem" }),
  product({ id: "3", name: "Quiet Morning", priceFils: 95000, occasionIds: ["4"] }),
];

describe("discountImpact — the numbers in the confirmation", () => {
  it("counts the products a sale lowers and names the cheapest result", () => {
    const impact = discountImpact(parseDiscountForm(sale(), "automatic"), CATALOGUE, NOW);
    expect(impact).toEqual({
      kind: "automatic",
      status: "active",
      productCount: 3,
      lowest: { name: "Peony Cloud", wasFils: 12000, nowFils: 9600 },
      deepest: { name: "Amber Hour", wasFils: 48000, nowFils: 38400, percent: 20 },
      valueType: "percentage",
      percentOff: 20,
      amountOffFils: 0,
    });
  });

  it("shows the mistake: 50 typed for 5 halves every price", () => {
    const impact = discountImpact(parseDiscountForm(sale({ percentOff: "50" }), "automatic"), CATALOGUE, NOW);
    expect(impact).toMatchObject({ productCount: 3, lowest: { name: "Peony Cloud", nowFils: 6000 } });
  });

  it("shows the mistake: a fixed amount hits the cheap product hardest", () => {
    const parsed = parseDiscountForm(sale({ valueType: "fixed", amountOffAed: "100" }), "automatic");
    const impact = discountImpact(parsed, CATALOGUE, NOW);
    expect(impact).toMatchObject({
      lowest: { name: "Peony Cloud", wasFils: 12000, nowFils: 2000 },
      deepest: { name: "Peony Cloud", percent: 83 },
    });
  });

  it("counts only the products the sale applies to", () => {
    const byProduct = parseDiscountForm(sale({ appliesTo: "products", productIds: ["3"] }), "automatic");
    expect(discountImpact(byProduct, CATALOGUE, NOW)).toMatchObject({
      productCount: 1,
      lowest: { name: "Quiet Morning" },
    });
    const byOccasion = parseDiscountForm(sale({ appliesTo: "occasions", occasionIds: ["3"] }), "automatic");
    expect(discountImpact(byOccasion, CATALOGUE, NOW)).toMatchObject({ productCount: 2 });
    const nothing = parseDiscountForm(sale({ appliesTo: "categories", categories: ["plant"] }), "automatic");
    expect(discountImpact(nothing, CATALOGUE, NOW)).toMatchObject({ productCount: 0, lowest: null, deepest: null });
  });

  it("says whether it would be live now, scheduled or already over", () => {
    const status = (over: Record<string, string>) =>
      discountImpact(parseDiscountForm(sale(over), "automatic"), CATALOGUE, NOW).status;
    expect(status({})).toBe("active");
    expect(status({ startDate: "2026-10-10", startTime: "18:00" })).toBe("scheduled");
    expect(status({ endDate: "2026-10-01", endTime: "10:00" })).toBe("expired");
  });

  it("describes a code by its terms", () => {
    const parsed = parseDiscountForm(code({ minSubtotalAed: "300", usageLimit: "100", oncePerCustomer: "on" }), "code");
    expect(discountImpact(parsed, CATALOGUE, NOW)).toEqual({
      kind: "code",
      status: "active",
      code: "EID10",
      valueType: "fixed",
      percentOff: 0,
      amountOffFils: 5000,
      minSubtotalFils: 30000,
      usageLimit: 100,
      oncePerCustomer: true,
    });
  });
});

describe("tooDeepFor — a fixed sale deeper than 90% of a product", () => {
  const fixed = (aed: string, over: Record<string, string | string[]> = {}) =>
    parseDiscountForm(sale({ valueType: "fixed", amountOffAed: aed, ...over }), "automatic");

  it("names the cheapest product the amount is too deep for", () => {
    /* 90% of AED 120 is AED 108. */
    expect(tooDeepFor(fixed("109"), CATALOGUE)).toEqual({ name: "Peony Cloud", priceFils: 12000 });
    expect(tooDeepFor(fixed("108"), CATALOGUE)).toBeNull();
  });

  it("looks only at products the sale applies to", () => {
    expect(tooDeepFor(fixed("400", { appliesTo: "products", productIds: ["3"] }), CATALOGUE)).toBeNull();
    expect(tooDeepFor(fixed("400", { appliesTo: "products", productIds: ["1", "3"] }), CATALOGUE)).toBeNull();
    expect(tooDeepFor(fixed("433", { appliesTo: "products", productIds: ["1", "3"] }), CATALOGUE)).toEqual({
      name: "Amber Hour",
      priceFils: 48000,
    });
  });

  it("does not apply to a percentage, a code, or a sale that matches nothing", () => {
    expect(tooDeepFor(parseDiscountForm(sale({ percentOff: "90" }), "automatic"), CATALOGUE)).toBeNull();
    expect(tooDeepFor(parseDiscountForm(code({ amountOffAed: "5000" }), "code"), CATALOGUE)).toBeNull();
    expect(tooDeepFor(fixed("5000", { appliesTo: "categories", categories: ["plant"] }), CATALOGUE)).toBeNull();
  });
});

describe("liveTermsChanged — does an edit change what customers pay?", () => {
  const stored = {
    title: "Eid 2026",
    labelEn: "Eid offer",
    code: null,
    valueType: "percentage",
    percentOff: 20,
    amountOffFils: null,
    appliesTo: "products",
    products: [7, { id: 8 }],
    occasions: [],
    categories: [],
    startsAt: "2026-10-10T14:00:00.000Z",
    endsAt: null,
    minSubtotalFils: null,
    usageLimit: null,
    oncePerCustomer: false,
  };

  it("is false for a rename or a new label", () => {
    expect(liveTermsChanged(stored, { ...stored, title: "Eid", labelEn: "Offer" })).toBe(false);
  });

  it("is false when the same things are written differently", () => {
    expect(
      liveTermsChanged(stored, {
        ...stored,
        products: [8, 7],
        startsAt: "2026-10-10T18:00:00+04:00",
        endsAt: undefined,
        amountOffFils: undefined,
      }),
    ).toBe(false);
  });

  it("is true for the value, the scope, the products or the dates", () => {
    expect(liveTermsChanged(stored, { ...stored, percentOff: 50 })).toBe(true);
    expect(liveTermsChanged(stored, { ...stored, valueType: "fixed", amountOffFils: 2000, percentOff: null })).toBe(true);
    expect(liveTermsChanged(stored, { ...stored, appliesTo: "all", products: [] })).toBe(true);
    expect(liveTermsChanged(stored, { ...stored, products: [7] })).toBe(true);
    expect(liveTermsChanged(stored, { ...stored, endsAt: "2026-10-20T19:59:00.000Z" })).toBe(true);
    expect(liveTermsChanged(stored, { ...stored, usageLimit: 10 })).toBe(true);
  });
});
