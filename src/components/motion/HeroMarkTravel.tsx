"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";

/**
 * ONE MARK, TRAVELLING — the hero's brand lockup and the navbar's are the
 * same physical object, and scrolling moves it between the two.
 *
 * WHY THIS IS A REWRITE AND NOT A REVIVAL.
 *
 * The previous version rendered a SECOND copy of the lockup as a
 * `position: fixed` element outside the header and flew it upward with a
 * scrubbed GSAP timeline. Measured, its offset from the navigation row ran
 *
 *     223 → 231 → 178 → 18 → 0     (scroll 0 → 60 → 120 → 300 → 800)
 *
 * It moved DOWN before it moved up, because the service strip left the
 * sticky flow at ~32px and shifted the row the mark was aiming at, while
 * the timeline was still interpolating toward the old target. Being fixed
 * and at z-45 against a z-40 header, it also painted straight over the
 * navigation. Two faults, one cause: the mark and its destination were
 * different elements in different stacking contexts, so their positions had
 * to be kept in sync by hand, and every layout change broke the agreement.
 *
 * THE FIX IS STRUCTURAL. There is now exactly one lockup, and it lives IN
 * the header's centre slot permanently. It is never moved to the hero —
 * instead it is TRANSFORMED down into the hero while the page is at the
 * top, and the transform relaxes to identity as you scroll. So:
 *
 *   · Docked is the element's natural position. There is no target to
 *     miss, and nothing to re-measure when the layout changes.
 *   · Horizontal is never computed. Both ends are the centre of the same
 *     row, so the x-offset is identically zero at every width — which is
 *     what "different centering logic on desktop/mobile" came from.
 *   · It is a child of the header, so it cannot paint over it.
 *   · Position is a pure function of scrollY, so scrolling back up runs
 *     the journey backwards exactly, with no state to fall out of sync.
 *   · The service strip can move, the row can change height, the
 *     breakpoint can change — the docked position is still just "where
 *     this element already is".
 *
 * Transform and opacity only, written to custom properties from a single
 * rAF-throttled scroll listener, so the compositor does the work.
 */

/** Where the big mark sits in the hero, as a fraction of viewport height. */
const HERO_CENTRE = 0.46;

/** How much scrolling completes the journey, as a fraction of the hero. */
const TRAVEL = 0.42;

export function HeroMarkTravel() {
  const pathname = usePathname();
  const reduced = useReducedMotionPref();

  useEffect(() => {
    /* Only the homepage has a full-bleed hero for the mark to sit in.
       Everywhere else it simply stays in the bar, which is its home. */
    if (pathname !== "/" || reduced) return;

    const mark = document.querySelector<HTMLElement>("[data-travel-mark]");
    const hero = document.querySelector<HTMLElement>("[data-hero-root]");
    if (!mark || !hero) return;

    let frame = 0;
    let navCentre = 0;
    let heroCentre = 0;
    let distance = 1;
    let scaleUp = 1;

    /* Measured, never assumed: the docked centre is read with the travel
       transform cleared, so it is the element's true resting position. */
    const measure = () => {
      mark.style.setProperty("--travel", "1");
      const rect = mark.getBoundingClientRect();
      navCentre = rect.top + rect.height / 2;

      const heroHeight = hero.getBoundingClientRect().height || window.innerHeight;
      heroCentre = heroHeight * HERO_CENTRE;
      distance = Math.max(1, heroHeight * TRAVEL);

      /* `--logo-hero-w` is `min(78vw, 330px)` — a calc expression, not a
         number, so parseFloat returns NaN and the whole animation silently
         fell back to a hardcoded 4x. Measuring a throwaway element that
         carries the property lets the browser resolve it, which keeps the
         CSS the single source of truth for how large the hero mark is. */
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;width:var(--logo-hero-w)";
      document.body.appendChild(probe);
      const heroWidth = probe.getBoundingClientRect().width;
      probe.remove();

      const navWidth = rect.width;
      scaleUp = heroWidth && navWidth ? heroWidth / navWidth : 4;
    };

    const apply = () => {
      frame = 0;
      /* 0 = fully in the hero, 1 = fully docked in the navbar. */
      const progress = Math.min(1, Math.max(0, window.scrollY / distance));
      const eased = progress * progress * (3 - 2 * progress); // smoothstep

      mark.style.setProperty("--travel", String(eased));
      mark.style.setProperty("--travel-y", `${(1 - eased) * (heroCentre - navCentre)}px`);
      mark.style.setProperty("--travel-scale", String(1 + (1 - eased) * (scaleUp - 1)));
      /* Cream nearly the whole way, olive only as it lands. Turning at 62%
         left the mark mid-dissolve while it was still out over the
         photograph — and olive on a dark bouquet is invisible, so it read
         as the logo ghosting out rather than travelling. It now holds
         cream until it is essentially on the bar. */
      mark.style.setProperty(
        "--travel-cream",
        String(1 - Math.max(0, (eased - 0.86) / 0.14)),
      );
      /* While it is out over the hero it is decoration, not a target —
         a 560px link must not swallow taps meant for the photograph. */
      mark.dataset.travelling = eased < 0.98 ? "true" : "false";
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    const onResize = () => {
      measure();
      apply();
    };

    measure();
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      mark.style.removeProperty("--travel");
      mark.style.removeProperty("--travel-y");
      mark.style.removeProperty("--travel-scale");
      mark.style.removeProperty("--travel-cream");
      delete mark.dataset.travelling;
    };
  }, [pathname, reduced]);

  return null;
}
