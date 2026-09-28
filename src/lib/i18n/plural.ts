/**
 * Counting things in Arabic.
 *
 * WHY THIS EXISTS. English has two cases, one and not-one, so a ternary is
 * enough: `n === 1 ? "arrangement" : "arrangements"`. That ternary was used
 * for the Arabic too, which produces "2 باقات" — and Arabic has a dual. Two
 * bouquets is باقتان, not باقات, and a native reader sees it immediately, in
 * the same way an English reader sees "2 arrangement".
 *
 * Arabic distinguishes five cases for a cardinal number:
 *
 *   one    1          باقة واحدة
 *   two    2          باقتان
 *   few    3–10       3 باقات
 *   many   11–99      11 باقة
 *   other  100, 101…  100 باقة
 *
 * `Intl.PluralRules` knows all of this per locale, so nothing here hard-codes
 * those ranges. English selects only `one` and `other`; Arabic selects from
 * all five, and `other` is the fallback for any case a dictionary leaves out.
 */
import type { Locale } from "@/lib/i18n/dictionary";

/** The cases a dictionary may supply. `other` is required as the fallback. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

const rules: Partial<Record<Locale, Intl.PluralRules>> = {};

function rulesFor(locale: Locale): Intl.PluralRules {
  rules[locale] ??= new Intl.PluralRules(locale === "ar" ? "ar" : "en");
  return rules[locale]!;
}

/**
 * The right form for `n`, with `{n}` replaced by the number.
 *
 * Arabic's `one` and `two` forms usually name the count in words ("باقة
 * واحدة", "باقتان") and so contain no `{n}` at all — the replace is then
 * simply a no-op, which is why the forms carry the token rather than the
 * caller concatenating a digit in front.
 */
export function plural(locale: Locale, forms: PluralForms, n: number): string {
  const form = forms[rulesFor(locale).select(n)] ?? forms.other;
  return form.replace("{n}", String(n));
}
