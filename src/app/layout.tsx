import type { Metadata, Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Instrument_Sans } from "next/font/google";
import { MotionObserver } from "@/components/motion/MotionObserver";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
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

export const metadata: Metadata = {
  title: {
    default: "CALANTHE — Flower Atelier, UAE",
    template: "%s — CALANTHE",
  },
  description:
    "Luxury flower atelier in the UAE. Hand-composed arrangements, same-day delivery. Where feelings take form.",
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
