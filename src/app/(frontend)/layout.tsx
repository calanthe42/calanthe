import type { Metadata, Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Instrument_Sans } from "next/font/google";
import { MotionObserver } from "@/components/motion/MotionObserver";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { OG_IMAGE } from "@/lib/seo";
import { SITE_ORIGIN } from "@/lib/site";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "Luxury flower atelier in the UAE. Hand-composed arrangements, same-day delivery. Where feelings take form.";

export const metadata: Metadata = {
  /* Without metadataBase, every relative Open Graph URL Next generates
     resolves against localhost and every share preview breaks in
     production — silently, because the page itself renders fine. */
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "CALANTHE — Flower Atelier, UAE",
    template: "%s — CALANTHE",
  },
  description: DESCRIPTION,
  applicationName: "Calanthe",
  /* The share card. Every page inherits this and overrides only what
     differs, so a product link posted to WhatsApp — which is how most
     of this catalogue will actually be shared in the UAE — unfurls with
     real photography rather than a bare URL. */
  openGraph: {
    type: "website",
    siteName: "CALANTHE",
    title: "CALANTHE — Flower Atelier, UAE",
    description: DESCRIPTION,
    locale: "en_AE",
    url: SITE_ORIGIN,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "CALANTHE — Flower Atelier, UAE",
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  /* No verification tokens and no `robots` here: robots.ts already
     governs indexing, and it correctly refuses preview deployments. */
};

export const viewport: Viewport = {
  themeColor: "#f3efdf",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} antialiased`}
      >
        <MotionObserver />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
