import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { occasions } from "@/lib/data";

const extra = [
  { label: "Same-Day", href: "/shop" },
  { label: "Luxury", href: "/shop?price=over-600" },
] as const;

/**
 * The line directly beneath the hero. Not filter chips, and not a
 * second card grid — a chapter opening: the house seal, a single line
 * of intent, then the occasions set in the display serif at a size
 * that can actually carry. Hairline rules top and bottom, the page's
 * own ground behind it so there is no seam under the hero.
 */
export function QuickNavBand() {
  const links = [
    ...occasions.map((o) => ({ label: o.name, href: `/occasions/${o.slug}` })),
    ...extra,
  ];

  return (
    <nav
      aria-label="Shop shortcuts"
      className="border-b border-hairline/70 bg-canvas"
    >
      <div className="mx-auto max-w-7xl gutter py-8 lg:py-11">
        <div className="flex flex-col items-center gap-1.5 lg:gap-2">
          <Monogram className="h-6 w-6 text-burnt-orange/70 lg:h-7 lg:w-7" />
          <p className="font-brand text-[0.5625rem] font-medium uppercase tracking-brand text-sage/80 lg:text-[0.625rem]">
            Send flowers for
          </p>
        </div>

        {/* Phone scrolls; desktop centres and wraps. */}
        <ul className="no-scrollbar mt-5 flex items-baseline gap-6 overflow-x-auto lg:mt-6 lg:flex-wrap lg:justify-center lg:gap-x-9 lg:gap-y-3 lg:overflow-visible">
          {links.map((link) => (
            <li key={link.href + link.label} className="shrink-0">
              <Link
                href={link.href}
                className="quicknav-link block whitespace-nowrap font-display text-[1.375rem] font-light leading-none text-olive lg:text-[1.75rem]"
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
