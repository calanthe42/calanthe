import { cn } from "@/lib/cn";

type HairlineDrawProps = {
  className?: string;
  delay?: number;
};

/** A hairline that draws itself horizontally (scaleX, origin left). */
export function HairlineDraw({ className, delay = 0 }: HairlineDrawProps) {
  return (
    <div
      aria-hidden
      data-io
      className={cn("io-hairline h-px w-full bg-hairline", className)}
      style={delay > 0 ? { transitionDelay: `${delay}s` } : undefined}
    />
  );
}
