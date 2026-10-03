/**
 * The storefront dictionary, checked mechanically.
 *
 * WHY THIS EXISTS. A native Arabic reader went through the live site and
 * found errors. Two different faults were behind that, and only one of them
 * was a translation problem:
 *
 *   1. Words written into a component in English, so no dictionary entry
 *      existed and the Arabic page showed English. The whole checkout was
 *      like this — "Checkout", "Delivery day", "Subtotal", "Cash on
 *      delivery" — on the page that takes the money.
 *   2. Arabic that was present but wrong: a transliteration where a real
 *      word exists, an English plural rule applied to a language with a
 *      dual.
 *
 * `ar: typeof en` already makes a *missing* key a compile error. What it
 * cannot see is a key whose Arabic is the English text copied across, an
 * Arabic string that lost its `{token}`, or a plural that only has the two
 * forms English needs. Those are what this covers, so the same class of
 * fault cannot come back quietly.
 */
import { describe, expect, it } from "vitest";
import { ar, en } from "./dictionary";
import { plural, type PluralForms } from "./plural";

type Tree = { [key: string]: unknown };

const ARABIC_SCRIPT = /[؀-ۿ]/;
const LATIN_WORD = /[A-Za-z]{2,}/;
const TOKEN = /\{(\w+)\}/g;

/*
 * Words that stay in Latin script inside Arabic copy, on purpose.
 *
 * The currency code is the important one: the admin dictionary already
 * renders every amount as "AED 480" in Arabic (see admin/i18n/i18n.test.ts),
 * so a price written any other way on the storefront would be the odd one
 * out. Then come names — a brand is not translated, and neither is the app
 * someone is being asked to open.
 *
 * `kalos` and `anthos` are there for a different reason: the About page
 * explains that Calanthe is named after a Greek orchid, and those two words
 * ARE the subject of the sentence. Translating them would delete the point
 * of the paragraph; only the gloss after the dash changes.
 */
const KEPT_IN_LATIN = /\b(AED|WhatsApp|Instagram|Calanthe|CALANTHE|kalos|anthos|Apple Pay|Google Pay|Stripe)\b/g;

const isPluralForms = (node: unknown): node is PluralForms =>
  typeof node === "object" && node !== null && "other" in node;

const tokens = (text: string): string[] =>
  [...text.matchAll(TOKEN)].map((m) => m[1] ?? "").sort();

/** Every leaf path with its value. A set of plural forms is one leaf. */
function leaves(tree: Tree, prefix = ""): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || isPluralForms(value)) {
      return [[path, value] as [string, unknown]];
    }
    return leaves(value as Tree, path);
  });
}

const texts = (value: unknown): string[] =>
  typeof value === "string" ? [value] : Object.values(value as Record<string, string>);

/*
 * A language switcher names each language in that language: the English
 * option reads "English" on the Arabic site, which is the point of it. These
 * are the only entries that are meant to match across the two dictionaries.
 */
const NAMES_ITS_OWN_LANGUAGE = /^language\./;

/*
 * Some strings are the same in both languages because they are not prose.
 *
 * A phone number written the way the UAE writes it has no words in it at
 * all, so it is detected rather than listed. An email example does contain
 * letters, and there is no way to tell one from a sentence mechanically, so
 * those few are named.
 */
const NOT_PROSE = new Set(["checkout.emailPlaceholder"]);

/** No letter in any script: a number, a symbol, a time range. */
const hasNoWords = (value: unknown): boolean =>
  texts(value).every((text) => !/\p{L}/u.test(text));

const isProse = (path: string, englishValue: unknown): boolean =>
  !NAMES_ITS_OWN_LANGUAGE.test(path) && !NOT_PROSE.has(path) && !hasNoWords(englishValue);

