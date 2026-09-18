import { describe, expect, it } from "vitest";
import {
  LOCALE_COOKIE,
  directionFor,
  parseLocale,
  parseTheme,
  preferenceCookie,
} from "@admin/preferences";
import { ar } from "./ar";
import { en } from "./en";
import { createTranslator, humanize, interpolate } from "./translate";

type Tree = { [key: string]: unknown };

const isPlural = (node: unknown): node is Record<string, string> =>
  typeof node === "object" && node !== null && "one" in node && "other" in node;

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();

/** Every leaf path with its value. Plural objects are leaves. */
function leaves(tree: Tree, prefix = ""): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || isPlural(value)) return [[path, value] as [string, unknown]];
    return leaves(value as Tree, path);
  });
}

describe("dictionaries", () => {
  const english = new Map(leaves(en as unknown as Tree));
  const arabic = new Map(leaves(ar as unknown as Tree));

  it("Arabic has exactly the English keys — nothing missing, nothing extra", () => {
    expect([...arabic.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("no translation is empty", () => {
    for (const [path, value] of arabic) {
      const texts = typeof value === "string" ? [value] : Object.values(value as Record<string, string>);
      for (const text of texts) expect(text.trim(), path).not.toBe("");
    }
  });

  it("Arabic uses only placeholders the English message provides", () => {
    for (const [path, englishValue] of english) {
      const arabicValue = arabic.get(path);
      const allowed = new Set(
        typeof englishValue === "string"
          ? placeholders(englishValue)
          : [...Object.values(englishValue as Record<string, string>).flatMap(placeholders), "count"],
      );
      const texts =
        typeof arabicValue === "string" ? [arabicValue] : Object.values(arabicValue as Record<string, string>);
      for (const text of texts) {
        for (const name of placeholders(text)) expect(allowed.has(name), `${path}: {${name}}`).toBe(true);
      }
      /* A plain string must keep every placeholder, or a name silently vanishes. */
      if (typeof englishValue === "string" && typeof arabicValue === "string") {
        expect(placeholders(arabicValue), path).toEqual(placeholders(englishValue));
      }
    }
  });

  it("every plural message has at least `one` and `other`", () => {
    for (const [path, value] of [...english, ...arabic]) {
      if (typeof value === "string") continue;
      expect(value, path).toHaveProperty("one");
      expect(value, path).toHaveProperty("other");
    }
  });
});

describe("translator", () => {
  const english = createTranslator("en", en);
  const arabic = createTranslator("ar", ar);

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(interpolate("Hello {name}", { name: "Layla" })).toBe("Hello Layla");
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
    expect(english.t("orders.detail.title", { number: "CAL-1042" })).toBe("Order CAL-1042");
  });

  it("chooses English plural forms", () => {
    expect(english.plural("orders.count", 1)).toBe("1 order");
    expect(english.plural("orders.count", 2)).toBe("2 orders");
  });

  it("chooses all six Arabic plural forms", () => {
    expect(arabic.plural("orders.count", 0)).toBe("لا توجد طلبات");
    expect(arabic.plural("orders.count", 1)).toBe("طلب واحد");
    expect(arabic.plural("orders.count", 2)).toBe("طلبان");
    expect(arabic.plural("orders.count", 3)).toBe("3 طلبات");
    expect(arabic.plural("orders.count", 11)).toBe("11 طلبًا");
    expect(arabic.plural("orders.count", 100)).toBe("100 طلب");
  });

  it("shows stored values in the reader's words, humanising anything unknown", () => {
    expect(english.label("fulfilment", "OUT_FOR_DELIVERY")).toBe("Out for delivery");
    expect(arabic.label("fulfilment", "OUT_FOR_DELIVERY")).toBe("خرج للتوصيل");
    expect(arabic.label("emirate", "dubai")).toBe("دبي");
    expect(english.label("fulfilment", "ON_HOLD")).toBe("On hold");
    expect(humanize("large-order")).toBe("Large order");
    expect(english.label("payment", null)).toBe("");
  });

  it("formats money as AED with Western digits in both languages", () => {
    expect(english.money(123_450)).toBe("AED 1,234.50");
    expect(arabic.money(48_000)).toBe("AED 480");
  });

  it("formats dates in Dubai time with Western digits", () => {
    /* 21:30 UTC on the 10th is the 11th in Dubai. */
    expect(english.date("2026-09-10T21:30:00.000Z", "short")).toMatch(/11/);
    expect(arabic.date("2026-09-10T21:30:00.000Z", "long")).toMatch(/11/);
    expect(arabic.date("2026-09-10T21:30:00.000Z", "long")).not.toMatch(/[٠-٩]/);
    expect(english.date(null)).toBe("—");
    expect(english.date("not a date")).toBe("—");
  });

  it("resolves a server action's code in the reader's language, with a fallback", () => {
    expect(arabic.resolve("actions.product.saved", undefined, "Changes saved.")).toBe("تم حفظ التغييرات.");
    expect(arabic.resolve("actions.product.ordered", { count: 2 }, "fallback")).toContain("طلبين");
    expect(arabic.resolve("actions.validation.amountFormat", { label: "Price" }, "fallback")).toContain("السعر");
    expect(arabic.resolve(undefined, undefined, "English detail")).toBe("English detail");
    expect(arabic.resolve("actions.nope", undefined, "English detail")).toBe("English detail");
  });

  it("returns the key itself rather than crashing on a missing message", () => {
    expect(english.t("nav.nope" as never)).toBe("nav.nope");
  });
});

describe("preferences", () => {
  it("parses language and theme, defaulting safely", () => {
    expect(parseLocale("ar")).toBe("ar");
    expect(parseLocale("fr")).toBe("en");
    expect(parseLocale(undefined)).toBe("en");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("purple")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
  });

  it("maps language to reading direction", () => {
    expect(directionFor("ar")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
  });

  it("scopes the cookie to the admin and keeps it for a year", () => {
    const cookie = preferenceCookie(LOCALE_COOKIE, "ar");
    expect(cookie).toContain(`${LOCALE_COOKIE}=ar`);
    expect(cookie).toContain("Path=/admin");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=31536000");
  });
});
