import { cn } from "@/lib/cn";

type BloomRevealProps = {
  children: React.ReactNode;
  className?: string;
  /** The point the light opens from, as a CSS position ("50% 45%"). */
  at?: string;
};

/**
 * A pool of light — clip-path opens as a circle from one point, once, at
 * 80% of the viewport. For an image that should arrive the way a flower
 * opens, from its heart outward, rather than lift like a sheet (that is
 * ClipReveal). Server component, CSS driven; reduced motion gets a fade.
 */
export function BloomReveal({ children, className, at }: BloomRevealProps) {
  return (
    <div
      data-io
      className={cn("io-bloom", className)}
      style={at ? ({ "--bloom-at": at } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
