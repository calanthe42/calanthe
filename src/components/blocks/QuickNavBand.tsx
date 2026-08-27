import Link from "next/link";
import { occasions } from "@/lib/data";

const extra = [
  { label: "Same-Day", href: "/shop" },
  { label: "Luxury", href: "/shop?price=over-600" },
] as const;

/** Occasion quick-nav band under the hero — one tap into the catalog. */
export function QuickNavBand() {
  return (
    <nav aria-label="Shop shortcuts" className="border-b border-hairline bg-cream/60">
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-3 overflow-x-auto gutter py-3.5">
        {[
          ...occasions.map((o) => ({
            label: o.name,
            href: `/occasions/${o.slug}`,
          })),
          ...extra,
        ].map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-sm border border-hairline bg-canvas px-4 font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-olive transition-colors duration-200 ease-bloom hover:border-sage"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
