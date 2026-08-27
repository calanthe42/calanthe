"use client";

import { useEffect } from "react";
import { useLenis } from "lenis/react";

/** Pause Lenis and lock document scroll while an overlay is open. */
export function useScrollLock(active: boolean): void {
  const lenis = useLenis();

  useEffect(() => {
    if (active) {
      lenis?.stop();
      document.documentElement.style.overflow = "hidden";
    } else {
      lenis?.start();
      document.documentElement.style.overflow = "";
    }
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = "";
    };
  }, [active, lenis]);
}
