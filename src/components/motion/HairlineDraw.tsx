"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { DUR_REVEAL, EASE_BLOOM, VIEWPORT_ONCE } from "./constants";

type HairlineDrawProps = {
  className?: string;
  delay?: number;
};

/** A hairline that draws itself horizontally (scaleX, origin left). */
export function HairlineDraw({ className, delay = 0 }: HairlineDrawProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      className={cn("h-px w-full origin-left bg-hairline", className)}
      initial={reduced ? { opacity: 0 } : { scaleX: 0 }}
      whileInView={reduced ? { opacity: 1 } : { scaleX: 1 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: DUR_REVEAL, ease: EASE_BLOOM, delay }}
    />
  );
}
