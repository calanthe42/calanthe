"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { DUR_REVEAL, EASE_BLOOM, VIEWPORT_ONCE } from "./constants";

type SplitLinesProps = {
  /** Art-directed line breaks — one string per line. */
  lines: readonly string[];
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  /**
   * Play on mount instead of on scroll — for above-the-fold headlines.
   * Keeps the text painted (opacity stays 1); entrance is transform-only.
   */
  immediate?: boolean;
  delay?: number;
};

/**
 * Editorial headline reveal: each line rises out of an overflow mask.
 * Transform-only — safe for LCP elements (text is never opacity 0
 * unless reduced-motion swaps to a quick fade).
 */
export function SplitLines({
  lines,
  as: Tag = "h2",
  className,
  immediate = false,
  delay = 0,
}: SplitLinesProps) {
  const reduced = useReducedMotion();

  return (
    <Tag className={className}>
      <span className="sr-only">{lines.join(" ")}</span>
      {lines.map((line, i) => (
        <span key={i} aria-hidden className="block overflow-hidden">
          <motion.span
            className="block will-change-transform"
            initial={reduced ? { opacity: 0, y: 0 } : { opacity: 1, y: "110%" }}
            {...(immediate
              ? { animate: { opacity: 1, y: 0 } }
              : {
                  whileInView: { opacity: 1, y: 0 },
                  viewport: VIEWPORT_ONCE,
                })}
            transition={{
              duration: DUR_REVEAL,
              ease: EASE_BLOOM,
              delay: delay + i * 0.08,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

export function splitLinesClassName(className?: string): string {
  return cn(className);
}
