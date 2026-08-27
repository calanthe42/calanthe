import { AnnouncementBar } from "@/components/blocks/AnnouncementBar";
import { Footer } from "@/components/blocks/Footer";
import { Header } from "@/components/blocks/Header";
import { Providers } from "@/components/blocks/Providers";
import { WhatsAppButton } from "@/components/blocks/WhatsAppButton";
import { CartDrawer } from "@/components/commerce/CartDrawer";

export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Providers>
      <AnnouncementBar />
      <Header />
      {children}
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
    </Providers>
  );
}
