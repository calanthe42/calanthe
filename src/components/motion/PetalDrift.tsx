import { cn } from "@/lib/cn";

/**
 * Four petals adrift in the hero — the only ambient motion on the page.
 *
 * WHAT WENT WRONG BEFORE, TWICE. First a hairline stem grew down the whole
 * document, fixed to the viewport, crossing every section beneath it: a line
 * travelling through a page of photographs reads as a stray object, not as
 * marginalia. Then five petals fell in straight diagonals at even intervals —
 * closer, but the eye reads regular spacing and identical paths as a
 * screensaver within about two seconds.
 *
 * WHAT MAKES THIS READ AS A ROOM RATHER THAN AN EFFECT.
 *
 * - **Two axes, never one.** The outer span carries the fall, the inner span
 *   sways side to side on a different, deliberately non-multiple duration
 *   (37s against 11s, and so on). The paths never repeat in a way the eye can
 *   learn, and no petal travels in a straight line.
 * - **Depth, not a layer.** Two petals sit far back — smaller, blurred, barely
 *   there; two sit closer and sharper. The frame gains depth instead of a
 *   sheet of confetti over the photograph.
 * - **Already in motion.** Negative delays mean the scene is mid-drift at
 *   first paint. Nothing starts, so nothing announces itself.
 * - **Few, slow, faint.** Four petals, 37–61 seconds to cross, 0.10–0.20
 *   opacity over a dark photograph. Noticed on the second look, never the
 *   first — which is the whole brief.
 * - **Contained.** Absolutely positioned inside the hero's own
 *   `overflow-hidden` box, so it cannot reach another section.
 *
 * COST. No JavaScript, no library, no scroll listener: eight elements
 * animating `transform` and `opacity`, both composited, so the main thread
 * never sees them. `aria-hidden`, and removed outright under
 * `prefers-reduced-motion` (globals.css).
 */

type Petal = {
  /** Where it enters, as a percentage of the hero's width. */
  x: number;
  /** Seconds for one crossing — long, and never a multiple of a neighbour. */
  fall: number;
  /** Seconds for one sway. Deliberately unrelated to `fall`. */
  sway: number;
  /** How far it wanders sideways while falling. */
  drift: number;
  /** Negative: the petal is already partway down at first paint. */
  delay: number;
  size: number;
  spin: number;
  opacity: number;
  /** Distance blur — the far petals are softer. */
  blur: number;
};

const PETALS: readonly Petal[] = [
  {
    x: 16,
    fall: 44,
    sway: 11,
    drift: 26,
    delay: -12,
    size: 21,
    spin: 150,
    opacity: 0.18,
    blur: 0,
  },
  {
    x: 38,
    fall: 61,
    sway: 17,
    drift: -34,
    delay: -39,
    size: 12,
    spin: -90,
    opacity: 0.1,
    blur: 1.6,
  },
  {
    x: 67,
    fall: 37,
    sway: 13,
    drift: 30,
    delay: -24,
    size: 26,
    spin: 190,
    opacity: 0.2,
    blur: 0,
  },
  {
    x: 86,
    fall: 53,
    sway: 19,
    drift: -22,
    delay: -5,
    size: 14,
    spin: -130,
    opacity: 0.12,
    blur: 1.2,
  },
];

export function PetalDrift({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "petal-drift pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {PETALS.map((petal, i) => (
        <span
          key={i}
          className="petal-fall absolute block"
          style={
            {
              left: `${petal.x}%`,
              width: `${petal.size}px`,
              "--fall-duration": `${petal.fall}s`,
              "--fall-delay": `${petal.delay}s`,
            } as React.CSSProperties
          }
        >
          <span
            className="petal-sway block"
            style={
              {
                opacity: petal.opacity,
                filter: petal.blur ? `blur(${petal.blur}px)` : undefined,
                "--sway-duration": `${petal.sway}s`,
                "--sway-drift": `${petal.drift}px`,
                "--sway-spin": `${petal.spin}deg`,
              } as React.CSSProperties
            }
          >
            {/* A petal, not an ellipse: one edge fuller than the other, the
                tip drawn slightly off centre, the way a real one curls. */}
            <svg viewBox="0 0 24 34" fill="none" className="h-auto w-full">
              <path
                d="M12.6 0.6c7 6.2 10.9 13.2 10.6 20.2-.3 7.3-5.4 12.6-11.6 12.6S0 27.9 0.4 20.6C.8 13.3 5.2 6.4 12.6.6Z"
                fill="currentColor"
                className="text-cream"
              />
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
}
