"use client";

import { useEffect, useRef } from "react";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";
import { loadGsap } from "./loadGsap";

type ParallaxProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * 1 = static. Below 1 drifts slower than the page (background feel),
   * above 1 drifts faster. Keep within 0.85–1.15.
   */
  speed?: number;
  /**
   * Skip the scrub below 1024px. For a large image that already shares
   * the screen with another scroll-linked animation — on a phone the
   * second scrub buys almost nothing and costs frames.
   */
  desktopOnly?: boolean;
};

/** GSAP scrub-linked vertical drift while the element traverses the viewport. */
export function Parallax({
  children,
  className,
  speed = 0.9,
  desktopOnly = false,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPref();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    if (desktopOnly && !window.matchMedia("(min-width: 1024px)").matches) return;

    const drift = (1 - speed) * 120;
    /* GSAP arrives on demand (loadGsap), so it is not in the first bundle. */
    let cancelled = false;
    let tween: { kill: () => void; scrollTrigger?: { kill: () => void } } | null = null;
    void loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      tween = gsap.fromTo(
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
    });

    return () => {
      cancelled = true;
      tween?.scrollTrigger?.kill();
      tween?.kill();
    };
  }, [speed, reduced, desktopOnly]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