describe("the storefront dictionary", () => {
  const english = new Map(leaves(en as unknown as Tree));
  const arabic = new Map(leaves(ar as unknown as Tree));

  it("has an Arabic entry for every English one, and no orphans", () => {
    /* `ar: typeof en` covers the typed keys. The maps that are widened to
       Record<string, string> — occasion names, flower names, emirates — are
       not covered by it, and are exactly where a new row gets forgotten. */
    expect([...arabic.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("has no empty Arabic", () => {
    for (const [path, value] of arabic) {
      for (const text of texts(value)) expect(text.trim(), path).not.toBe("");
    }
  });

  it("is actually in Arabic", () => {
    for (const [path, value] of arabic) {
      if (!isProse(path, english.get(path))) continue;
      for (const text of texts(value)) {
        expect(ARABIC_SCRIPT.test(text), `${path}: ${text}`).toBe(true);
      }
    }
  });

  it("never leaves the English text standing in for a translation", () => {
    for (const [path, englishValue] of english) {
      if (!isProse(path, englishValue)) continue;
      const arabicValue = arabic.get(path);
      expect(texts(arabicValue), path).not.toEqual(texts(englishValue));
    }
  });

  it("has no English words loose in an Arabic sentence", () => {
    for (const [path, value] of arabic) {
      if (!isProse(path, english.get(path))) continue;
      for (const text of texts(value)) {
        /* A {token} is replaced at runtime, so its Latin letters are not
           Latin text in the sentence; nor are the names above. */
        const prose = text.replace(TOKEN, "").replace(KEPT_IN_LATIN, "");
        expect(LATIN_WORD.test(prose), `${path}: ${text}`).toBe(false);
      }
    }
  });

  it("keeps every placeholder the English has, so no value vanishes", () => {
    for (const [path, englishValue] of english) {
      const arabicValue = arabic.get(path);
      if (typeof englishValue === "string" && typeof arabicValue === "string") {
        expect(tokens(arabicValue), path).toEqual(tokens(englishValue));
        continue;
      }
      /* Plural forms may legitimately drop {n}: Arabic names small counts in
         words ("باقة واحدة"), so the number is already in the sentence. What
         must not happen is a token the English never provided. */
      const allowed = new Set(texts(englishValue).flatMap(tokens));
      for (const text of texts(arabicValue)) {
        for (const name of tokens(text)) {
          expect(allowed.has(name), `${path}: {${name}}`).toBe(true);
        }
      }
    }
  });

  it("gives every countable phrase all the forms Arabic selects", () => {
    /* Arabic picks from one/two/few/many/other for a cardinal. A phrase that
       only has English's one/other will read "2 باقات" where the dual
       "باقتان" belongs — which is what a native reader notices first. */
    const needed = new Set(
      [1, 2, 3, 11, 100].map((n) => new Intl.PluralRules("ar").select(n)),
    );
    for (const [path, value] of arabic) {
      if (typeof value === "string") continue;
      for (const form of needed) {
        expect(value as Record<string, unknown>, `${path}.${form}`).toHaveProperty(form);
      }
    }
  });
});

describe("counting in Arabic", () => {
  it("uses the dual for two, and the right plural above it", () => {
    const forms = ar.checkout.itemCount;
    expect(plural("ar", forms, 1)).toBe("باقة واحدة");
    expect(plural("ar", forms, 2)).toBe("باقتان");
    expect(plural("ar", forms, 3)).toBe("3 باقات");
    expect(plural("ar", forms, 11)).toBe("11 باقة");
    expect(plural("ar", forms, 100)).toBe("100 باقة");
  });

  it("keeps English to its two cases", () => {
    const forms = en.checkout.itemCount;
    expect(plural("en", forms, 1)).toBe("1 arrangement");
    expect(plural("en", forms, 2)).toBe("2 arrangements");
  });

  it("falls back to `other` rather than rendering nothing", () => {
    expect(plural("ar", { other: "{n} عنصرًا" }, 2)).toBe("2 عنصرًا");
  });
});
