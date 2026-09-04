"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";

/**
 * Storefront error boundary (docs/AUDIT.md finding B-4 — previously
 * NO error.tsx existed anywhere, so a thrown render error fell through
 * to Next's bare default screen). Detailed diagnostics go to the
 * console/Sentry, never to the visitor.
 */
export default function StorefrontError({
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
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <Monogram className="w-16 text-sage" />
      <Eyebrow>Something bloomed wrong</Eyebrow>
      <h1 className="max-w-md font-display text-4xl font-light text-olive lg:text-5xl">
        A petal fell out of place.
      </h1>
      <p className="max-w-sm text-base leading-relaxed text-sage">
        Something interrupted this page. It has been noted — please try
        again.
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className={buttonClasses("primary")}
        >
          Try Again
        </button>
        <Link href="/" className={buttonClasses("secondary")}>
          Return Home
        </Link>
      </div>
    </main>
  );
}
