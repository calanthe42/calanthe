import { cn } from "@/lib/cn";

type HeroRibbonProps = {
  className?: string;
};

/**
 * A small, quiet material detail — one fold of ribbon/silk catching
 * light, not a page-spanning line. Sits beside the logo lockup as
 * texture, never as the composition's subject. Pure SVG; only the
 * wrapping element's opacity/transform animate (see `.hero-ribbon`
 * in globals.css).
 */
export function HeroRibbon({ className }: HeroRibbonProps) {
  const d = "M 4 34 C 34 10 56 52 90 26 C 122 2 148 40 184 20";

  return (
    <svg
      aria-hidden
      viewBox="0 0 190 56"
      className={cn("hero-ribbon", className)}
    >
      <defs>
        <linearGradient id="hero-ribbon-body" x1="4" y1="34" x2="184" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-cream)" />
          <stop offset="100%" stopColor="var(--color-sage)" />
        </linearGradient>
      </defs>

      <path
        d={d}
        fill="none"
        stroke="url(#hero-ribbon-body)"
        strokeWidth={2.25}
        strokeLinecap="round"
        opacity={0.6}
      />
      <path
        d={d}
        fill="none"
        stroke="var(--color-cream)"
        strokeWidth={0.75}
        strokeLinecap="round"
        opacity={0.4}
        transform="translate(-0.6,-0.5)"
      />
    </svg>
  );
}
