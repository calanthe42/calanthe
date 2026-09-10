import { describe, expect, it } from "vitest";
import { FormInputError } from "./form-error";
import {
  PUBLISH_NEEDS_PHOTO,
  parseAedToFils,
  parseIdList,
  parseProductForm,
  parseSlug,
} from "./product-form";

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

const base = { name: "Amber Hour", priceAed: "480", category: "bouquet" };

describe("parseAedToFils — the owner types dirhams, the database stores fils", () => {
  it("converts whole and fractional dirhams exactly", () => {
    expect(parseAedToFils("480", "Price")).toBe(48000);
    expect(parseAedToFils("490", "Price")).toBe(49000);
    expect(parseAedToFils("480.5", "Price")).toBe(48050);
    expect(parseAedToFils("480.50", "Price")).toBe(48050);
    expect(parseAedToFils("0.29", "Price")).toBe(29);
  });

  it("accepts the ways people naturally write a price", () => {
    expect(parseAedToFils("1,200", "Price")).toBe(120000);
    expect(parseAedToFils("AED 480", "Price")).toBe(48000);
  });

  it("treats empty as no amount", () => {
    expect(parseAedToFils("", "Price")).toBeNull();
  });

  it("refuses anything it would otherwise have to guess", () => {
    for (const bad of ["-5", "480.555", "four hundred", "48000 fils", "1e3"]) {
      expect(() => parseAedToFils(bad, "Price")).toThrow(FormInputError);
    }
  });
});

describe("parseProductForm", () => {
  it("never reads a raw fils amount from the form — only priceAed", () => {
    const parsed = parseProductForm(form({ ...base, priceFils: "1", compareAtPriceFils: "2" }));
    expect(parsed.priceFils).toBe(48000);
    expect(parsed.compareAtPriceFils).toBeNull();
  });

  it("refuses to publish a product with no photograph, in the owner's words", () => {
    expect(() => parseProductForm(form({ ...base, available: "on" }))).toThrow(PUBLISH_NEEDS_PHOTO);
  });

  it("allows publishing once a photograph is chosen", () => {
    const parsed = parseProductForm(form({ ...base, available: "on", imageIds: "7" }));
    expect(parsed.available).toBe(true);
    expect(parsed.imageIds).toEqual([7]);
  });

  it("keeps the chosen photo order and drops duplicates", () => {
    const parsed = parseProductForm(form({ ...base, imageIds: ["9", "3", "9", "5"] }));
    expect(parsed.imageIds).toEqual([9, 3, 5]);
  });

  it("requires the compare-at price to be above the price, and clears it when empty", () => {
    expect(() => parseProductForm(form({ ...base, compareAtPriceAed: "480" }))).toThrow(FormInputError);
    expect(parseProductForm(form({ ...base, compareAtPriceAed: "600" })).compareAtPriceFils).toBe(60000);
    expect(parseProductForm(form({ ...base, compareAtPriceAed: "" })).compareAtPriceFils).toBeNull();
  });

  it("requires a name and a non-zero price", () => {
    expect(() => parseProductForm(form({ ...base, name: "  " }))).toThrow(FormInputError);
    expect(() => parseProductForm(form({ ...base, priceAed: "" }))).toThrow(FormInputError);
    expect(() => parseProductForm(form({ ...base, priceAed: "0" }))).toThrow(FormInputError);
  });

  it("ignores unknown flowers and refuses an unknown category", () => {
    const parsed = parseProductForm(form({ ...base, flowers: ["roses", "plastic", "roses"] }));
    expect(parsed.flowers).toEqual(["roses"]);
    expect(() => parseProductForm(form({ ...base, category: "weapon" }))).toThrow(FormInputError);
  });

  it("refuses to publish a stock-tracked product with nothing in stock", () => {
    expect(() =>
      parseProductForm(form({ ...base, available: "on", imageIds: "1", trackStock: "on", stock: "0" })),
    ).toThrow(FormInputError);
    const ok = parseProductForm(
      form({ ...base, available: "on", imageIds: "1", trackStock: "on", stock: "4" }),
    );
    expect(ok.stock).toBe(4);
  });

  it("reads the SEO group and the flags", () => {
    const parsed = parseProductForm(
      form({ ...base, seoTitle: "Amber Hour roses", seoDescription: "Warm roses.", noIndex: "on", featured: "on" }),
    );
    expect(parsed.seoTitle).toBe("Amber Hour roses");
    expect(parsed.seoDescription).toBe("Warm roses.");
    expect(parsed.noIndex).toBe(true);
    expect(parsed.featured).toBe(true);
    expect(parsed.newArrival).toBe(false);
  });
});

describe("parseSlug and parseIdList", () => {
  it("normalises a valid web address and refuses a broken one", () => {
    expect(parseSlug("Amber-Hour")).toBe("amber-hour");
    expect(parseSlug("")).toBeUndefined();
    for (const bad of ["amber hour", "amber--hour", "-amber", "amber/hour", "ámbar"]) {
      expect(() => parseSlug(bad)).toThrow(FormInputError);
    }
  });

  it("keeps only positive whole-number ids", () => {
    expect(parseIdList(["3", "abc", "-1", "0", "2.5", "4"])).toEqual([3, 4]);
  });
});
