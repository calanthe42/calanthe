import { AnnouncementBar } from "@/components/blocks/AnnouncementBar";
import { Footer } from "@/components/blocks/Footer";
import { Header } from "@/components/blocks/Header";
import { Providers } from "@/components/blocks/Providers";
import { WhatsAppButton } from "@/components/blocks/WhatsAppButton";
import { LazyCartDrawer } from "@/components/commerce/LazyCartDrawer";
import { getActiveOccasions } from "@backend/data/occasions";
import { getAvailableProducts } from "@backend/data/products";

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /* Read once, on the server, and hand down as props. The cart provider and
     the search overlay both need the catalogue, and neither may query the
     database from the browser (docs/PROJECT-STRUCTURE.md §4). */
  const [catalogue, occasions] = await Promise.all([
    getAvailableProducts(),
    getActiveOccasions(),
  ]);

  return (
    <Providers catalogue={catalogue}>
      {/* First thing in the tab order on every page: a way past the
          navigation. Every storefront page renders its content in a
          <main>, which is what this targets. */}
      <a
        href="#main"
        className="skip-link m-3 rounded-sm bg-olive px-5 py-3 font-brand text-xs font-medium uppercase tracking-brand text-cream"
      >
        Skip to content
      </a>
      <AnnouncementBar />
      <Header products={catalogue} occasions={occasions} />
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
    </Providers>
  );
}
