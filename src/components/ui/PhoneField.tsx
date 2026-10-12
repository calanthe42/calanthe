"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/locale";
import { useScrollLock } from "@/lib/useScrollLock";
import {
  DEFAULT_COUNTRY,
  MAIN_FOR_DIAL,
  PHONE_COUNTRIES,
  PRIORITY_ISO,
  SEARCH_ALIASES,
  countryByIso,
  flagSrc,
  foldForSearch,
  formatNational,
  fromE164,
  lengthsFor,
  nationalDigits,
  toE164,
} from "@/lib/phone-countries";
import type { PhoneCountry } from "@/lib/phone-countries";

/**
 * A PHONE NUMBER, THE WAY PEOPLE THINK OF ONE: their country, then their
 * number.
 *
 * The country sits first — flag and code, the UAE (+971) already chosen —
 * and the customer types only their own number, as they would say it. A
 * leading 0 ("050…") is dropped, spaces and dashes are ignored, and on
 * leaving the field the number is grouped the way it is said ("50 123
 * 4567"). Where we know how long a country's numbers are (the Gulf, +1, the
 * UK, India) a digit too many is refused as it is typed.
 *
 * Tapping the country opens every country in the world, searchable by name
 * in English or Arabic, by what people call it ("UAE", "KSA") or by code;
 * the Gulf comes first. On a phone that list is a sheet from the bottom of
 * the screen, above everything (the WhatsApp button, the sticky total), and
 * the keyboard only comes up if the customer taps the search. On a larger
 * screen it is a dropdown under the field.
 *
 * What the form receives is always the international form, "+971501234567":
 * through `onChange` for controlled forms, or as a hidden input named
 * `name` for forms that read FormData. The visible input has no name, so
 * the half-number is never what gets sent.
 *
 * Accessibility: the list is a listbox driven from its search field; arrows
 * move, Enter chooses, Escape closes and returns focus. The sheet is a modal
 * dialog that holds focus while open. The number is always written left to
 * right, even on an Arabic page.
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
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "defaultValue" | "name" | "id" | "type" | "placeholder"
>;

const PLACEHOLDERS: Record<string, string> = {
  AE: "50 123 4567",
  SA: "50 123 4567",
  KW: "5012 3456",
  QA: "3312 3456",
  BH: "3600 1234",
  OM: "9212 3456",
  GB: "7400 123456",
  US: "201 555 0123",
  IN: "98765 43210",
};

/** The sheet's slide, matched to the cart drawer's. */
const SHEET_MS = 450;

const COPY = {
  en: {
    title: "Country code",
    search: "Search country or code",
    clear: "Clear search",
    close: "Close",
    none: "No country matches that.",
    list: "Country",
  },
  ar: {
    title: "رمز الدولة",
    search: "ابحثوا عن الدولة أو الرمز",
    clear: "مسح البحث",
    close: "إغلاق",
    none: "لا توجد دولة بهذا الاسم.",
    list: "الدولة",
  },
} as const;

