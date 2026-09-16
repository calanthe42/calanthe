"use client";

import { useEffect } from "react";
import { useLenisInstance } from "@/lib/lenis-context";

/**
 * How many overlays currently want the page held still.
 *
 * WHY A COUNTER AND NOT A BOOLEAN. Three components lock the page — the
 * mobile menu, the search overlay and the cart drawer — and they hand off
 * to one another. Tapping Search inside the menu closes the menu and opens
 * search in the same commit; the search overlay is a CHILD of the header,
 * so React runs its effect (lock) before the header's (unlock), and the
 * unlock won. The page then scrolled freely behind a full-screen overlay.
 *
 * Both writers were individually correct and the shared resource — one
 * global style property — was the bug. Counting holders makes the release
 * belong to the last one out, in whatever order the effects happen to run.
 */
let holders = 0;

/** Pause Lenis and lock document scroll while an overlay is open. */
export function useScrollLock(active: boolean): void {
  const lenis = useLenisInstance();

  useEffect(() => {
    if (!active) return;

    holders += 1;
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";

    return () => {
      holders = Math.max(0, holders - 1);
      if (holders === 0) {
        lenis?.start();
        document.documentElement.style.overflow = "";
      }
    };
  }, [active, lenis]);
}
