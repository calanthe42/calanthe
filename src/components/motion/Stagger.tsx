"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { DUR_REVEAL, EASE_BLOOM, STAGGER_STEP, VIEWPORT_ONCE } from "./constants";

const groupVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER_STEP } },
};

type StaggerProps = {
  children: React.ReactNode;
  className?: string;
};

/** Group whose <StaggerItem> children reveal 80ms apart. */
export function Stagger({ children, className }: StaggerProps) {
  return (
    <motion.div
      className={className}
      variants={groupVariants}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: React.ReactNode;
  className?: string;
};

export function StaggerItem({ children, className }: StaggerItemProps) {
  const reduced = useReducedMotion();

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DUR_REVEAL, ease: EASE_BLOOM },
    },
  };

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
