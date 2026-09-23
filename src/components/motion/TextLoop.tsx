"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/cn";

/**
 * Text travelling along a curve (after React Bits' TextLoop, ported to
 * TypeScript and tuned for this brand).
 *
 * WHY IT SUITS CALANTHE. The identity already bends type around things: the
 * wordmark runs the length of the printed ribbon, and the monogram is a
 * curve resolved into a letter. A wordmark following a slow wave is that
 * ribbon, unrolled across the screen.
 *
 * WHAT CHANGED FROM THE ORIGINAL.
 *  - The band behind the text is off by default. The brand's accent is for
 *    small marks, never a large fill, so the type travels on its own.
 *  - `prefers-reduced-motion` stops the tween AND parks the phrase at a
 *    readable offset instead of leaving it mid-flight.
 *  - The measuring pass re-runs on resize, so the repeat count is right at
 *    every width rather than only the first one.
 *  - The GSAP tween is paused while the band is off screen, so a decorative
 *    loop never costs frames the rest of the page needs.
 */

const EDGE_PAD = 6;

export type LoopShape = "wave" | "circle" | "infinity" | "arch" | "line";

function buildPath(shape: LoopShape, curviness: number, ribbonWidth: number, VIEW_W: number, VIEW_H: number): string {
  const CX = VIEW_W / 2;
  const CY = VIEW_H / 2;
  const c = Math.max(0, curviness);
  const room = Math.max(20, CY - Math.max(0, ribbonWidth) / 2 - EDGE_PAD);

  switch (shape) {
    case "circle": {
      const r = Math.min(90 + c * 0.95, room);
      return `M ${CX - r} ${CY} A ${r} ${r} 0 1 1 ${CX + r} ${CY} A ${r} ${r} 0 1 1 ${CX - r} ${CY} Z`;
    }
    case "infinity": {
      const r = 150 + c * 1.4;
      const h = Math.min(60 + c * 0.95, room);
      return [
        `M ${CX} ${CY}`,
        `C ${CX + r * 0.55} ${CY - h} ${CX + r} ${CY - h} ${CX + r} ${CY}`,
        `C ${CX + r} ${CY + h} ${CX + r * 0.55} ${CY + h} ${CX} ${CY}`,
        `C ${CX - r * 0.55} ${CY - h} ${CX - r} ${CY - h} ${CX - r} ${CY}`,
        `C ${CX - r} ${CY + h} ${CX - r * 0.55} ${CY + h} ${CX} ${CY}`,
        "Z",
      ].join(" ");
    }
    case "arch": {
      const rise = Math.min(120 + c * 1.1, room * 2);
      return `M 120 ${CY + rise / 2} Q ${CX} ${CY - rise * 1.5} ${VIEW_W - 120} ${CY + rise / 2}`;
    }
    case "line":
      return `M -320 ${CY} L ${VIEW_W + 320} ${CY}`;
    case "wave":
    default: {
      const a = Math.min(c * 2.2, room * 2);
      return `M -320 ${CY} Q -160 ${CY - a} 0 ${CY} T 320 ${CY} T 640 ${CY} T 960 ${CY} T 1280 ${CY} T ${VIEW_W + 320} ${CY}`;
    }
  }
}

