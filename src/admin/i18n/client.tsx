"use client";

import { createContext, useContext, useMemo } from "react";
import type { AdminLocale } from "@admin/preferences";
import { createTranslator, type Messages, type Translator } from "./translate";

/**
 * The translator for Client Components.
 *
 * The layout passes only the ACTIVE language's dictionary, as plain data, so
 * the browser never downloads the other language. Both sides use the same
 * `createTranslator`, so a label rendered on the server and the same label
 * rendered after a client update can never differ.
 */

const I18nContext = createContext<Translator | null>(null);

export function AdminI18nProvider({
  locale,
  messages,
  children,
}: {
  locale: AdminLocale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const translator = useMemo(() => createTranslator(locale, messages), [locale, messages]);
  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>;
}

export function useI18n(): Translator {
  const translator = useContext(I18nContext);
  if (!translator) {
    throw new Error("useI18n must be used inside AdminI18nProvider (the admin root layout).");
  }
  return translator;
}
