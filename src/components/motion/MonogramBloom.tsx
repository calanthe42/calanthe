import { cn } from "@/lib/cn";
import { MONOGRAM_PATHS, MONOGRAM_VIEWBOX } from "./monogram-paths";

type MonogramBloomProps = {
  className?: string;
  title?: string;
};

/**
 * The Calanthe monogram blossoming: each petal group draws on as a
 * stroke (unit-based dasharray via pathLength), then the mark fills.
 * True vector from the brand .ai. Server component, CSS driven.
 */
export function MonogramBloom({ className, title }: MonogramBloomProps) {
  return (
    <svg
      data-io
      viewBox={MONOGRAM_VIEWBOX}
      className={cn("io-mono", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
    >
      {MONOGRAM_PATHS.map((d, i) => (
        <path key={i} d={d} pathLength={1} fill="currentColor" />
      ))}
    </svg>
  );
}