export function TextLoop({
  text = "Calanthe",
  shape = "wave",
  path,
  speed = 90,
  direction = "forward",
  separator = "✦",
  curviness = 90,
  fontSize = 46,
  fontWeight = 400,
  letterSpacing = 2,
  uppercase = true,
  color = "currentColor",
  ribbon = false,
  ribbonColor = "currentColor",
  ribbonWidth = 86,
  pauseOnHover = true,
  viewW = 1200,
  viewH = 520,
  className,
  style,
}: {
  text?: string;
  shape?: LoopShape;
  path?: string;
  speed?: number;
  direction?: "forward" | "reverse";
  separator?: string;
  curviness?: number;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  color?: string;
  ribbon?: boolean;
  ribbonColor?: string;
  ribbonWidth?: number;
  pauseOnHover?: boolean;
  /** The frame the curve is drawn in. A closed shape wants it square. */
  viewW?: number;
  viewH?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const measureRef = useRef<SVGTextElement>(null);
  const headRef = useRef<SVGTextPathElement>(null);
  const tailRef = useRef<SVGTextPathElement>(null);

  const [metrics, setMetrics] = useState({ length: 0, reps: 1 });

  const pathId = `text-loop-${useId().replace(/:/g, "")}`;
  const d = useMemo(
    () => path ?? buildPath(shape, curviness, ribbonWidth, viewW, viewH),
    [path, shape, curviness, ribbonWidth, viewW, viewH],
  );

  const unit = useMemo(() => {
    const base = uppercase ? String(text).toUpperCase() : String(text);
    const gap = separator ? ` ${separator} ` : "   ";
    return `${base}${gap}`;
  }, [text, separator, uppercase]);

  const textStyle = useMemo(
    () => ({ fontSize: `${fontSize}px`, fontWeight, letterSpacing: `${letterSpacing}px` }),
    [fontSize, fontWeight, letterSpacing],
  );

  /* Measure the path and the phrase, and keep measuring as the box changes. */
  useLayoutEffect(() => {
    const pathEl = pathRef.current;
    const measureEl = measureRef.current;
    const root = rootRef.current;
    if (!pathEl || !measureEl || !root) return;

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      let length = 0;
      let unitWidth = 0;
      try {
        length = pathEl.getTotalLength();
        unitWidth = measureEl.getComputedTextLength();
      } catch {
        return;
      }
      if (!length) return;
      const reps = unitWidth > 0 ? Math.max(1, Math.round(length / unitWidth)) : 1;
      setMetrics((prev) => (prev.length === length && prev.reps === reps ? prev : { length, reps }));
    };

    measure();
    if (document.fonts?.ready) void document.fonts.ready.then(measure).catch(() => {});
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [d, unit, fontSize, fontWeight, letterSpacing]);

  /* Run the loop — only while it is on screen, and never under reduced motion. */
  useEffect(() => {
    const { length } = metrics;
    const head = headRef.current;
    const tail = tailRef.current;
    const root = rootRef.current;
    if (!head || !tail || !root || !length) return;

    const apply = (offset: number) => {
      const partner = offset >= 0 ? offset - length : offset + length;
      head.setAttribute("startOffset", String(offset));
      tail.setAttribute("startOffset", String(partner));
    };
    apply(0);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || speed <= 0) return;

    const state = { offset: 0 };
    const tween = gsap.to(state, {
      offset: direction === "reverse" ? -length : length,
      duration: length / speed,
      ease: "none",
      repeat: -1,
      onUpdate: () => apply(state.offset),
    });

    /* Off screen, it is not decoration — it is wasted frames. */
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) tween.resume();
        else tween.pause();
      },
      { rootMargin: "120px" },
    );
    io.observe(root);

    const pause = () => tween.pause();
    const resume = () => tween.resume();
    if (pauseOnHover) {
      root.addEventListener("pointerenter", pause);
      root.addEventListener("pointerleave", resume);
    }

    return () => {
      tween.kill();
      io.disconnect();
      if (pauseOnHover) {
        root.removeEventListener("pointerenter", pause);
        root.removeEventListener("pointerleave", resume);
      }
    };
  }, [metrics, speed, direction, pauseOnHover]);

  const loopText = unit.repeat(metrics.reps);
  const fitLength = metrics.length || undefined;

  return (
    <div ref={rootRef} className={cn("relative w-full overflow-hidden", className)} style={style}>
      <svg
        className="block h-auto w-full"
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={text}
      >
        <path
          ref={pathRef}
          id={pathId}
          d={d}
          fill="none"
          stroke={ribbon ? ribbonColor : "none"}
          strokeWidth={ribbon ? ribbonWidth : 0}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text ref={measureRef} className="invisible pointer-events-none" style={textStyle} aria-hidden>
          {unit}
        </text>

        {[headRef, tailRef].map((ref, i) => (
          <text
            key={i}
            className="select-none"
            style={textStyle}
            fill={color}
            dominantBaseline="central"
            aria-hidden
            textLength={fitLength}
            lengthAdjust="spacing"
          >
            <textPath ref={ref} href={`#${pathId}`} startOffset={0}>
              {loopText}
            </textPath>
          </text>
        ))}
      </svg>
    </div>
  );
}
