"use client";

import { useEffect, useRef } from "react";

/**
 * THE CALANTHE SIGNATURE — the stem.
 *
 * A single hairline grows down the left margin as the visitor scrolls
 * the homepage, and small leaves open along it as the line reaches
 * them. It is marginalia, not decoration laid over the design: it lives
 * in the page gutter, never touches content, and is the only new idea
 * on the page after the hero mark has finished travelling.
 *
 * WHY IT IS BUILT THIS WAY. The obvious implementation is one tall SVG
 * path with a scroll-linked `stroke-dashoffset`, which means an SVG
 * whose aspect ratio has to be stretched to the viewport — leaves
 * distort, and the path re-rasterises on every scroll frame. Instead
 * the stem is a 1px column driven by `transform: scaleY()` and the
 * leaves are independent nodes driven by `opacity`/`transform`. Both
 * are compositor-only properties, so the whole thing costs the main
 * thread one custom-property write per animation frame and nothing
 * else — no layout, no paint, no re-rasterisation.
 *
 * Each leaf derives its own state from that single `--stem` value in
 * pure CSS (see globals.css), so there is no per-leaf JavaScript and no
 * IntersectionObserver army: five leaves cost exactly as much as one.
 *
 * Reduced motion: the stem is not animated at all — it simply is not
 * rendered. A line that exists only to describe scrolling has nothing
 * to say to someone who has asked for stillness.
 */

/* Where each leaf sits along the stem (0 = top) and which way it
   tilts. Leaves alternate their TILT rather than their side: every leaf
   opens to the right of the line, so the whole stem stays inside a band
   narrower than the page gutter and can never reach the content beside
   it at any viewport width. */
const LEAVES = [
  { at: 0.1, tilt: "up" },
  { at: 0.28, tilt: "down" },
  { at: 0.46, tilt: "up" },
  { at: 0.64, tilt: "down" },
  { at: 0.82, tilt: "up" },
] as const;

export function BotanicalStem() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Nothing is measured during scroll — measurements happen here and
       on resize only, so a scroll frame is arithmetic and one style
       write. Reading layout inside the scroll handler is what makes
       this pattern janky elsewhere. */
    let start = 0;
    let span = 1;

    const measure = () => {
      const vh = window.innerHeight;
      /* Begin once the hero is most of the way out, finish before the
         footer so the stem never runs into it. */
      start = vh * 0.55;
      const end = Math.max(
        start + vh,
        document.documentElement.scrollHeight - vh * 1.6,
      );
      span = end - start;
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      const raw = (window.scrollY - start) / span;
      const stem = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      el.style.setProperty("--stem", stem.toFixed(4));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    update();
    el.dataset.ready = "true";

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="botanical-stem">
      {/* The bud the stem grows out of. */}
      <span className="botanical-stem__bud" />
      {/* The line itself — scaleY from the top. */}
      <span className="botanical-stem__line" />

      {LEAVES.map((leaf) => (
        <span
          key={leaf.at}
          className="botanical-stem__leaf"
          data-tilt={leaf.tilt}
          style={
            {
              top: `${leaf.at * 100}%`,
              "--at": leaf.at,
            } as React.CSSProperties
          }
        >
          <svg viewBox="0 0 24 12" fill="none">
            {/* One leaf: a lens shape with a centre vein. */}
            <path
              d="M1 6C1 6 7 0.6 14.5 1.2C21 1.7 23 6 23 6C23 6 19 11.4 12.5 10.9C6 10.4 1 6 1 6Z"
              fill="currentColor"
              fillOpacity="0.16"
              stroke="currentColor"
              strokeWidth="0.9"
            />
            <path
              d="M2 6H21"
              stroke="currentColor"
              strokeWidth="0.7"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
        </span>
      ))}
    </div>
  );
}
