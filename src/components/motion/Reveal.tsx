"use client";

import { motion, useReducedMotion } from "motion/react";
import { DUR_REVEAL, EASE_BLOOM, VIEWPORT_ONCE } from "./constants";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds. Use for small intra-section offsets only — groups use <Stagger>. */
  delay?: number;
};

/** Default entrance: fade + rise 24px. Fires once at 80% viewport. */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: DUR_REVEAL, ease: EASE_BLOOM, delay }}
    >
      {children}
    </motion.div>
  );
}
