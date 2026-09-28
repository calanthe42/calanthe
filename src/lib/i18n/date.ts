/**
 * Dates on the storefront, in the reader's language.
 *
 * WHY THIS EXISTS. Dates were formatted inline with
 * `toLocaleDateString("en-AE", …)` — the locale hard-coded at each call site.
 * So an Arabic customer's own order history read "12 October 2026" and
 * "out for delivery": her account page, in English, describing her own
 * purchases.
 *
 * WESTERN DIGITS, DUBAI TIME. `ar-AE` would ordinarily render Arabic-Indic
 * digits (١٢), but every amount on this site is written "AED 480" with
 * Western digits, in both languages — the admin's translator settles that
 * already, and its tests assert it. Mixed numbering between a date and the
 * total beside it would read as an oversight rather than a choice, so the
 * numbering system is pinned. The timezone is pinned for a different reason:
 * an order placed at 01:00 in Dubai must not show as the previous day
 * because the server happens to be elsewhere.
 */
import type { Locale } from "@/lib/i18n/dictionary";

const TIMEZONE = "Asia/Dubai";

function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-AE-u-nu-latn" : "en-AE";
}

/** "12 October 2026" / "12 أكتوبر 2026". */
export function formatDate(locale: Locale, value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(date);
}

/** "Monday 12 October" / "الاثنين 12 أكتوبر" — a delivery day, where the
 *  weekday matters more than the year. */
export function formatDeliveryDate(locale: Locale, value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIMEZONE,
  }).format(date);
}
