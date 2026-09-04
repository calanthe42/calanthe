"use client";

import { useEffect } from "react";
import { Cinzel, Cormorant_Garamond, Instrument_Sans } from "next/font/google";
import "./(frontend)/globals.css";

/**
 * Last-resort error boundary: catches errors thrown inside a root
 * layout itself (both (frontend) and (payload) are root layouts via
 * route groups). Like global-not-found.tsx, this bypasses every layout
 * so it must supply its own <html>/<body> and fonts. In practice
 * src/app/(frontend)/error.tsx catches almost everything; this is the
 * net beneath the net (docs/AUDIT.md finding B-4).
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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry client init lands in B8; console is the interim record.
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        className={`${cinzel.variable} ${cormorant.variable} ${instrument.variable} antialiased`}
      >
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
          <p className="font-brand text-xs font-medium uppercase tracking-brand text-sage">
            Something bloomed wrong
          </p>
          <h1 className="max-w-md font-display text-4xl font-light text-olive lg:text-5xl">
            A petal fell out of place.
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-sage">
            Something interrupted the page. It has been noted — please try
            again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 items-center justify-center rounded-sm bg-burnt-orange px-8 py-3 font-brand text-[0.8125rem] font-medium uppercase tracking-brand text-cream transition-[opacity,filter,transform] duration-200 ease-bloom hover:brightness-95 active:scale-[0.985]"
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
