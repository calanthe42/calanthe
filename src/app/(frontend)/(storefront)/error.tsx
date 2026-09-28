"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";
import { CONTACT } from "@/lib/data";
import { useT } from "@/lib/locale";

/**
 * The storefront's OWN error boundary.
 *
 * WHY IT EXISTS SEPARATELY. There was already an error boundary, but it sat
 * at `(frontend)/error.tsx` — one level above the storefront layout. A
 * boundary replaces everything inside the layout it belongs to, so when the
 * database hiccuped on `/` or `/shop` the visitor got a bare page with NO
 * header, NO footer and no navigation of any kind: measured, the page had
 * zero fixed or sticky elements on it. Two buttons on an otherwise empty
 * screen is not a route back for someone who arrived from search and has no
 * idea what this site is.
 *
 * A boundary nested HERE is rendered inside the storefront layout, so the
 * header, the menu, the footer and the WhatsApp button all survive the
 * failure. The customer keeps the whole site; only the panel that failed is
 * replaced. That is the difference between an incident and a dead end.
 *
 * Diagnostics go to the console/Sentry, never to the visitor.
 */
export default function StorefrontSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 gutter section-pad text-center">
      <Monogram className="w-14 text-hairline" />
      <Eyebrow>{t.errors.eyebrow}</Eyebrow>
      <h1 className="font-display text-4xl font-light text-olive lg:text-5xl">
        {t.errors.title}
      </h1>
      <p className="max-w-md text-base leading-relaxed text-ink-muted">
        {t.errors.segmentBody}
      </p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button type="button" onClick={reset} className={buttonClasses("primary")}>
          {t.errors.tryAgain}
        </button>
        <Link href="/shop" className={buttonClasses("secondary")}>
          {t.errors.browseCollection}
        </Link>
      </div>
      <a
        href={CONTACT.whatsappHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center font-brand text-xs font-medium uppercase tracking-brand text-olive underline decoration-hairline underline-offset-8 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
      >
        {t.errors.whatsappInstead}
      </a>
    </main>
  );
}
