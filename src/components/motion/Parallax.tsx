"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type ParallaxProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * 1 = static. Below 1 drifts slower than the page (background feel),
   * above 1 drifts faster. Keep within 0.85–1.15.
   */
  speed?: number;
};

/** GSAP scrub-linked vertical drift while the element traverses the viewport. */
export function Parallax({ children, className, speed = 0.9 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const drift = (1 - speed) * 120;
    const tween = gsap.fromTo(
      el,
      { y: -drift },
      {
        y: drift,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [speed, reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
