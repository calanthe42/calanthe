"use client";

import { useLocale } from "@/lib/locale";
import { cn } from "@/lib/cn";

type LanguageToggleProps = {
  tone?: "cream" | "olive";
  /** `full` names both languages — for the menu, where there is room. */
  size?: "compact" | "full";
  className?: string;
};

/**
 * English · العربية
 *
 * TWO WORDS AND A RULE BETWEEN THEM — no box, no fill, no chip.
 *
 * The previous control was a bordered segmented box with a filled active
 * half. Measured against the rest of the header it was the heaviest object
 * on the bar: every neighbour is a 22px line icon or tracked Cinzel at 12px,
 * and a bordered container with a solid fill among them reads as a form
 * control that wandered out of a checkout page. Luxury navigation states the
 * current language; it does not package it.
 *
 * So the active language is the one at full strength, the other is dimmed,
 * and a hairline separates them — the same hairline vocabulary the rest of
 * the site already uses for dividers. It is now lighter than anything else
 * in the header, which is correct: it is the least important control there.
 *
 * Tap targets stay at 44px through vertical padding, so losing the visual
 * weight costs nothing in usability. Switching writes a cookie and refreshes
 * so the page returns in the chosen language (see lib/locale.tsx).
 */
export function LanguageToggle({
  tone = "olive",
  size = "compact",
  className,
}: LanguageToggleProps) {
  const { locale, setLocale, t, switching } = useLocale();
  const cream = tone === "cream";

  const option =
    "inline-flex min-h-11 items-center px-1.5 font-brand text-[0.6875rem] font-medium uppercase tracking-brand transition-opacity duration-200 ease-bloom";
  const activeTone = cream ? "text-cream" : "text-olive";
  const idleTone = cream
    ? "text-cream/50 hover:text-cream/80"
    : "text-ink-muted hover:text-olive";

  return (
    <div
      role="group"
      aria-label={t.language.label}
      aria-busy={switching}
      className={cn("inline-flex items-center", switching && "opacity-60", className)}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        aria-label={t.language.toEnglish}
        className={cn(option, locale === "en" ? activeTone : idleTone)}
      >
        {size === "full" ? t.language.english : "EN"}
      </button>

      {/* A divider, not a border around anything. */}
      <span
        aria-hidden
        className={cn("h-3 w-px", cream ? "bg-cream/30" : "bg-hairline")}
      />

      <button
        type="button"
        onClick={() => setLocale("ar")}
        aria-pressed={locale === "ar"}
        aria-label={t.language.toArabic}
        lang="ar"
        className={cn(
          option,
          /* Arabic sits optically small beside tracked-out Latin caps, and
             letterspacing breaks its joins — its own size, no tracking. */
          "font-sans text-[0.8125rem] tracking-normal",
          locale === "ar" ? activeTone : idleTone,
        )}
      >
        {size === "full" ? t.language.arabic : "ع"}
      </button>
    </div>
  );
}
