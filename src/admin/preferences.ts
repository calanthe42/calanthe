/**
 * The admin's two personal preferences: language and theme.
 *
 * PURE — no cookies API, no DOM — so the rules are unit tested and shared by
 * the server (which reads the cookies to render <html lang dir data-theme>
 * before first paint) and the client (which writes them when the person
 * switches).
 *
 * They are cookies, not localStorage, precisely so the SERVER knows them: a
 * localStorage theme can only be applied after JavaScript runs, which is a
 * flash of the wrong colours on every page load. The storefront's own
 * language setting (lib/locale.tsx) is separate and untouched.
 */

export const LOCALE_COOKIE = "calanthe-admin-locale";
export const THEME_COOKIE = "calanthe-admin-theme";

/** One year. A preference should outlive a session, not a browser. */
export const PREFERENCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const ADMIN_LOCALES = ["en", "ar"] as const;
export const ADMIN_THEMES = ["light", "dark", "system"] as const;

export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export type AdminTheme = (typeof ADMIN_THEMES)[number];
export type Direction = "ltr" | "rtl";

/** Anything unrecognised is English — never a crash, never an empty page. */
export function parseLocale(value: string | null | undefined): AdminLocale {
  return value === "ar" ? "ar" : "en";
}

/** Anything unrecognised follows the device — the first-visit behaviour. */
export function parseTheme(value: string | null | undefined): AdminTheme {
  return value === "light" || value === "dark" ? value : "system";
}

export function directionFor(locale: AdminLocale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * The Set-Cookie string a client writes.
 *
 * Scoped to /admin so the storefront never receives it, and SameSite=Lax
 * because it carries no authority — it only chooses colours and words.
 */
export function preferenceCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; Path=/admin; Max-Age=${PREFERENCE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
