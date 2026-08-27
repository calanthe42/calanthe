"use client";

import { useEffect } from "react";
import { useLenisInstance } from "@/lib/lenis-context";

/** Pause Lenis and lock document scroll while an overlay is open. */
export function useScrollLock(active: boolean): void {
  const lenis = useLenisInstance();

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
