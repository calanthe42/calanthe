"use client";

import { useEffect, useState } from "react";
import type Lenis from "lenis";
import { LenisContext } from "@/lib/lenis-context";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";

/**
 * Lenis smooth scroll, created imperatively once the browser is idle so
 * its chunk and ticker never compete with first paint or hydration.
 * The React tree never changes shape — children are rendered directly
 * in every state, so activating Lenis can never remount the app.
 * prefers-reduced-motion → native scrolling permanently.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotionPref();
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (reduced) return;

    let instance: Lenis | null = null;
    let disposed = false;
    let tickerFn: ((time: number) => void) | null = null;
    let gsapRef: typeof import("gsap").gsap | null = null;

    async function start() {
      const [{ default: LenisCtor }, { gsap }, { ScrollTrigger }] =
        await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      instance = new LenisCtor({ autoRaf: false });
      instance.on("scroll", ScrollTrigger.update);
      tickerFn = (time: number) => instance?.raf(time * 1000);
      gsap.ticker.add(tickerFn);
      gsap.ticker.lagSmoothing(0);
      gsapRef = gsap;
      setLenis(instance);
    }

    let idleHandle: number | undefined;
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => void start());
    } else {
      idleHandle = window.setTimeout(() => void start(), 1500) as unknown as number;
    }

    return () => {
      disposed = true;
      if (typeof window.cancelIdleCallback === "function" && idleHandle !== undefined) {
        window.cancelIdleCallback(idleHandle);
      } else if (idleHandle !== undefined) {
        clearTimeout(idleHandle);
      }
      if (tickerFn && gsapRef) gsapRef.ticker.remove(tickerFn);
      instance?.destroy();
      setLenis(null);
    };
  }, [reduced]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
