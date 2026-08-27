import { cn } from "@/lib/cn";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Seconds. Use for small intra-section offsets only — groups use <Stagger>. */
  delay?: number;
};

/**
 * Default entrance: fade + rise 24px, once at 80% viewport.
 * Server component — animation is CSS driven by MotionObserver.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <div
      data-io
      className={cn("io-reveal", className)}
      style={delay > 0 ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
