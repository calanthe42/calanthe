"use client";

import { useEffect } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { useLocale, type Locale } from "@/lib/locale";

/**
 * Two small client pieces of the payment-link page.
 */

/**
 * The email's link carries `?lang=`. A visitor who has never chosen a
 * language on this site gets the one their florist wrote to them in; one who
 * HAS chosen keeps their choice — the page only renders this when there is no
 * language cookie yet. Setting it goes through the same setter as the
 * header's switch, so the cookie, `lang`/`dir` and the refresh all happen the
 * one way they already do.
 */
export function PayLocaleAdopter({ locale }: { locale: Locale }) {
  const { setLocale } = useLocale();
  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);
  return null;
}

/** "Print or save as PDF" — the browser's own print sheet does both. */
export function PayPrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClasses("secondary", "w-full sm:w-auto print:hidden")}
    >
      {label}
    </button>
  );
}
