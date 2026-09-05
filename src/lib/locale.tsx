"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Locale = "en" | "ar";

const STORAGE_KEY = "calanthe.locale";

type LocaleValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: "ltr" | "rtl";
};

const LocaleContext = createContext<LocaleValue>({
  locale: "en",
  setLocale: () => {},
  dir: "ltr",
});

/**
 * Locale state for the language toggle.
 *
 * Deliberately client-side and cookie-free for now: it sets `lang` and
 * `dir` on <html> so Arabic mirrors the entire layout, and remembers
 * the choice. It does NOT yet swap page copy — the Arabic translations
 * are a content task that needs the client's own wording, not machine
 * translation of a luxury brand's voice. When that copy arrives this
 * provider is the single place the dictionary plugs into.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ar" || saved === "en") setLocaleState(saved);
    } catch {
      /* private mode — fall back to English */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, dir: locale === "ar" ? "rtl" : "ltr" }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
