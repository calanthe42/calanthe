import { describe, expect, it } from "vitest";
import { ar } from "@admin/i18n/ar";
import { en } from "@admin/i18n/en";
import { createTranslator, type Messages } from "@admin/i18n/translate";
import { boughtAsText, filsToAedInput, perUnitText, signedMoney, unitCountText } from "./cost-view";

const english = createTranslator("en", en as Messages);
const arabic = createTranslator("ar", ar as Messages);

describe("cost view", () => {
  it("prints a unit cost in the reader's words", () => {
    expect(perUnitText(english, 361, "stem")).toBe("AED 3.61 a stem");
    expect(perUnitText(english, 240, "metre")).toBe("AED 2.40 a metre");
    /* Fractions of a fils are kept in the data, rounded only for display. */
    expect(perUnitText(english, 37.5, "stem")).toBe("AED 0.38 a stem");
    expect(perUnitText(arabic, 361, "stem")).toBe("AED 3.61 للساق");
  });

  it("counts units with the right plural, decimals included", () => {
    expect(unitCountText(english, 1, "stem")).toBe("1 stem");
    expect(unitCountText(english, 24, "stem")).toBe("24 stems");
    expect(unitCountText(english, 1.5, "metre")).toBe("1.5 metres");
    expect(unitCountText(arabic, 2, "stem")).toBe("ساقان");
    expect(unitCountText(arabic, 5, "piece")).toBe("5 قطع");
  });

  it("says how it is bought", () => {
    expect(boughtAsText(english, { packName: "Bunch", unitsPerPack: 20, useUnit: "stem" })).toBe("Bunch of 20 stems");
    expect(boughtAsText(english, { packName: "Roll", unitsPerPack: 50, useUnit: "metre" })).toBe("Roll of 50 metres");
    expect(boughtAsText(english, { packName: null, unitsPerPack: 1, useUnit: "stem" })).toBe("Single stems");
    expect(boughtAsText(english, { packName: "  ", unitsPerPack: 1, useUnit: "metre" })).toBe("By the metre");
  });

  it("shows a loss with its sign, which money() alone never prints", () => {
    expect(signedMoney(english.money, 1250)).toBe("AED 12.50");
    expect(signedMoney(english.money, -1250)).toBe("−AED 12.50");
    expect(signedMoney(english.money, 0)).toBe("AED 0");
  });

  it("turns fils back into what an AED input shows", () => {
    expect(filsToAedInput(48000)).toBe("480");
    expect(filsToAedInput(26500)).toBe("265");
    expect(filsToAedInput(362.5)).toBe("3.625");
    expect(filsToAedInput(37.5)).toBe("0.375");
    expect(filsToAedInput(0)).toBe("");
    expect(filsToAedInput(Number.NaN)).toBe("");
  });
});
