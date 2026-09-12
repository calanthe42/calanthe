"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@admin/i18n/client";
import type { MessageKey } from "@admin/i18n/translate";
import {
  LOCALE_COOKIE,
  THEME_COOKIE,
  directionFor,
  preferenceCookie,
  type AdminLocale,
  type AdminTheme,
} from "@admin/preferences";
import { Icon, type IconName } from "@admin/ui/icons";

/**
 * Language and theme switches.
 *
 * Native radio buttons underneath — arrow keys move between options, and a
 * screen reader announces "Dark, 2 of 3, selected" — drawn as a segmented
 * control.
 *
 * THEME applies instantly: the attribute on <html> changes and the CSS tokens
 * follow. No reload, no layout shift — only colours change.
 *
 * LANGUAGE needs the server: every label is rendered there. The cookie is set,
 * <html lang dir> flips at once so the layout mirrors immediately, and the
 * page re-renders in the new language.
 */

const SEGMENT =
  "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-1.5 text-xs leading-tight text-nav-ink-2 transition-colors duration-150 hover:text-nav-ink has-[:checked]:bg-nav-active has-[:checked]:font-medium has-[:checked]:text-nav-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-nav-ink lg:min-h-9";

const THEMES: readonly { value: AdminTheme; icon: IconName; label: MessageKey }[] = [
  { value: "light", icon: "sun", label: "theme.light" },
  { value: "dark", icon: "moon", label: "theme.dark" },
  { value: "system", icon: "monitor", label: "theme.system" },
];

export function ThemeSwitcher({ theme }: { theme: AdminTheme }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState<AdminTheme>(theme);
  const name = useId();

  function choose(value: AdminTheme) {
    document.cookie = preferenceCookie(THEME_COOKIE, value);
    document.documentElement.dataset.theme = value;
    setCurrent(value);
  }

  return (
    <fieldset className="min-w-0 px-3">
      <legend className="mb-1.5 text-xs text-nav-ink-2">{t("theme.label")}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-nav-hover p-1">
        {THEMES.map((option) => (
          <label key={option.value} className={SEGMENT}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={current === option.value}
              onChange={() => choose(option.value)}
              className="sr-only"
            />
            <Icon name={option.icon} className="h-4 w-4" />
            <span className="truncate">{t(option.label)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const LOCALES: readonly { value: AdminLocale; label: MessageKey }[] = [
  { value: "en", label: "language.en" },
  { value: "ar", label: "language.ar" },
];

export function LanguageSwitcher({ locale }: { locale: AdminLocale }) {
  const { t } = useI18n();
  const router = useRouter();
  const [current, setCurrent] = useState<AdminLocale>(locale);
  const [pending, startTransition] = useTransition();
  const name = useId();

  function choose(value: AdminLocale) {
    document.cookie = preferenceCookie(LOCALE_COOKIE, value);
    document.documentElement.lang = value;
    document.documentElement.dir = directionFor(value);
    setCurrent(value);
    startTransition(() => router.refresh());
  }

  return (
    <fieldset className="min-w-0 px-3" aria-busy={pending}>
      <legend className="mb-1.5 flex items-center gap-1.5 text-xs text-nav-ink-2">
        <Icon name="globe" className="h-3.5 w-3.5" />
        {t("language.label")}
      </legend>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-nav-hover p-1">
        {LOCALES.map((option) => (
          <label key={option.value} className={cn(SEGMENT, "text-[13px]")}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={current === option.value}
              onChange={() => choose(option.value)}
              className="sr-only"
            />
            {/* Each language's name in its own language, marked so a screen
                reader pronounces it correctly. */}
            <span lang={option.value}>{t(option.label)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
