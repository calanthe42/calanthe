"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { DUR_CLIP, EASE_BLOOM, VIEWPORT_ONCE } from "./constants";

type ClipRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

/**
 * Image uncover — clip-path lifts from the bottom while the image settles
 * from scale 1.1 to 1, like tissue paper being drawn off an arrangement.
 */
export function ClipReveal({ children, className, delay = 0 }: ClipRevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <motion.div
        className={cn("overflow-hidden", className)}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={VIEWPORT_ONCE}
        transition={{ duration: DUR_CLIP, ease: EASE_BLOOM, delay }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn("overflow-hidden", className)}
      initial={{ clipPath: "inset(100% 0 0 0)" }}
      whileInView={{ clipPath: "inset(0% 0 0 0)" }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: DUR_CLIP, ease: EASE_BLOOM, delay }}
    >
      <motion.div
        className="h-full w-full"
        initial={{ scale: 1.1 }}
        whileInView={{ scale: 1 }}
        viewport={VIEWPORT_ONCE}
        transition={{ duration: DUR_CLIP, ease: EASE_BLOOM, delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
