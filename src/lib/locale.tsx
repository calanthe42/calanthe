"use client";

import { createContext, useCallback, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dictionaryFor, type Dictionary, type Locale } from "@/lib/i18n/dictionary";

export type { Locale };

const COOKIE = "calanthe-locale";
/** A year: the choice is the visitor's, and it should outlive the session. */
const MAX_AGE = 60 * 60 * 24 * 365;

type LocaleValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: "ltr" | "rtl";
  /** The dictionary for this locale — the same object the server rendered. */
  t: Dictionary;
  switching: boolean;
};

const LocaleContext = createContext<LocaleValue>({
  locale: "en",
  setLocale: () => {},
  dir: "ltr",
  t: dictionaryFor("en"),
  switching: false,
});

/**
 * Language state, seeded by the server.
 *
 * WHAT CHANGED AND WHY. This used to keep the choice in `localStorage` and
 * set `lang`/`dir` in an effect. The server never saw it, so Arabic rendered
 * as English and then flipped direction — the control looked like it worked
 * and changed nothing anyone could read. The choice now lives in a cookie
 * that travels with the request: the server renders the correct language and
 * direction in the first byte, `router.refresh()` re-renders the tree in the
 * new language without a full page load, and a reload keeps it.
 */
export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const router = useRouter();
  const [switching, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === initialLocale) return;
      /* `lang`/`dir` are set here as well as on the server so the change is
         instant; the refresh below then re-renders every string. */
      const root = document.documentElement;
      root.lang = next;
      root.dir = next === "ar" ? "rtl" : "ltr";
      document.cookie = `${COOKIE}=${next}; path=/; max-age=${MAX_AGE}; samesite=lax`;
      startTransition(() => router.refresh());
    },
    [initialLocale, router],
  );

  return (
    <LocaleContext.Provider
      value={{
        locale: initialLocale,
        setLocale,
        dir: initialLocale === "ar" ? "rtl" : "ltr",
        t: dictionaryFor(initialLocale),
        switching,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** The dictionary alone, for components that only need strings. */
export function useT(): Dictionary {
  return useContext(LocaleContext).t;
}
