import { MONOGRAM_PATHS, MONOGRAM_VIEWBOX } from "@/components/motion/monogram-paths";
import { cn } from "@/lib/cn";

type MonogramProps = {
  className?: string;
  title?: string;
};

/** Static monogram (server-renderable). Color via currentColor. */
export function Monogram({ className, title }: MonogramProps) {
  return (
    <svg
      viewBox={MONOGRAM_VIEWBOX}
      className={cn("block", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
    >
      {MONOGRAM_PATHS.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
