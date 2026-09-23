"use client";

import Link from "next/link";
import { LilyField } from "@/components/ui/LilyField";
import { Monogram } from "@/components/ui/Monogram";
import type { Occasion } from "@/lib/data";
import { useT } from "@/lib/locale";

/**
 * Appended after the occasions from the database.
 *
 * "Same-Day" was removed at the client's request: it is a delivery promise,
 * not an occasion, and sitting in a row of occasions it read as a category
 * the shop does not have. The same-day DELIVERY logic is untouched — the
 * cutoff countdown in the service strip and the trust band both still
 * announce it, which is where a promise belongs.
 */
const EXTRA_HREF = "/shop?price=over-600";

/**
 * The line directly beneath the hero — a chapter opening, not filter chips:
 * the house seal, one line of intent, then the occasions in the display
 * serif.
 *
 * WHAT WAS WRONG. Hovering an occasion bloomed its photograph in behind the
 * words — scaled up, blurred 3px, then flooded with 80% canvas to keep the
 * type legible. Three treatments fighting each other produced exactly one
 * result: a pale wash with grey-pink smudges and the occasions floating on
 * top of it at half contrast. It read as a rendering fault rather than as
 * atmosphere, and it was the client's own report.
 *
 * WHAT IT IS NOW. No photograph at all. The band is the page's own cream
 * with the lily linework pressed across it — the same surface the paper bags
 * and the greeting cards are printed with, and the same one the seal section
 * above uses, so the top of the homepage reads as one material. The
 * occasions sit at full contrast, and hovering does what it always did: a
 * burnt-orange hairline grows under the word. One idea, legible everywhere.
 *
 * The row WRAPS rather than scrolling sideways. A scrolling row hides half
 * the occasions behind an edge with nothing to say they are there; three
 * centred lines show all six at once on a phone.
 */
export function QuickNavBand({ occasions = [] }: { occasions?: readonly Occasion[] }) {
  const t = useT();
  /* Was a hardcoded English literal, so it stayed "Luxury" on the Arabic
     homepage. */
  const extra = [{ label: t.band.luxury, href: EXTRA_HREF }];

  const links = [
    ...occasions.map((o) => ({ label: t.occasionNames[o.slug] ?? o.name, href: `/occasions/${o.slug}` })),
    ...extra,
  ];

  return (
    <nav
      aria-label="Shop shortcuts"
      className="relative isolate overflow-hidden border-b border-hairline/70 bg-canvas"
    >
      {/* The paper. Cropped hard by the band's own edges, so what shows is a
          fragment of a much larger flower — never a drawing sitting in a
          box. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <LilyField
          opacity={0.06}
          /* On a phone the band is short, so the crop matters: land it on the
             petal fan, not the stems — a fragment of flower reads as paper,
             a fragment of stem reads as stray lines. */
          className="absolute -top-[72%] start-[-52%] w-[185%] text-olive rtl:-scale-x-100 lg:-top-[190%] lg:start-[-8%] lg:w-[58%]"
        />
      </div>

      <div className="mx-auto max-w-7xl gutter py-10 lg:py-14">
        <div className="flex flex-col items-center gap-2">
          <Monogram className="h-7 w-7 text-burnt-orange/75 lg:h-8 lg:w-8" />
          <p className="font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-ink-muted lg:text-xs">
            Send flowers for
          </p>
        </div>

        <ul className="mt-6 flex flex-wrap items-baseline justify-center gap-x-7 gap-y-1 lg:mt-8 lg:gap-x-10 lg:gap-y-2">
          {links.map((link) => (
            <li key={link.href + link.label}>
              <Link
                href={link.href}
                /* min-h-11 keeps the tap area at the 44px floor even though
                   the type itself is only ~28px tall. */
                className="quicknav-link flex min-h-11 items-center whitespace-nowrap font-display text-[1.5rem] font-light leading-none text-olive lg:text-[2rem]"
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
