"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE_BLOOM, VIEWPORT_ONCE } from "./constants";
import { MONOGRAM_PATHS, MONOGRAM_VIEWBOX } from "./monogram-paths";

type MonogramBloomProps = {
  className?: string;
  delay?: number;
  /** Accessible label; decorative by default. */
  title?: string;
};

/**
 * The Calanthe monogram blossoming: each petal group draws on as a
 * stroke, then the mark fills. Uses the true vector extracted from the
 * brand .ai (7 paths). Color inherits from `currentColor`.
 */
export function MonogramBloom({ className, delay = 0, title }: MonogramBloomProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <motion.svg
        viewBox={MONOGRAM_VIEWBOX}
        className={className}
        role={title ? "img" : "presentation"}
        aria-label={title}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEWPORT_ONCE}
        transition={{ duration: 0.7, ease: EASE_BLOOM, delay }}
      >
        {MONOGRAM_PATHS.map((d, i) => (
          <path key={i} d={d} fill="currentColor" />
        ))}
      </motion.svg>
    );
  }

  return (
    <motion.svg
      viewBox={MONOGRAM_VIEWBOX}
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
    >
      {MONOGRAM_PATHS.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={4}
          variants={{
            hidden: { pathLength: 0, fillOpacity: 0, strokeOpacity: 1 },
            visible: {
              pathLength: 1,
              fillOpacity: 1,
              strokeOpacity: 0,
              transition: {
                pathLength: {
                  duration: 1.1,
                  ease: EASE_BLOOM,
                  delay: delay + i * 0.12,
                },
                fillOpacity: {
                  duration: 0.6,
                  ease: EASE_BLOOM,
                  delay: delay + 0.9 + i * 0.08,
                },
                strokeOpacity: {
                  duration: 0.5,
                  ease: EASE_BLOOM,
                  delay: delay + 1.4,
                },
              },
            },
          }}
        />
      ))}
    </motion.svg>
  );
}
