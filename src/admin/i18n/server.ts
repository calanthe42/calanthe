import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  THEME_COOKIE,
  directionFor,
  parseLocale,
  parseTheme,
  type AdminLocale,
  type AdminTheme,
  type Direction,
} from "@admin/preferences";
import { ar } from "./ar";
import { en } from "./en";
import { createTranslator, type Messages, type Translator } from "./translate";

/**
 * Language and theme for the current request, read on the server.
 *
 * Server Components, server actions and generateMetadata all call this, so a
 * page title, a toast from a save, and the sidebar are in the same language.
 */

const DICTIONARIES: Record<AdminLocale, Messages> = { en, ar };

export type AdminPreferences = { locale: AdminLocale; dir: Direction; theme: AdminTheme };

export async function getAdminPreferences(): Promise<AdminPreferences> {
  const store = await cookies();
  const locale = parseLocale(store.get(LOCALE_COOKIE)?.value);
  return { locale, dir: directionFor(locale), theme: parseTheme(store.get(THEME_COOKIE)?.value) };
}

export function messagesFor(locale: AdminLocale): Messages {
  return DICTIONARIES[locale];
}

export async function getAdminI18n(): Promise<Translator> {
  const { locale } = await getAdminPreferences();
  return createTranslator(locale, DICTIONARIES[locale]);
}
