"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/i18n/date";
import { useLocale } from "@/lib/locale";
import { fieldClasses } from "./form-classes";

/**
 * A date field that reads in the page's language.
 *
 * WHY THIS EXISTS. A bare `<input type="date">` writes its own face — "mm/dd/
 * yyyy" — in the language of the BROWSER, not of the page. On the Arabic
 * site that put an English, left-to-right "mm/dd/yyyy" in the middle of an
 * Arabic form, and no attribute or stylesheet can change it.
 *
 * WHAT IT DOES. The real date input is still there, and still does the work:
 * it is the thing that is focused, validated, submitted with the form and —
 * on a phone — opens the system's own date picker, which no custom calendar
 * matches for ease. It is simply made transparent and laid over a face this
 * component draws: "Choose a date" until one is chosen, then the date written
 * out in the page's language ("12 October 2026" / "12 أكتوبر 2026").
 *
 * The focus ring and the error border are drawn on the face from the input's
 * own state (`peer-…`), so keyboard users see where they are.
 */
export function DateField({
  className,
  tone = "light",
  invalid,
  value,
  defaultValue,
  onChange,
  ...rest
}: Omit<ComponentPropsWithoutRef<"input">, "type" | "value" | "defaultValue"> & {
  /** "dark": the cream-on-olive fields of the Events and Membership forms. */
  tone?: "light" | "dark";
  invalid?: boolean;
  value?: string;
  defaultValue?: string;
}) {
  const { locale, t } = useLocale();
  const ref = useRef<HTMLInputElement>(null);
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;

  /* `form.reset()` empties the input without an event React hears. */
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onReset = () => setInner(defaultValue ?? "");
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  /* Noon in the UAE: the same calendar day in every timezone that reads it. */
  const written = /^\d{4}-\d{2}-\d{2}$/.test(current) ? formatDate(locale, `${current}T12:00:00+04:00`) : "";

  return (
    <div className="relative">
      <input
        ref={ref}
        type="date"
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          setInner(event.target.value);
          onChange?.(event);
        }}
        /* A desktop browser opens its calendar only from its own small icon;
           the whole field should open it. Phones open it on any tap. */
        onClick={(event) => {
          try {
            event.currentTarget.showPicker?.();
          } catch {
            /* Not allowed in this context (e.g. inside an iframe): the field still works by keyboard. */
          }
        }}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        {...rest}
      />
      <div
        aria-hidden
        className={cn(
          fieldClasses,
          "flex min-h-12 items-center justify-between gap-3",
          "peer-focus-visible:border-olive peer-focus-visible:shadow-[0_0_0_1px_var(--color-olive)]",
          "peer-aria-[invalid=true]:border-burnt-orange",
          tone === "dark" &&
            "border-cream/25 bg-cream/[0.06] text-cream peer-focus-visible:border-cream peer-focus-visible:shadow-none",
          className,
        )}
      >
        <span className={cn(!written && (tone === "dark" ? "text-cream/40" : "text-sage/70"))}>
          {written || t.ui.chooseDate}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={cn("h-[18px] w-[18px] shrink-0", tone === "dark" ? "text-cream/60" : "text-sage")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6.5h16v13H4zM4 10.5h16M8 4v4M16 4v4" />
        </svg>
      </div>
    </div>
  );
}