function Flag({ iso, eager = false }: { iso: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagSrc(iso)}
      alt=""
      width={21}
      height={14}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className="h-3.5 w-[21px] shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(43,47,27,0.14)]"
    />
  );
}

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
  const copy = COPY[locale === "ar" ? "ar" : "en"];
  const initial = useMemo(() => fromE164(value ?? defaultValue ?? ""), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [iso, setIso] = useState(initial.iso || DEFAULT_COUNTRY);
  const [national, setNational] = useState(() =>
    formatNational(initial.iso || DEFAULT_COUNTRY, initial.national),
  );
  /* `open` mounts the list; `shown` drives the sheet's slide, one frame later. */
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [mode, setMode] = useState<"popover" | "sheet">("popover");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const listId = useId();
  const titleId = useId();

  useScrollLock(open && mode === "sheet");

  /* A controlled parent that clears or replaces the number (a prefill,
     a reset) is followed; typing never fights it because it round-trips. */
  useEffect(() => {
    if (value === undefined) return;
    if (value === toE164(iso, national)) return;
    const next = fromE164(value, iso);
    setIso(next.iso);
    setNational(formatNational(next.iso, next.national));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  /* Each country's name in the reader's language, and everything it can be found by. */
  const names = useMemo(() => {
    const make = (lang: string) => {
      try {
        return new Intl.DisplayNames([lang], { type: "region" });
      } catch {
        return null;
      }
    };
    const display = make(locale === "ar" ? "ar" : "en");
    const english = make("en");
    const arabic = locale === "ar" ? display : make("ar");
    return new Map(
      PHONE_COUNTRIES.map((c) => {
        const local = display?.of(c.iso) ?? c.iso;
        const haystack = [
          local,
          english?.of(c.iso) ?? "",
          arabic?.of(c.iso) ?? "",
          ...(SEARCH_ALIASES[c.iso] ?? []),
        ]
          .map(foldForSearch)
          .filter(Boolean);
        return [c.iso, { local, haystack }];
      }),
    );
  }, [locale]);

  const ordered = useMemo(() => {
    const priority = PRIORITY_ISO.map((p) => countryByIso(p));
    const rest = PHONE_COUNTRIES.filter(
      (c) => !(PRIORITY_ISO as readonly string[]).includes(c.iso),
    ).sort((a, b) =>
      (names.get(a.iso)?.local ?? a.iso).localeCompare(
        names.get(b.iso)?.local ?? b.iso,
        locale === "ar" ? "ar" : "en",
      ),
    );
    return [...priority, ...rest];
  }, [names, locale]);

  /* What was typed exactly ("uk", "Oman") first, then names that start with
     it, then names that merely contain it: "UK" is the United Kingdom before
     it is Ukraine. */
  const results = useMemo(() => {
    const q = foldForSearch(query).replace(/^(\+|00)/, "");
    if (!q) return ordered;
    if (/^\d+$/.test(q)) {
      /* The code itself first, and of the countries sharing it the one most people mean. */
      const hits = ordered.filter((c) => c.dial.startsWith(q));
      const exact = hits.filter((c) => c.dial === q);
      const main = exact.filter((c) => MAIN_FOR_DIAL[q] === c.iso);
      return [
        ...main,
        ...exact.filter((c) => !main.includes(c)),
        ...hits.filter((c) => c.dial !== q),
      ];
    }
    const exact: PhoneCountry[] = [];
    const starts: PhoneCountry[] = [];
    const contains: PhoneCountry[] = [];
    for (const c of ordered) {
      const hay = names.get(c.iso)?.haystack ?? [];
      if (hay.includes(q)) {
        exact.push(c);
      } else if (
        c.iso.toLowerCase() === q ||
        hay.some((h) => h.split(/[\s\-–]+/).some((word) => word.startsWith(q)))
      ) {
        starts.push(c);
      } else if (hay.some((h) => h.includes(q))) {
        contains.push(c);
      }
    }
    return [...exact, ...starts, ...contains];
  }, [query, ordered, names]);

  const emit = (nextIso: string, nextNational: string) =>
    onChange?.(toE164(nextIso, nextNational));

  const openPicker = () => {
    window.clearTimeout(closeTimer.current);
    /* Caught mid-close: slide it straight back. */
    if (open) {
      setShown(true);
      return;
    }
    setMode(window.matchMedia("(max-width: 639px)").matches ? "sheet" : "popover");
    setQuery("");
    setActive(
      Math.max(
        0,
        ordered.findIndex((c) => c.iso === iso),
      ),
    );
    setOpen(true);
  };

  const closePicker = (focus: "button" | "input" | "none") => {
    setShown(false);
    window.clearTimeout(closeTimer.current);
    if (mode === "sheet") {
      closeTimer.current = window.setTimeout(() => {
        setOpen(false);
        setQuery("");
      }, SHEET_MS);
    } else {
      setOpen(false);
      setQuery("");
    }
    /* Focus moves inside the tap itself, so a phone raises its keyboard for
       the number; a frame later, iOS would refuse. */
    if (focus === "input") inputRef.current?.focus({ preventScroll: mode === "sheet" });
    if (focus === "button") buttonRef.current?.focus({ preventScroll: true });
  };

  const choose = (nextIso: string) => {
    setIso(nextIso);
    setNational((n) => formatNational(nextIso, n));
    emit(nextIso, national);
    /* Straight on to the number when there is none yet; otherwise back to the country. */
    closePicker(nationalDigits(nextIso, national) ? "button" : "input");
  };

  /* Opening: the slide-in a frame after mounting, the chosen country in view,
     and focus. A mouse goes to the search; a touch screen does not get its
     keyboard thrown up over the list it is about to scroll. */
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      setShown(true);
      const list = listRef.current;
      const chosen = list?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (list && chosen)
        list.scrollTop =
          chosen.offsetTop - list.clientHeight / 2 + chosen.offsetHeight / 2;
      const finePointer = window.matchMedia("(pointer: fine)").matches;
      if (mode === "popover" || finePointer)
        searchRef.current?.focus({ preventScroll: true });
      else dialogRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, mode]);

  /* The dropdown closes on a press anywhere else. (The sheet has its own backdrop.) */
  useEffect(() => {
    if (!open || mode !== "popover") return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        closePicker("none");
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Keep the keyboard's highlighted country inside the list's view. */
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [active]);

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[active];
      if (pick) choose(pick.iso);
    } else if (e.key === "Escape") {
      /* Only the list closes, not a dialog the field sits in. */
      e.preventDefault();
      e.stopPropagation();
      closePicker("button");
    }
  };

  /* The sheet is modal: Tab cycles between its close button and its search. */
  const onDialogKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closePicker("button");
      return;
    }
    if (e.key !== "Tab") return;
    const first = closeButtonRef.current;
    const last = searchRef.current;
    if (!first || !last) return;
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === dialogRef.current)
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const country = countryByIso(iso);
  const countryName = names.get(iso)?.local ?? iso;

  const search = (
    <div className="flex items-center gap-3 border-b border-hairline px-4 transition-colors duration-200 ease-bloom focus-within:border-olive">
      <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-sage">
        <circle
          cx="7"
          cy="7"
          r="4.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        <path
          d="m10.5 10.5 3.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
      <input
        ref={searchRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (listRef.current) listRef.current.scrollTop = 0;
        }}
        onKeyDown={onSearchKey}
        role="combobox"
        aria-expanded
        aria-autocomplete="list"
        aria-label={copy.search}
        aria-controls={listId}
        aria-activedescendant={
          results[active] ? `${listId}-${results[active]!.iso}` : undefined
        }
        placeholder={copy.search}
        className="phone-search min-h-12 min-w-0 flex-1 bg-transparent text-base text-olive placeholder:text-sage/70 focus:outline-none"
      />
      {query ? (
        <button
          type="button"
          aria-label={copy.clear}
          onClick={() => {
            setQuery("");
            setActive(0);
            searchRef.current?.focus();
          }}
          className="-me-3 flex h-11 w-11 shrink-0 items-center justify-center text-sage transition-colors duration-200 ease-bloom hover:text-olive"
        >
          <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3">
            <path
              d="m2 2 8 8M10 2l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );

  const list = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label={copy.list}
      data-lenis-prevent
      className={cn(
        "relative overflow-y-auto overscroll-contain py-1",
        mode === "sheet"
          ? "min-h-0 flex-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
          : "max-h-72",
      )}
    >
      {results.length === 0 ? (
        <li role="presentation" className="px-4 py-4 text-base text-sage">
          {copy.none}
        </li>
      ) : (
        results.map((c, i) => {
          const selected = c.iso === iso;
          return (
            <li
              key={c.iso}
              id={`${listId}-${c.iso}`}
              role="option"
              aria-selected={selected}
              data-index={i}
              onPointerMove={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c.iso)}
              className={cn(
                "flex min-h-12 cursor-pointer select-none items-center gap-3 px-4 text-start text-base text-olive transition-colors duration-150 ease-bloom",
                i === active && "bg-cream/70",
                i === PRIORITY_ISO.length - 1 && !query && "border-b border-hairline",
              )}
            >
              <Flag iso={c.iso} />
              <span className={cn("min-w-0 flex-1 truncate", selected && "font-medium")}>
                {names.get(c.iso)?.local ?? c.iso}
              </span>
              <span dir="ltr" className="tabular-nums text-sage">
                +{c.dial}
              </span>
              <svg
                aria-hidden
                viewBox="0 0 12 12"
                className={cn("h-3 w-3 shrink-0 text-olive", !selected && "invisible")}
              >
                <path
                  d="m2 6.5 2.5 2.5L10 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </li>
          );
        })
      )}
    </ul>
  );

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-2" dir="ltr">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup={mode === "sheet" ? "dialog" : "listbox"}
          aria-expanded={open}
          aria-label={`${countryName} +${country.dial}`}
          onClick={() =>
            open && (shown || mode === "popover") ? closePicker("none") : openPicker()
          }
          onKeyDown={(e) => {
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
              e.preventDefault();
              openPicker();
            }
          }}
          className={cn(fieldClassName, "flex w-auto shrink-0 items-center gap-2 px-3")}
        >
          <Flag iso={iso} eager />
          <span className="tabular-nums">+{country.dial}</span>
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className={cn(
              "h-3 w-3 text-sage transition-transform duration-200 ease-bloom",
              open && "rotate-180",
            )}
          >
            <path
              d="M2.5 4.5 6 8l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        </button>
        <input
          {...rest}
          ref={inputRef}
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
            let clean = typed.replace(/[^\d\s\-()]/g, "").slice(0, 20);
            const lengths = lengthsFor(iso);
            if (lengths) {
              const longest = Math.max(...lengths);
              const digits = nationalDigits(iso, clean);
              const dial = country.dial;
              /* "971501234567", typed or autofilled without the plus. */
              if (
                digits.length > longest &&
                digits.startsWith(dial) &&
                lengths.includes(digits.length - dial.length)
              ) {
                clean = digits.slice(dial.length);
              } else if (digits.length > longest) {
                return; /* one digit more than this country's numbers have */
              }
            }
            setNational(clean);
            emit(iso, clean);
          }}
          onBlur={(e) => {
            setNational((n) => formatNational(iso, n));
            rest.onBlur?.(e);
          }}
          className={cn(fieldClassName, "min-w-0 flex-1")}
        />
      </div>
      {name ? <input type="hidden" name={name} value={toE164(iso, national)} /> : null}

      {open && mode === "popover" ? (
        <div
          onBlur={(e) => {
            if (!wrapRef.current?.contains(e.relatedTarget as Node | null))
              closePicker("none");
          }}
          className="absolute start-0 top-full z-40 mt-2 w-full min-w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-sm border border-hairline bg-canvas shadow-[0_18px_44px_-18px_rgba(43,47,27,0.35)]"
        >
          {search}
          {list}
        </div>
      ) : null}

      {open && mode === "sheet"
        ? createPortal(
            <div className={cn("fixed inset-0 z-[90]", !shown && "pointer-events-none")}>
              <div
                aria-hidden
                onClick={() => closePicker("button")}
                className={cn(
                  "absolute inset-0 bg-olive/40 transition-opacity duration-300 ease-bloom",
                  shown ? "opacity-100" : "opacity-0",
                )}
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={onDialogKey}
                style={{ transitionDuration: `${SHEET_MS}ms` }}
                className={cn(
                  "phone-sheet absolute inset-x-0 bottom-0 flex h-[85svh] flex-col rounded-t-[4px] bg-canvas shadow-[0_-18px_44px_-18px_rgba(43,47,27,0.35)] outline-none transition-[transform,opacity] ease-bloom motion-reduce:transition-opacity",
                  shown
                    ? "translate-y-0 opacity-100"
                    : "translate-y-full motion-reduce:translate-y-0 motion-reduce:opacity-0",
                )}
              >
                <div className="flex items-center justify-between ps-5 pe-2 pt-2">
                  <p
                    id={titleId}
                    className="font-brand text-xs font-medium uppercase tracking-brand text-sage"
                  >
                    {copy.title}
                  </p>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    aria-label={copy.close}
                    onClick={() => closePicker("button")}
                    className="flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-60"
                  >
                    <svg aria-hidden viewBox="0 0 14 14" className="h-3.5 w-3.5">
                      <path
                        d="m2 2 10 10M12 2 2 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                    </svg>
                  </button>
                </div>
                {search}
                {list}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
