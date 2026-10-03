import { describe, expect, it } from "vitest";
import { parseLegal } from "./parse";
import { privacyAr, privacyEn } from "./privacy";
import { refundsAr, refundsEn } from "./refunds";
import { termsAr, termsEn } from "./terms";

const DOCS = {
  terms: { en: termsEn, ar: termsAr, sections: 10 },
  privacy: { en: privacyEn, ar: privacyAr, sections: 14 },
  refunds: { en: refundsEn, ar: refundsAr, sections: 11 },
} as const;

describe.each(Object.entries(DOCS))("%s", (_name, doc) => {
  it("parses into a title and every numbered section, in both languages", () => {
    for (const source of [doc.en, doc.ar]) {
      const parsed = parseLegal(source);
      expect(parsed.title).not.toBe("");
      expect(parsed.sections).toHaveLength(doc.sections);
      parsed.sections.forEach((s, i) => {
        expect(s.heading.startsWith(`${i + 1}.`)).toBe(true);
        expect(s.body.length).toBeGreaterThan(0);
      });
    }
  });

  it("keeps the Arabic to the site's spelling and wording", () => {
    /* كالانثي, never كلانثي; flowers are نضِرة, never the food word طازج. */
    expect(doc.ar).not.toMatch(/كلانثي|طازج/);
    expect(doc.ar).toMatch(/كالانثي/);
  });
});
