import Link from "next/link";
import { occasions } from "@/lib/data";

const extra = [
  { label: "Same-Day", href: "/shop" },
  { label: "Luxury", href: "/shop?price=over-600" },
] as const;

/**
 * The line directly beneath the hero. Deliberately NOT a row of filter
 * chips — boxed pills read as a search UI and undo the hero the moment
 * you leave it. This is an index line instead: bare type on the page's
 * own ground (no second background, so there is no seam under the
 * hero), hairline above and below, and a rule that draws under each
 * link on hover.
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
      <div className="mx-auto max-w-7xl gutter">
        <div className="no-scrollbar flex items-center gap-7 overflow-x-auto py-5 lg:justify-center lg:gap-10 lg:py-6">
          <span className="shrink-0 whitespace-nowrap font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage/70">
            Send flowers for
          </span>

          {links.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className="quicknav-link shrink-0 whitespace-nowrap font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-olive/80"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
