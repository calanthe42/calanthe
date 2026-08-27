"use client";

import { createContext, useContext } from "react";
import type Lenis from "lenis";

/** The live Lenis instance, or null before idle / under reduced motion. */
export const LenisContext = createContext<Lenis | null>(null);

export function useLenisInstance(): Lenis | null {
  return useContext(LenisContext);
}
