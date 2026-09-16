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
 * English / العربية.
 *
 * A SEGMENTED CONTROL, NOT A PILL OF INITIALS. The old control put "EN" and a
 * lone "ع" in a rounded outline: two glyphs of different scripts, neither
 * obviously current, in a shape the rest of the site never uses. This reads
 * as one control with two halves and a filled active half, so which language
 * you are in is visible without reading — and in the menu, where there is
 * room, each language is named in its own script, which is the only spelling
 * a reader of that language can be sure of.
 *
 * Switching writes a cookie and refreshes, so the page comes back in the
 * chosen language rather than merely changing direction (see lib/locale.tsx).
 */
export function LanguageToggle({
  tone = "olive",
  size = "compact",
  className,
}: LanguageToggleProps) {
  const { locale, setLocale, t, switching } = useLocale();
  const cream = tone === "cream";

  const option =
    "relative flex h-9 items-center justify-center rounded-[3px] px-3 font-brand text-[0.6875rem] font-medium uppercase tracking-brand transition-colors duration-300 ease-bloom";
  /* On the photograph a solid cream fill reads as a sticker; a lit facet of
     the same glass the hero buttons use keeps it part of the image. On cream
     surfaces the olive fill is right — there is nothing behind it to respect. */
  const active = cream
    ? "bg-cream/15 text-cream shadow-[inset_0_0_0_1px_rgba(228,220,197,0.35)]"
    : "bg-olive text-cream";
  const idle = cream ? "text-cream/60 hover:text-cream" : "text-sage hover:text-olive";

  return (
    <div
      role="group"
      aria-label={t.language.label}
      aria-busy={switching}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm border p-0.5",
        cream ? "border-cream/25 bg-cream/[0.06]" : "border-hairline bg-cream/40",
        switching && "opacity-70",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        aria-label={t.language.toEnglish}
        className={cn(option, locale === "en" ? active : idle)}
      >
        {size === "full" ? t.language.english : "EN"}
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        aria-pressed={locale === "ar"}
        aria-label={t.language.toArabic}
        lang="ar"
        className={cn(
          option,
          /* Arabic sits optically small next to tracked-out Latin caps, and
             letterspacing breaks its joins — so it gets its own size and no
             tracking. */
          "font-sans text-[0.8125rem] tracking-normal",
          locale === "ar" ? active : idle,
        )}
      >
        {size === "full" ? t.language.arabic : "ع"}
      </button>
    </div>
  );
}
