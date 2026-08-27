import { AnnouncementBar } from "@/components/blocks/AnnouncementBar";
import { Header } from "@/components/blocks/Header";

export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      {children}
    </>
  );
}
