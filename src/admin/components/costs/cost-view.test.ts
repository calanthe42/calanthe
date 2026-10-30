import { describe, expect, it } from "vitest";
import { ar } from "@admin/i18n/ar";
import { en } from "@admin/i18n/en";
import { createTranslator, type Messages } from "@admin/i18n/translate";
import {
  comesAsText,
  countText,
  filsToAedInput,
  packNameOf,
  per100Number,
  perOneText,
  priceLineText,
  signedMoney,
  whereFromText,
} from "./cost-view";

const english = createTranslator("en", en as Messages);
const arabic = createTranslator("ar", ar as Messages);

describe("cost view", () => {
  it("prints a price for one in the reader's words", () => {
    expect(perOneText(english, 323, "stem")).toBe("AED 3.23 a stem");
    expect(perOneText(english, 240, "metre")).toBe("AED 2.40 a metre");
    /* Fractions of a fils are kept in the data, rounded only for display. */
    expect(perOneText(english, 37.5, "stem")).toBe("AED 0.38 a stem");
    expect(perOneText(arabic, 323, "stem")).toBe("AED 3.23 للساق");
  });

  it("counts with the right plural, decimals included", () => {
    expect(countText(english, 1, "stem")).toBe("1 stem");
    expect(countText(english, 100, "stem")).toBe("100 stems");
    expect(countText(english, 1.5, "metre")).toBe("1.5 metres");
    expect(countText(arabic, 2, "stem")).toBe("ساقان");
    expect(countText(arabic, 5, "piece")).toBe("5 قطع");
  });

  it("says how it comes, in her words", () => {
    expect(comesAsText(english, { packName: "bunch", unitsPerPack: 20, one: "stem" })).toBe("a bunch of 20");
    expect(comesAsText(english, { packName: "carton", unitsPerPack: 25, one: "piece" })).toBe("a carton of 25");
    expect(comesAsText(english, { packName: "single", unitsPerPack: 1, one: "stem" })).toBe("single stems");
    expect(comesAsText(english, { packName: null, unitsPerPack: 1, one: "metre" })).toBe("by the metre");
    /* An older word she typed herself still reads. */
    expect(comesAsText(english, { packName: "Crate", unitsPerPack: 10, one: "piece" })).toBe("Crate of 10");
    expect(comesAsText(arabic, { packName: "bunch", unitsPerPack: 20, one: "stem" })).toBe("حزمة من 20");
  });

  it("reads an older pack word as one of hers", () => {
    expect(packNameOf("Bunch")).toBe("bunch");
    expect(packNameOf("boxes")).toBe("box");
    expect(packNameOf("")).toBe("single");
    expect(packNameOf(null)).toBe("single");
    expect(packNameOf("crate")).toBeNull();
  });

  it("says where a price came from", () => {
    const fromInvoice = {
      costSource: "invoice" as const,
      lastPaidAt: "2026-10-26T00:00:00.000Z",
      lastSupplier: { name: "Al Aweer" },
    };
    expect(whereFromText(english, fromInvoice)).toBe("last paid 26 Oct, Al Aweer");
    expect(whereFromText(english, { ...fromInvoice, lastSupplier: null })).toBe("last paid 26 Oct");
    expect(whereFromText(english, { costSource: "typed", lastPaidAt: null, lastSupplier: null })).toBe("typed by you");
    expect(priceLineText(english, { ...fromInvoice, priceForOneFils: 323, one: "stem" })).toBe(
      "AED 3.23 a stem, last paid 26 Oct, Al Aweer",
    );
    expect(priceLineText(english, { ...fromInvoice, priceForOneFils: null, one: "stem" })).toBe("no price yet");
  });

  it("prints the share of every AED 100 to one decimal, without a trailing .0", () => {
    expect(per100Number(english.number, 20.2)).toBe("20.2");
    expect(per100Number(english.number, 33)).toBe("33");
    expect(per100Number(english.number, 33.44)).toBe("33.4");
  });

  it("shows a loss with its sign, which money() alone never prints", () => {
    expect(signedMoney(english.money, 1250)).toBe("AED 12.50");
    expect(signedMoney(english.money, -1250)).toBe("−AED 12.50");
    expect(signedMoney(english.money, 0)).toBe("AED 0");
  });

  it("turns fils back into what an AED input shows", () => {
    expect(filsToAedInput(48000)).toBe("480");
    expect(filsToAedInput(362.5)).toBe("3.625");
    expect(filsToAedInput(0)).toBe("");
    expect(filsToAedInput(null)).toBe("");
    expect(filsToAedInput(Number.NaN)).toBe("");
  });
});
