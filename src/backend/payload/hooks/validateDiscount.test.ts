import { describe, expect, it } from "vitest";
import { validateDiscount } from "./validateDiscount";

/**
 * The discount collection's own rules — the ones that hold whoever writes:
 * the admin, /cms, a REST call, or server code.
 */

type Doc = Record<string, unknown>;

const run = (data: Doc, operation: "create" | "update" = "create", originalDoc?: Doc) =>
  validateDiscount({ data, operation, originalDoc } as never) as Doc;

const sale = (over: Doc = {}): Doc => ({
  title: "Eid 2026",
  kind: "automatic",
  valueType: "percentage",
  percentOff: 20,
  appliesTo: "all",
  labelEn: "Eid offer",
  labelAr: "عرض العيد",
  ...over,
});

const code = (over: Doc = {}): Doc => ({
  kind: "code",
  code: "eid10",
  valueType: "fixed",
  amountOffFils: 5000,
  ...over,
});

describe("validateDiscount — value", () => {
  it("keeps exactly one of percentage and amount", () => {
    expect(run(sale({ amountOffFils: 9999 }))).toMatchObject({ percentOff: 20, amountOffFils: null });
    expect(run(code({ percentOff: 50 }))).toMatchObject({ amountOffFils: 5000, percentOff: null });
  });

  it("refuses a percentage outside 1–90 or not whole", () => {
    for (const percentOff of [0, 91, 100, 20.5, -1, null, undefined, "abc"]) {
      expect(() => run(sale({ percentOff }))).toThrow(/whole number from 1 to 90/);
    }
  });

  it("refuses a fixed amount under one dirham", () => {
    for (const amountOffFils of [0, 99, null, 100.5]) {
      expect(() => run(code({ amountOffFils }))).toThrow(/at least AED 1/);
    }
    expect(() => run(code({ amountOffFils: 100 }))).not.toThrow();
  });

  it("refuses a missing value type", () => {
    expect(() => run(sale({ valueType: undefined }))).toThrow(/percentage or a fixed amount/);
  });
});

describe("validateDiscount — an automatic sale", () => {
  it("never keeps a code or the code-only limits, and stores null rather than an empty code", () => {
    const data = run(sale({ code: "", minSubtotalFils: 100, usageLimit: 5, oncePerCustomer: true }));
    expect(data).toMatchObject({ code: null, minSubtotalFils: null, usageLimit: null, oncePerCustomer: false });
  });

  it("requires both customer labels, within the length a card can show", () => {
    expect(() => run(sale({ labelEn: "" }))).toThrow(/both English and Arabic/);
    expect(() => run(sale({ labelAr: "  " }))).toThrow(/both English and Arabic/);
    expect(() => run(sale({ labelEn: "x".repeat(29) }))).toThrow(/under 28 characters/);
  });

  it("requires something chosen for a specific scope", () => {
    expect(() => run(sale({ appliesTo: "products", products: [] }))).toThrow(/at least one product/);
    expect(() => run(sale({ appliesTo: "occasions" }))).toThrow(/at least one occasion/);
    expect(() => run(sale({ appliesTo: "categories", categories: [] }))).toThrow(/at least one category/);
    expect(() => run(sale({ appliesTo: "products", products: [7] }))).not.toThrow();
  });

  it("requires a name", () => {
    expect(() => run(sale({ title: " " }))).toThrow(/Give the discount a name/);
  });
});

describe("validateDiscount — a discount code", () => {
  it("stores the code in capitals and applies to the whole order", () => {
    const data = run(code({ code: " eid 10 ", appliesTo: "products", products: [7], categories: ["plant"] }));
    expect(data).toMatchObject({ code: "EID10", appliesTo: "all", products: [], occasions: [], categories: [] });
  });

  it("names itself after the code when no name is given", () => {
    expect(run(code()).title).toBe("EID10");
    expect(run(code({ title: "Welcome" })).title).toBe("Welcome");
  });

  it("refuses a code that cannot be one", () => {
    for (const bad of ["", "ab", "A".repeat(25), "EID%10", null]) {
      expect(() => run(code({ code: bad }))).toThrow(/3 to 24 letters and numbers/);
    }
  });

  it("refuses a nonsensical minimum or limit", () => {
    expect(() => run(code({ minSubtotalFils: -1 }))).toThrow(/minimum purchase/);
    expect(() => run(code({ usageLimit: 0 }))).toThrow(/usage limit/);
    expect(() => run(code({ usageLimit: 2.5 }))).toThrow(/usage limit/);
  });
});

describe("validateDiscount — dates and kind", () => {
  it("refuses an end at or before the start", () => {
    const startsAt = "2026-10-10T14:00:00.000Z";
    expect(() => run(sale({ startsAt, endsAt: startsAt }))).toThrow(/end must be after the start/);
    expect(() => run(sale({ startsAt, endsAt: "2026-10-09T14:00:00.000Z" }))).toThrow(/end must be after/);
    expect(() => run(sale({ startsAt, endsAt: "2026-10-10T14:00:00.001Z" }))).not.toThrow();
    expect(() => run(sale({ endsAt: "2020-01-01T00:00:00.000Z" }))).not.toThrow();
  });

  it("refuses a date that is not one", () => {
    expect(() => run(sale({ startsAt: "soon" }))).toThrow(/not a real date/);
  });

  it("refuses an unknown kind, and a change of kind", () => {
    expect(() => run(sale({ kind: "bogus" }))).toThrow(/automatic sale or a discount code/);
    expect(() => run({ kind: "code" }, "update", sale())).toThrow(/cannot be changed/);
  });

  it("judges a partial update against the stored document", () => {
    /* Switching a live sale off sends only { active }. */
    expect(() => run({ active: false }, "update", sale())).not.toThrow();
    /* …and an edit that breaks a rule is still caught. */
    expect(() => run({ percentOff: 95 }, "update", sale())).toThrow(/1 to 90/);
    expect(() => run({ labelAr: "" }, "update", sale())).toThrow(/both English and Arabic/);
  });

  it("lets an expired discount be switched off: an end in the past is not an error", () => {
    const expired = sale({ endsAt: "2020-01-01T00:00:00.000Z", active: true });
    expect(() => run({ active: false }, "update", expired)).not.toThrow();
  });
});
