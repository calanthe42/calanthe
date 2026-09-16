import { cookies } from "next/headers";
import { dictionaryFor, type Dictionary, type Locale } from "./dictionary";

/**
 * The chosen language, read on the server.
 *
 * A COOKIE, NOT `localStorage`. The previous implementation kept the choice
 * in `localStorage`, which the server cannot see: the page was always
 * rendered in English and only the `dir` attribute changed afterwards in the
 * browser. A cookie is sent with the request, so Arabic is rendered as Arabic
 * — no flash of the wrong language, and it survives a reload.
 */
export const LOCALE_COOKIE = "calanthe-locale";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get(LOCALE_COOKIE)?.value === "ar" ? "ar" : "en";
}

export async function getDictionary(): Promise<{
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Dictionary;
}> {
  const locale = await getLocale();
  return { locale, dir: locale === "ar" ? "rtl" : "ltr", t: dictionaryFor(locale) };
}
