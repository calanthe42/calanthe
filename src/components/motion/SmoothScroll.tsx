"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";

const LenisProvider = lazy(() =>
  import("./LenisProvider").then((m) => ({ default: m.LenisProvider })),
);

/**
 * Lenis smooth scroll, mounted after the browser goes idle so its chunk
 * and ticker never compete with first paint or hydration (Lighthouse
 * TBT). Scrolling is native until then — visually indistinguishable in
 * the first moments of a visit.
 * prefers-reduced-motion → native scrolling permanently.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotionPref();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduced) return;
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(() => setReady(true));
      return () => window.cancelIdleCallback(handle);
    }
    const handle = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(handle);
  }, [reduced]);

  if (reduced || !ready) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<>{children}</>}>
      <LenisProvider>{children}</LenisProvider>
    </Suspense>
  );
}
