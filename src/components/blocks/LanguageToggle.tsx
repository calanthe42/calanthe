"use client";

import { useLocale } from "@/lib/locale";
import { cn } from "@/lib/cn";

type LanguageToggleProps = {
  tone?: "cream" | "olive";
  className?: string;
};

/**
 * EN / ع — a single hairline-divided pair rather than a dropdown, so
 * the current language is always visible and switching is one tap.
 * Sets the document's `lang` and `dir`, so choosing Arabic mirrors the
 * whole layout (see `LocaleProvider`).
 */
export function LanguageToggle({ tone = "olive", className }: LanguageToggleProps) {
  const { locale, setLocale } = useLocale();

  /* h-11, not h-7: the pill around these two buttons was already 44px
     tall, but the buttons themselves were 28px, so the top and bottom
     8px of the control did nothing when tapped. Filling the container
     costs no pixels on screen and makes the target the size it looks. */
  const base =
    "flex h-11 min-w-7 items-center justify-center px-2 font-brand text-[0.6875rem] font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom";
  const on = tone === "cream" ? "text-cream" : "text-olive";
  const off = tone === "cream" ? "text-cream/45 hover:text-cream/80" : "text-sage hover:text-olive";

  return (
    <div
      className={cn(
        "inline-flex h-11 items-center rounded-full border px-1",
        tone === "cream" ? "border-cream/25" : "border-hairline",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        aria-label="Switch to English"
        className={cn(base, locale === "en" ? on : off)}
      >
        EN
      </button>
      <span
        aria-hidden
        className={cn("h-3 w-px", tone === "cream" ? "bg-cream/25" : "bg-hairline")}
      />
      <button
        type="button"
        onClick={() => setLocale("ar")}
        aria-pressed={locale === "ar"}
        aria-label="التبديل إلى العربية"
        lang="ar"
        className={cn(base, "text-[0.875rem]", locale === "ar" ? on : off)}
      >
        ع
      </button>
    </div>
  );
}
