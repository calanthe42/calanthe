"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes, KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/locale";
import {
  DEFAULT_COUNTRY,
  PHONE_COUNTRIES,
  PRIORITY_ISO,
  countryByIso,
  flagOf,
  fromE164,
  toE164,
} from "@/lib/phone-countries";

/**
 * A PHONE NUMBER, THE WAY PEOPLE THINK OF ONE: their country, then their
 * number.
 *
 * The country sits first — flag and code, the UAE (+971) already chosen —
 * and the customer types only their own number, as they would say it. A
 * leading 0 ("050…") is dropped, spaces and dashes are ignored. Tapping the
 * country opens every country in the world, searchable by name (in English
 * or Arabic) or by code; the Gulf comes first.
 *
 * What the form receives is always the international form, "+971501234567":
 * through `onChange` for controlled forms, or as a hidden input named
 * `name` for forms that read FormData. The visible input has no name, so
 * the half-number is never what gets sent.
 *
 * Accessibility: the country button opens a listbox with its own search
 * field; arrows move, Enter chooses, Escape closes and returns focus. The
 * number is always written left to right, even on an Arabic page.
 */
type Props = {
  id: string;
  /** Controlled: the international number, "+971501234567" or "". */
  value?: string;
  onChange?: (international: string) => void;
  /** Uncontrolled: a hidden input of this name carries the international number. */
  name?: string;
  defaultValue?: string;
  /** The form's field style, applied to both the country button and the number. */
  fieldClassName: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue" | "name" | "id" | "type" | "placeholder">;

const PLACEHOLDERS: Record<string, string> = { AE: "50 123 4567", SA: "50 123 4567", GB: "7400 123456", US: "201 555 0123" };

export function PhoneField({
  id,
  value,
  onChange,
  name,
  defaultValue,
  fieldClassName,
  required,
  autoComplete = "tel-national",
  placeholder,
  ...rest
}: Props) {
  const { locale } = useLocale();
  const initial = useMemo(() => fromE164(value ?? defaultValue ?? ""), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [iso, setIso] = useState(initial.iso || DEFAULT_COUNTRY);
  const [national, setNational] = useState(initial.national);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  /* A controlled parent that clears or replaces the number (a prefill,
     a reset) is followed; typing never fights it because it round-trips. */
  useEffect(() => {
    if (value === undefined) return;
    if (value === toE164(iso, national)) return;
    const next = fromE164(value, iso);
    setIso(next.iso);
    setNational(next.national);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const names = useMemo(() => {
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([locale === "ar" ? "ar" : "en"], { type: "region" });
    } catch {
      display = null;
    }
    const english = (() => {
      try {
        return new Intl.DisplayNames(["en"], { type: "region" });
      } catch {
        return null;
      }
    })();
    return new Map(
      PHONE_COUNTRIES.map((c) => [c.iso, { local: display?.of(c.iso) ?? c.iso, en: english?.of(c.iso) ?? c.iso }]),
    );
  }, [locale]);

  const ordered = useMemo(() => {
    const priority = PRIORITY_ISO.map((p) => countryByIso(p));
    const rest = PHONE_COUNTRIES.filter((c) => !(PRIORITY_ISO as readonly string[]).includes(c.iso)).sort((a, b) =>
      (names.get(a.iso)?.local ?? a.iso).localeCompare(names.get(b.iso)?.local ?? b.iso, locale === "ar" ? "ar" : "en"),
    );
    return [...priority, ...rest];
  }, [names, locale]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return ordered;
    return ordered.filter((c) => {
      const n = names.get(c.iso);
      return (
        c.dial.startsWith(q) ||
        c.iso.toLowerCase() === q ||
        (n?.local ?? "").toLowerCase().includes(q) ||
        (n?.en ?? "").toLowerCase().includes(q)
      );
    });
  }, [query, ordered, names]);

  const emit = (nextIso: string, nextNational: string) => onChange?.(toE164(nextIso, nextNational));

  const choose = (nextIso: string) => {
    setIso(nextIso);
    setOpen(false);
    setQuery("");
    emit(nextIso, national);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  };

  /* Close on a click outside. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    requestAnimationFrame(() => searchRef.current?.focus());
    setActive(0);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onListKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = shown[active];
      if (pick) choose(pick.iso);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const country = countryByIso(iso);
  const countryName = names.get(iso)?.local ?? iso;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-2" dir="ltr">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={`${countryName} +${country.dial}`}
          onClick={() => setOpen((v) => !v)}
          className={cn(fieldClassName, "flex w-auto shrink-0 items-center gap-2 px-3")}
        >
          <span aria-hidden className="text-lg leading-none">
            {flagOf(iso)}
          </span>
          <span className="tabular-nums">+{country.dial}</span>
          <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 text-sage">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
        <input
          {...rest}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required={required}
          dir="ltr"
          value={national}
          placeholder={placeholder ?? PLACEHOLDERS[iso] ?? ""}
          onChange={(e) => {
            const typed = e.target.value;
            /* Someone pasting "+971 50…" or "00971…" is understood too. */
            if (/^\s*(\+|00)/.test(typed)) {
              const parsed = fromE164(typed.replace(/^\s*00/, "+"), iso);
              setIso(parsed.iso);
              setNational(parsed.national);
              emit(parsed.iso, parsed.national);
              return;
            }
            const clean = typed.replace(/[^\d\s\-()]/g, "").slice(0, 20);
            setNational(clean);
            emit(iso, clean);
          }}
          className={cn(fieldClassName, "min-w-0 flex-1")}
        />
      </div>
      {name ? <input type="hidden" name={name} value={toE164(iso, national)} /> : null}

      {open ? (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-sm border border-hairline bg-canvas shadow-[0_18px_44px_-18px_rgba(43,47,27,0.35)]">
          <div className="border-b border-hairline p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onListKey}
              aria-label={locale === "ar" ? "ابحثوا عن الدولة أو الرمز" : "Search country or code"}
              aria-controls={listId}
              aria-activedescendant={shown[active] ? `${listId}-${shown[active]!.iso}` : undefined}
              placeholder={locale === "ar" ? "ابحثوا عن الدولة أو الرمز" : "Search country or code"}
              className="w-full rounded-sm border border-hairline bg-cream/40 px-3 py-2.5 text-base text-olive placeholder:text-sage/70 focus:border-olive focus:outline-none"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={locale === "ar" ? "الدولة" : "Country"} className="max-h-72 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <li className="px-4 py-3 text-sm text-sage">{locale === "ar" ? "لا نتائج" : "No match"}</li>
            ) : (
              shown.map((c, i) => (
                <li
                  key={c.iso}
                  id={`${listId}-${c.iso}`}
                  role="option"
                  aria-selected={c.iso === iso}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(c.iso);
                  }}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 px-4 text-start text-base text-olive",
                    i === active && "bg-cream",
                    i === PRIORITY_ISO.length - 1 && !query && "border-b border-hairline",
                  )}
                >
                  <span aria-hidden className="text-lg leading-none">
                    {flagOf(c.iso)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{names.get(c.iso)?.local ?? c.iso}</span>
                  <span dir="ltr" className="tabular-nums text-sage">
                    +{c.dial}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
