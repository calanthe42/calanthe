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
      <AnnouncementBar />
      <Header products={catalogue} occasions={occasions} />
      {children}
      <Footer />
      <LazyCartDrawer />
      <WhatsAppButton />
    </Providers>
  );
}
