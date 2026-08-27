import { cn } from "@/lib/cn";

type ClipRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

/**
 * Image uncover — clip-path lifts from the bottom while the image
 * settles from scale 1.1 to 1, like tissue paper being drawn off an
 * arrangement. Server component, CSS driven.
 */
export function ClipReveal({ children, className, delay = 0 }: ClipRevealProps) {
  return (
    <div
      data-io
      className={cn("io-clip overflow-hidden", className)}
      style={delay > 0 ? { transitionDelay: `${delay}s` } : undefined}
    >
      <div className="io-clip-inner h-full w-full">{children}</div>
    </div>
  );
}
