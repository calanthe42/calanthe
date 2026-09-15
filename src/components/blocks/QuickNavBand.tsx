"use client";

import { useState } from "react";
import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { FloralImage } from "@/components/ui/FloralImage";
import type { Occasion } from "@/lib/data";
import { cn } from "@/lib/cn";

const extra = [
  { label: "Same-Day", href: "/shop" },
  { label: "Luxury", href: "/shop?price=over-600" },
] as const;

/**
 * The line directly beneath the hero — a chapter opening, not filter
 * chips: the house seal, one line of intent, then the occasions in the
 * display serif.
 *
 * Hovering an occasion blooms its own photograph in behind the words,
 * very low and blurred, so the band answers back instead of just
 * sitting there. Pointer-only by design (`lg:` + hover state): on a
 * phone it stays a clean, quiet line.
 */
export function QuickNavBand({ occasions = [] }: { occasions?: readonly Occasion[] }) {
  const [active, setActive] = useState<number | null>(null);

  const links = [
    ...occasions.map((o) => ({
      label: o.name,
      href: `/occasions/${o.slug}`,
      image: o.image,
    })),
    ...extra.map((e) => ({ ...e, image: null })),
  ];

  return (
    <nav
      aria-label="Shop shortcuts"
      className="relative isolate overflow-hidden border-b border-hairline/70 bg-canvas"
      onMouseLeave={() => setActive(null)}
    >
      {/* Each occasion's photograph, stacked and cross-faded. Hidden
          from assistive tech and from touch — it is pure atmosphere. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
        {links.map((link, i) =>
          link.image ? (
            <div
              key={link.href + link.label}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-bloom",
                active === i ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="h-full w-full scale-110 blur-[3px]">
                <FloralImage image={link.image} sizes="100vw" />
              </div>
              {/* Keep the type readable no matter how bright the photo. */}
              <div className="absolute inset-0 bg-canvas/80" />
            </div>
          ) : null,
        )}
      </div>

      <div className="mx-auto max-w-7xl gutter py-8 lg:py-11">
        <div className="flex flex-col items-center gap-1.5 lg:gap-2">
          <Monogram className="h-6 w-6 text-burnt-orange/70 lg:h-7 lg:w-7" />
          <p className="font-brand text-[0.5625rem] font-medium uppercase tracking-brand text-sage/80 lg:text-[0.625rem]">
            Send flowers for
          </p>
        </div>

        {/* Phone scrolls; desktop centres and wraps. */}
        <ul className="no-scrollbar mt-5 flex items-baseline gap-6 overflow-x-auto lg:mt-6 lg:flex-wrap lg:justify-center lg:gap-x-9 lg:gap-y-3 lg:overflow-visible">
          {links.map((link, i) => (
            <li key={link.href + link.label} className="shrink-0">
              <Link
                href={link.href}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                /* min-h-11 keeps the tap area at the 44px floor even
                   though the type itself is only ~28px tall. */
                className="quicknav-link flex min-h-11 items-center whitespace-nowrap font-display text-[1.375rem] font-light leading-none text-olive lg:text-[1.75rem]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
