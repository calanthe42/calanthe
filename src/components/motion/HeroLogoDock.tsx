"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { StackedLogo } from "@/components/ui/StackedLogo";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";

gsap.registerPlugin(ScrollTrigger);

/**
 * One mark, two resting places. The real stacked lockup renders once,
 * fixed to the viewport, and a single scrubbed GSAP timeline ties three
 * things to scroll position at the same time:
 *
 *   position  centre of the viewport  ->  centre of the navbar's line
 *   size      full hero size          ->  navbar size
 *   colour    Stacked_Warm Cream      ->  Stacked_Deep Olive
 *
 * All three finish on the same frame, and because it is scrubbed rather
 * than triggered, scrolling back up reverses all three continuously.
 *
 * Every target is MEASURED, not hardcoded: the landing height comes from
 * the header's own row (`[data-nav-row]`) and the sizes come from the
 * `--logo-nav-w` / `--logo-hero-w` custom properties the header and hero
 * also use. `invalidateOnRefresh` re-measures on resize and on breakpoint
 * changes, so the mark cannot drift out of the navbar again.
 */
export function HeroLogoDock() {
  const reduced = useReducedMotionPref();
  const markRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (reduced) return;
    const mark = markRef.current;
    const hero = document.querySelector<HTMLElement>("[data-hero-root]");
    if (!mark || !hero) return;

    const cream = mark.querySelector<HTMLElement>(".stacked-cream");
    const olive = mark.querySelector<HTMLElement>(".stacked-olive");
    if (!cream || !olive) return;

    /* How far to travel, in pixels, as a TRANSFORM — never `top`.
       Animating `top` forces layout on every frame and stutters badly on
       phones (see brand/motion-spec.md: transform/opacity only). The mark
       stays pinned at top:50% in CSS and we move it with translateY.

       Distance = where the navbar's line sits (half the measured row
       height, since the header is pinned to the top by the time the mark
       arrives) minus where the mark starts (the viewport's middle). */
    const dockY = () => {
      const row = document.querySelector<HTMLElement>("[data-nav-row]");
      const navCentre = (row?.offsetHeight ?? 64) / 2;
      const viewportCentre = document.documentElement.clientHeight / 2;
      return navCentre - viewportCentre;
    };

    /* Navbar size ÷ current hero size, both read from the same custom
       properties the markup uses. */
    const dockScale = () => {
      const navW = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--logo-nav-w"),
      );
      const heroW = mark.offsetWidth;
      if (!navW || !heroW) return 0.2;
      return navW / heroW;
    };

    gsap.set(mark, { xPercent: -50, yPercent: -50, y: 0, scale: 1 });
    gsap.set(cream, { opacity: 1 });
    gsap.set(olive, { opacity: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "+=60%",
        scrub: 0.5,
        invalidateOnRefresh: true,
      },
    });

    /* Explicit durations so movement and colour land together: the mark
       runs the whole timeline (0 -> 1); the colour starts at 45% and
       also finishes at 1. It turns olive as it arrives — not before. */
    tl.to(
      mark,
      {
        y: dockY,
        xPercent: -50,
        yPercent: -50,
        scale: dockScale,
        ease: "none",
        duration: 1,
        force3D: true,
      },
      0,
    )
      .to(cream, { opacity: 0, ease: "none", duration: 0.55 }, 0.45)
      .to(olive, { opacity: 1, ease: "none", duration: 0.55 }, 0.45);

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <Link
      ref={markRef}
      href="/"
      aria-label="Calanthe — home"
      className="hero-logo-dock fixed left-1/2 top-1/2 z-[45] block w-[var(--logo-hero-w)] -translate-x-1/2 -translate-y-1/2 will-change-transform"
    >
      <StackedLogo priority sizes="(min-width: 1024px) 560px, 330px" />
    </Link>
  );
}
