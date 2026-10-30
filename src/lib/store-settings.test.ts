import { describe, expect, it } from "vitest";
import { ar, en } from "@/lib/i18n/dictionary";
import {
  addonLabel,
  addonsForSale,
  DEFAULT_ADDONS,
  isAddonKey,
  normaliseAddons,
  type StoreAddon,
} from "./store-settings";

/**
 * The owner's add-ons as the shop reads them: her saved list, or — while
 * she has saved none — the list the shop sold before she had a screen.
 */

describe("the default add-ons are today's list, unchanged", () => {
  it("vase 150, balloon 35, bento cake 95, teddy bear 90, polaroid card 25 — all offered", () => {
    expect(DEFAULT_ADDONS.map((a) => [a.key, a.priceFils, a.active])).toEqual([
      ["vase", 15_000, true],
      ["balloon", 3_500, true],
      ["cake", 9_500, true],
      ["teddy", 9_000, true],
      ["polaroid", 2_500, true],
    ]);
  });

  it("carries the names the storefront dictionary has always shown, in both languages", () => {
    for (const addon of DEFAULT_ADDONS) {
      expect(addon.nameEn, addon.key).toBe(en.addonNames[addon.key]);
      expect(addon.nameAr, addon.key).toBe(ar.addonNames[addon.key]);
    }
  });

  it("no longer offers chocolates", () => {
    expect(DEFAULT_ADDONS.some((a) => a.key === "chocolates")).toBe(false);
  });
});

describe("normaliseAddons", () => {
  it("is the defaults while nothing is saved", () => {
    expect(normaliseAddons(null)).toEqual(DEFAULT_ADDONS);
    expect(normaliseAddons(undefined)).toEqual(DEFAULT_ADDONS);
    expect(normaliseAddons([])).toEqual(DEFAULT_ADDONS);
  });

  it("hands back copies, so a caller cannot change the defaults", () => {
    const list = normaliseAddons([]);
    list[0]!.priceFils = 1;
    expect(DEFAULT_ADDONS[0]!.priceFils).toBe(15_000);
  });

  it("is her list, in her order, once she has saved one", () => {
    const saved = [
      { key: "polaroid", nameEn: "Polaroid", nameAr: "بولارويد", priceFils: 3_000, active: true, id: "x1" },
      { key: "vase", nameEn: "Glass vase", nameAr: "مزهرية زجاجية", priceFils: 16_000, active: false, id: "x2" },
    ];
    expect(normaliseAddons(saved)).toEqual([
      { key: "polaroid", nameEn: "Polaroid", nameAr: "بولارويد", priceFils: 3_000, active: true },
      { key: "vase", nameEn: "Glass vase", nameAr: "مزهرية زجاجية", priceFils: 16_000, active: false },
    ]);
  });

  it("leaves out a row that could not be sold as it stands", () => {
    const list = normaliseAddons([
      { key: "vase", nameEn: "Vase", nameAr: "مزهرية", priceFils: 15_000, active: true },
      { key: "vase", nameEn: "Second vase", nameAr: "مزهرية", priceFils: 1, active: true },
      { key: "Bad Key", nameEn: "Bad", nameAr: "سيئ", priceFils: 100, active: true },
      { key: "nameless", nameEn: " ", nameAr: "بلا اسم", priceFils: 100, active: true },
      { key: "dear", nameEn: "Too dear", nameAr: "غالٍ", priceFils: 1_000_001, active: true },
      { key: "half", nameEn: "Half fils", nameAr: "نصف", priceFils: 0.5, active: true },
      null,
    ]);
    expect(list.map((a) => a.key)).toEqual(["vase"]);
  });

  it("treats a missing switch as on, and a missing Arabic name as the English one", () => {
    expect(normaliseAddons([{ key: "card", nameEn: "Card", nameAr: null, priceFils: 0, active: null }])).toEqual([
      { key: "card", nameEn: "Card", nameAr: "Card", priceFils: 0, active: true },
    ]);
  });
});

describe("what a customer sees", () => {
  const list: StoreAddon[] = [
    { key: "vase", nameEn: "Glass vase", nameAr: "مزهرية زجاجية", priceFils: 16_000, active: true },
    { key: "teddy", nameEn: "Teddy Bear", nameAr: "دبدوب", priceFils: 9_000, active: false },
  ];

  it("offers only the add-ons that are switched on", () => {
    expect(addonsForSale(list).map((a) => a.key)).toEqual(["vase"]);
  });

  it("names an add-on from her list, in the reader's language", () => {
    expect(addonLabel("vase", list, "en", en.addonNames)).toBe("Glass vase");
    expect(addonLabel("vase", list, "ar", ar.addonNames)).toBe("مزهرية زجاجية");
  });

  it("names one she no longer offers from the dictionary, and anything else by its key", () => {
    expect(addonLabel("chocolates", list, "en", en.addonNames)).toBe("Chocolates");
    expect(addonLabel("chocolates", list, "ar", ar.addonNames)).toBe("شوكولاتة");
    expect(addonLabel("silk-ribbon", list, "ar", ar.addonNames)).toBe("silk-ribbon");
  });
});

describe("add-on keys", () => {
  it("are lower-case words joined by single hyphens", () => {
    for (const good of ["vase", "bento-cake", "card-2"]) expect(isAddonKey(good), good).toBe(true);
    for (const bad of ["", "Vase", "bento cake", "-vase", "vase-", "a--b", "x".repeat(41), 7]) {
      expect(isAddonKey(bad), String(bad)).toBe(false);
    }
  });
});
