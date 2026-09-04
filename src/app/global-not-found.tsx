import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel, Cormorant_Garamond, Instrument_Sans } from "next/font/google";
import { buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";
import "./(frontend)/globals.css";

/**
 * Catches genuinely unmatched routes (no page in either the (frontend)
 * or (payload) route group matches at all). Those requests bypass BOTH
 * root layouts, so this file must supply its own <html>/<body> and
 * fonts — see brand/backend-architecture.md restructure notes and
 * docs/AUDIT.md finding A-1. Mirrors src/app/(frontend)/not-found.tsx,
 * which still handles in-app notFound() calls within that group.
 */

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
  title: "Not Found — CALANTHE",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} antialiased`}
      >
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-burgundy px-6 text-center">
          <Monogram className="w-16 text-cream/80" />
          <Eyebrow className="text-cream/60">404</Eyebrow>
          <h1 className="max-w-md font-display text-4xl font-light text-cream lg:text-5xl">
            This page has wilted.
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-cream/70">
            The address you followed is no longer in bloom — but the atelier
            is.
          </p>
          <Link href="/" className={buttonClasses("secondary-cream", "mt-2")}>
            Return Home
          </Link>
        </main>
      </body>
    </html>
  );
}
