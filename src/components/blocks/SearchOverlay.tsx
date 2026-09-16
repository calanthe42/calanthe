"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloralImage } from "@/components/ui/FloralImage";
import { Monogram } from "@/components/ui/Monogram";
import { CONTACT, formatAed } from "@/lib/data";
import type { Occasion, Product } from "@/lib/data";
import { useT } from "@/lib/locale";
import { useScrollLock } from "@/lib/useScrollLock";
import { cn } from "@/lib/cn";

type SearchOverlayProps = {
  open: boolean;
  onClose: () => void;
};

function IconSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M15.8 15.8 20 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Search — a designed experience with four states, not an input in a void.
 *
 * WHAT IT WAS. One field, and below it roughly 1200px of empty canvas. Typing
 * a word that matched nothing produced no message, no suggestion and no way
 * onward: a dead end dressed as a page. The field itself carried a 2px
 * burnt-orange ring at rest — the brand's CTA colour used as a resting
 * border, which read as a validation error and was the loudest thing on
 * screen.
 *
 * WHAT IT IS. The overlay always says something:
 *
 *   IDLE      the atelier's own starting points — occasions to walk into,
 *             so the empty state is an invitation rather than a blank.
 *   TYPING    one character is not a query, so it keeps showing those
 *             starting points instead of flashing "nothing found" at every
 *             keystroke.
 *   RESULTS   the arrangements, with a way to see them all.
 *   NOTHING   a real message, a reason, and two ways out — browse the
 *             collection, or ask a florist. Never a blank.
 *
 * The field is a hairline at rest and takes the accent only on focus, which
 * is what an accent is for.
 */
export function SearchOverlay({
  open,
  onClose,
  products = [],
  occasions = [],
}: SearchOverlayProps & {
  products?: readonly Product[];
  occasions?: readonly Occasion[];
}) {
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setQuery("");
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const trimmed = query.trim();
  const isSearching = trimmed.length >= 2;

  const results = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.flowers.some((f) => f.includes(q)) ||
          p.occasions.some((o) =>
            occasions
              .find((x) => x.slug === o)
              ?.name.toLowerCase()
              .includes(q),
          ),
      )
      .slice(0, 6);
  }, [trimmed, products, occasions]);

  function viewAll() {
    onClose();
    router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
  }

  if (!open) return null;

  const quiet =
    "inline-flex min-h-11 items-center font-brand text-xs font-medium uppercase tracking-brand text-olive underline decoration-hairline underline-offset-8 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange";

  return (
    /* `inset-0` and its own opaque canvas: the overlay used to start below
       the top of the viewport, which left the olive service strip showing
       above it as a stray dark bar across the corner. */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.search.label}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-canvas pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]"
    >
      <div className="mx-auto w-full max-w-2xl gutter">
        <div className="flex items-center justify-between">
          <p className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted">
            {t.search.label}
          </p>
          <button
            type="button"
            aria-label={t.search.close}
            onClick={onClose}
            className="-me-2 flex h-11 w-11 items-center justify-center text-olive transition-opacity duration-200 ease-bloom hover:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* A rule with an icon on it, not a boxed form control: the whole
            screen is the search, so the field does not need a container to
            announce itself. */}
        {/*
          THE UNDERLINE IS THE FOCUS INDICATOR, and the only one.

          The site's global focus ring is a 2px burnt-orange outline at 3px
          offset. On a field that is autofocused the moment the overlay
          opens, that drew a rounded orange rectangle around the input
          before the visitor had typed anything — which reads as a
          validation error, and was the loudest thing on the screen.

          Suppressing it is only acceptable because something clearly
          visible replaces it: a 2px burnt-orange rule that draws across the
          full width of the field. It is thicker than the ring it replaces,
          spans more of the control, and animates on a transform so it costs
          nothing. Focus remains obvious for keyboard users; it simply stops
          looking like a form error.
        */}
        <div className="group/field relative mt-3 flex items-center gap-3 border-b border-hairline pb-3 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:bg-burnt-orange after:transition-transform after:duration-300 after:ease-bloom focus-within:after:scale-x-100">
          <IconSearch className="h-5 w-5 shrink-0 text-ink-muted transition-colors duration-200 ease-bloom group-focus-within/field:text-burnt-orange" />
          <input
            id="site-search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && trimmed && viewAll()}
            placeholder={t.search.placeholder}
            aria-label={t.search.label}
            className="min-h-11 w-full bg-transparent font-display text-2xl font-light text-olive outline-none focus:outline-none focus-visible:outline-none placeholder:text-ink-muted/70 lg:text-3xl"
            autoComplete="off"
          />
        </div>

        {/* ---- IDLE / TOO SHORT: where to start ---- */}
        {!isSearching && occasions.length > 0 && (
          <div className="mt-10">
            <p className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted">
              {t.search.suggestionsTitle}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {occasions.slice(0, 6).map((occasion) => (
                <li key={occasion.slug}>
                  <Link
                    href={`/occasions/${occasion.slug}`}
                    onClick={onClose}
                    className="inline-flex min-h-11 items-center rounded-sm border border-hairline px-4 text-sm text-olive transition-colors duration-200 ease-bloom hover:border-olive"
                  >
                    {occasion.name}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/shop" onClick={onClose} className={cn(quiet, "mt-8")}>
              {t.search.browseAll}
            </Link>
          </div>
        )}

        {/* ---- RESULTS ---- */}
        {isSearching && results.length > 0 && (
          <div className="mt-8">
            <p className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted">
              {t.search.resultsTitle}
            </p>
            <ul className="mt-2 flex flex-col divide-y divide-hairline border-t border-hairline">
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/product/${product.slug}`}
                    onClick={onClose}
                    className="flex min-h-16 items-center gap-4 py-3 transition-opacity duration-200 ease-bloom hover:opacity-70"
                  >
                    <div className="aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-media-sm">
                      <FloralImage image={product.images[0]} sizes="48px" />
                    </div>
                    <span className="flex-1 font-display text-lg text-olive">
                      {product.name}
                    </span>
                    <span className="text-sm text-ink-muted">
                      {formatAed(product.priceAed)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" onClick={viewAll} className={cn(quiet, "mt-6")}>
              {t.search.viewAll}
            </button>
          </div>
        )}

        {/* ---- NOTHING FOUND: a real state, never a blank ---- */}
        {isSearching && results.length === 0 && (
          <div className="mt-12 border-t border-hairline pt-12 text-center">
            <Monogram className="mx-auto w-12 text-hairline" />
            <p className="mt-6 font-display text-2xl font-light italic text-olive">
              {t.search.noResultsTitle}
            </p>
            <p className="mx-auto mt-3 max-w-md text-base text-ink-muted">
              {t.search.noResultsBody}
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8">
              <button type="button" onClick={viewAll} className={quiet}>
                {t.search.searchWhole}
              </button>
              <a
                href={CONTACT.whatsappHref}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className={quiet}
              >
                {t.search.askFlorist}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
