import { Footer } from "@/components/blocks/Footer";
import { BrandIntro } from "@/components/blocks/BrandIntro";
import { CookieNotice } from "@/components/blocks/CookieNotice";
import { Header } from "@/components/blocks/Header";
import { Providers } from "@/components/blocks/Providers";
import { WelcomeOfferGate } from "@/components/blocks/WelcomeOfferGate";
import { WhatsAppButton } from "@/components/blocks/WhatsAppButton";
import { LazyCartDrawer } from "@/components/commerce/LazyCartDrawer";
import { getDictionary } from "@/lib/i18n/server";
import { getActiveOccasions } from "@backend/data/occasions";
import { effectiveFlags, getSiteFlags } from "@backend/data/site-flags";
import { getAvailableProducts } from "@backend/data/products";
import { getWelcomeVisitor } from "@backend/data/welcome";

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /* Read once, on the server, and hand down as props. The cart provider and
     the search overlay both need the catalogue, and neither may query the
     database from the browser (docs/PROJECT-STRUCTURE.md §4). */
  const [catalogue, occasions, { locale, t }, rawFlags, welcome] = await Promise.all([
    getAvailableProducts(),
    getActiveOccasions(),
    getDictionary(),
    getSiteFlags(),
    getWelcomeVisitor(),
  ]);

  return (
    <Providers
      catalogue={catalogue}
      locale={locale}
      /* The basket asks for the gift only when it is this customer's. */
      welcome={welcome.account === "eligible" ? welcome.offer : null}
      /* This layout is not rendered again on a soft navigation, so a
         customer who confirms her address in another tab — or whose gift
         could not be read just now — would keep this "no" until a reload.
         Checkout asks again before she pays. */
      welcomeUnsettled={welcome.account === "unconfirmed" || welcome.account === "unknown"}
    >
      {/* The opening: once per visit, before anything else is seen. */}
      <BrandIntro tagline={t.about.closingLine} />
      {/* First thing in the tab order on every page: a way past the
          navigation. Every storefront page renders its content in a
          <main>, which is what this targets. */}
      <a
        href="#main"
        className="skip-link m-3 inline-flex min-h-11 items-center rounded-sm bg-olive px-5 font-brand text-xs font-medium uppercase tracking-brand text-cream"
      >
        {t.nav.skipToContent}
      </a>
      {/* The strip is rendered INSIDE the header (see Header.tsx): over the
          homepage photograph the two used to be separately coloured bands
          stacked on one another, and the hard edge between them read as an
          unexplained line across the top of the hero. One element now owns
          the whole top of the page and decides how it is painted. */}
      <Header products={catalogue} occasions={occasions} siteFlags={effectiveFlags(rawFlags)} />
      {/* tabIndex -1 so the skip link actually MOVES focus here. Without
          it the browser scrolls but leaves focus in the navigation, and
          the next Tab drops the visitor straight back into the menu —
          which is the failure mode most skip links ship with. */}
      <div id="main" tabIndex={-1}>
        {children}
      </div>
      <Footer />
      <LazyCartDrawer />
      <WhatsAppButton />
      {/* Asked once, on the first visit. */}
      <CookieNotice />
      {/* Invited once, and only when nobody is signed in — after the cookie answer. */}
      <WelcomeOfferGate gift={welcome.account === "guest" ? welcome.offer : null} />
    </Providers>
  );
}
