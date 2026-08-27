import { AnnouncementBar } from "@/components/blocks/AnnouncementBar";
import { Footer } from "@/components/blocks/Footer";
import { Header } from "@/components/blocks/Header";

export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      {children}
      <Footer />
    </>
  );
}
