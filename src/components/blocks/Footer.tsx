import Link from "next/link";
import { Monogram } from "@/components/ui/Monogram";
import { CONTACT } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

/* inline-flex + min-h-11 gives every footer link the 44px tap area the
   project requires, without changing how the column looks. */
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-cream/80 transition-colors duration-200 ease-bloom hover:text-cream";

const headingClass =
  "mb-3 font-brand text-xs font-medium uppercase tracking-brand text-cream";

/**
 * The footer was the largest untranslated area on the site: in Arabic every
 * column heading and every one of its thirteen links still read in English
 * under `dir="rtl"`. The link labels used to come straight from `data.ts`,
 * which has no language, so they are keyed off the dictionary here instead.
 */
export async function Footer() {
  const { t } = await getDictionary();

  const shopLinks: { label: string; href: string }[] = [
    { label: t.footer.about, href: "/about" },
    { label: t.footer.shop, href: "/shop" },
    { label: t.footer.memberships, href: "/membership" },
    { label: t.footer.events, href: "/events" },
  ];
  const helpLinks: { label: string; href: string }[] = [
    { label: t.footer.delivery, href: "/delivery" },
    { label: t.footer.faqs, href: "/faqs" },
    { label: t.footer.terms, href: "/terms" },
    { label: t.footer.privacy, href: "/privacy" },
    { label: t.footer.refunds, href: "/refund-policy" },
  ];

  return (
    <footer className="relative overflow-hidden bg-olive pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-16 lg:pt-24">
      {/* The mark as a watermark — oversized, barely there, bled off the
          bottom edge so it reads as embossed paper rather than a logo
          pasted on. Decorative; the real lockup sits above it. */}
      <Monogram className="pointer-events-none absolute -bottom-[34%] left-1/2 w-[130%] -translate-x-1/2 text-cream/[0.05] sm:w-[80%] lg:-bottom-[42%] lg:w-[46%]" />

      <div className="relative mx-auto max-w-7xl gutter">
        {/* Stacked lockup */}
        <div className="flex flex-col items-center gap-4">
          <Monogram className="w-16 text-cream" title="Calanthe monogram" />
          <p className="font-brand text-2xl font-medium uppercase tracking-[0.22em] text-cream">
            Calanthe
          </p>
          <p className="font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-cream/75">
            {t.nav.atelier}
          </p>
        </div>

        <hr className="my-12 border-0 border-t border-cream/15" />

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-3 lg:gap-8">
          <nav aria-label={t.footer.shop}>
            <h3 className={headingClass}>{t.footer.shop}</h3>
            <ul className="flex flex-col">
              {shopLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t.footer.help}>
            <h3 className={headingClass}>{t.footer.help}</h3>
            <ul className="flex flex-col">
              {helpLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t.footer.contact} className="col-span-2 lg:col-span-1">
            <h3 className={headingClass}>{t.footer.contact}</h3>
            <ul className="flex flex-col">
              <li>
                <a
                  href={CONTACT.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {t.footer.whatsapp}
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.instagramHref}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {t.footer.instagram}
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT.email}`} className={linkClass}>
                  {t.footer.email}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <hr className="my-12 border-0 border-t border-cream/15" />

        {/* Bottom bar */}
        <div className="flex items-center justify-between pb-2">
          <p className="text-sm text-cream/75">{t.footer.rights}</p>
          <Monogram className="monogram-rotate w-8 text-cream-muted" />
        </div>
      </div>
    </footer>
  );
}
