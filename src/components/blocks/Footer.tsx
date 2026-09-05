import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { CONTACT, helpNavLinks, primaryNavLinks } from "@/lib/data";

const shopLinks = primaryNavLinks;
const helpLinks = helpNavLinks;

const linkClass =
  "text-sm text-cream/75 transition-colors duration-200 ease-bloom hover:text-cream";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-olive pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-16 lg:pt-20">
      {/* The mark as a watermark — oversized, barely there, bled off the
          bottom edge so it reads as embossed paper rather than a logo
          pasted on. Decorative; the real lockup sits above it. */}
      <Monogram className="pointer-events-none absolute -bottom-[34%] left-1/2 w-[130%] -translate-x-1/2 text-cream/[0.04] sm:w-[80%] lg:-bottom-[42%] lg:w-[46%]" />

      <div className="relative mx-auto max-w-7xl gutter">
        {/* Stacked lockup */}
        <div className="flex flex-col items-center gap-4">
          <Monogram className="w-16 text-cream" title="Calanthe monogram" />
          <p className="font-brand text-2xl font-medium uppercase tracking-[0.22em] text-cream">
            Calanthe
          </p>
          <p className="font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream/70">
            Flower Atelier — UAE
          </p>
        </div>

        <hr className="my-12 border-0 border-t border-cream/15" />

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-3 lg:gap-8">
          <nav aria-label="Shop">
            <h3 className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-cream">
              Shop
            </h3>
            <ul className="flex flex-col gap-3">
              {shopLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Help">
            <h3 className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-cream">
              Help
            </h3>
            <ul className="flex flex-col gap-3">
              {helpLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Contact" className="col-span-2 lg:col-span-1">
            <h3 className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-cream">
              Contact
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <a
                  href={CONTACT.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.instagramHref}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  Instagram
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT.email}`} className={linkClass}>
                  Email
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <hr className="my-12 border-0 border-t border-cream/15" />

        {/* Bottom bar */}
        <div className="flex items-center justify-between pb-2">
          <p className="text-sm text-cream/70">© 2026 Calanthe</p>
          <Monogram className="monogram-rotate w-8 text-sage" />
        </div>
      </div>
    </footer>
  );
}
