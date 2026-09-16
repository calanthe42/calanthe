import { cn } from "@/lib/cn";

/**
 * Petals crossing the hero photograph, the way they cross a workbench.
 *
 * WHY THIS AND NOT AN EFFECT. The hero is a still photograph of a finished
 * bouquet; the atelier it comes from is a room where petals are constantly
 * being trimmed, dropped and swept. A handful drifting slowly through the
 * frame says "these are made by hand, this morning" without a word of copy,
 * which is the one thing the homepage could not say before.
 *
 * RESTRAINT IS THE DESIGN. Five petals, not a snowstorm: at 0.22 opacity over
 * a dark photograph they read as motes of light rather than confetti, and any
 * one of them takes the better part of half a minute to cross. Falling petals
 * are a cliché when they are fast, opaque and numerous; slow, few and barely
 * there is atmosphere.
 *
 * COST. No JavaScript, no library, no scroll listener. Five absolutely
 * positioned SVGs animating `transform` and `opacity` only — both handled by
 * the compositor, so this never touches layout or paint and cannot jank a
 * phone. Marked `aria-hidden`, so it is silent to assistive technology, and
 * `prefers-reduced-motion` removes it outright (globals.css).
 *
 * Geometry lives in inline custom properties because each petal needs its own
 * path, and five one-off keyframe sets would be worse than five variables.
 */

type Petal = {
  /** Start, as a percentage of the hero's width. */
  x: number;
  /** Horizontal drift over the whole fall, in viewport width units. */
  drift: number;
  /** Seconds for one crossing. Slow — this is weather, not animation. */
  duration: number;
  delay: number;
  size: number;
  spin: number;
  opacity: number;
};

const PETALS: readonly Petal[] = [
  { x: 12, drift: 7, duration: 26, delay: 0, size: 22, spin: 160, opacity: 0.22 },
  { x: 33, drift: -5, duration: 32, delay: 6, size: 15, spin: -120, opacity: 0.16 },
  { x: 58, drift: 9, duration: 29, delay: 12, size: 26, spin: 200, opacity: 0.2 },
  { x: 74, drift: -8, duration: 35, delay: 3, size: 18, spin: -180, opacity: 0.14 },
  { x: 89, drift: 5, duration: 24, delay: 16, size: 13, spin: 140, opacity: 0.18 },
];

export function PetalDrift({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("petal-drift pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {PETALS.map((petal, i) => (
        <span
          key={i}
          className="petal absolute block"
          style={
            {
              left: `${petal.x}%`,
              width: `${petal.size}px`,
              opacity: petal.opacity,
              "--petal-drift": `${petal.drift}vw`,
              "--petal-duration": `${petal.duration}s`,
              "--petal-delay": `${petal.delay}s`,
              "--petal-spin": `${petal.spin}deg`,
            } as React.CSSProperties
          }
        >
          {/* One soft petal, drawn once and reused. The shape is deliberately
              imperfect — a real petal is not an ellipse. */}
          <svg viewBox="0 0 24 32" fill="none" className="h-auto w-full">
            <path
              d="M12 0.5c6.2 5.4 11 12.4 11 19.1 0 7-4.9 12-11 12S1 26.6 1 19.6C1 12.9 5.8 5.9 12 0.5Z"
              fill="currentColor"
              className="text-cream"
            />
          </svg>
        </span>
      ))}
    </div>
  );
}
