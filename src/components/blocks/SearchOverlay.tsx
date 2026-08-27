"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloralImage } from "@/components/ui/FloralImage";
import { fieldClasses } from "@/components/ui/form-classes";
import { formatAed, occasions, products } from "@/lib/data";
import { useScrollLock } from "@/lib/useScrollLock";

type SearchOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.flowers.some((f) => f.includes(q)) ||
          p.occasions.some((o) =>
            occasions.find((x) => x.slug === o)?.name.toLowerCase().includes(q),
          ),
      )
      .slice(0, 6);
  }, [query]);

  function viewAll() {
    onClose();
    router.push(`/shop?q=${encodeURIComponent(query.trim())}`);
  }

  if (!open) return null;

  return (
    <div className="menu-in fixed inset-0 z-50 flex flex-col bg-canvas pt-[calc(env(safe-area-inset-top)+4.5rem)]">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+0.875rem)] flex h-11 w-11 items-center justify-center text-olive"
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

      <div className="mx-auto w-full max-w-2xl gutter">
        <label
          htmlFor="site-search"
          className="mb-2 block font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage"
        >
          Search the atelier
        </label>
        <input
          id="site-search"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query.trim() && viewAll()}
          placeholder="Roses, birthday, Amber Hour…"
          className={fieldClasses}
          autoComplete="off"
        />

        {results.length > 0 && (
          <ul className="mt-6 flex flex-col divide-y divide-hairline border-t border-hairline">
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
                  <span className="text-sm text-sage">
                    {formatAed(product.priceAed)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {query.trim().length >= 2 && (
          <button
            type="button"
            onClick={viewAll}
            className="mt-6 min-h-11 font-brand text-xs font-medium uppercase tracking-brand text-olive underline decoration-burnt-orange underline-offset-8 transition-opacity duration-200 ease-bloom hover:opacity-70"
          >
            {results.length > 0
              ? "View all results"
              : "Search the whole collection"}
          </button>
        )}
      </div>
    </div>
  );
}
