import { cn } from "@/lib/cn";

type ArchProps = {
  children: React.ReactNode;
  /** The hairline behind the arch: cream on a dark ground, olive on a light one. */
  ring: "cream" | "olive";
  className?: string;
};

/**
 * An arched window, 3:4 — the silhouette of the booth's own mirror and
 * panels. A second arch, only a hairline, stands offset behind it the way
 * the booth layers one panel behind another; it steps towards the reading
 * end, so in Arabic it mirrors.
 *
 * The children fill the window (give them `fill` or `absolute inset-0`).
 */
export function Arch({ children, ring, className }: ArchProps) {
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 translate-x-3 -translate-y-3 rounded-t-full border rtl:-translate-x-3 lg:translate-x-4 lg:-translate-y-4 lg:rtl:-translate-x-4",
          ring === "cream" ? "border-cream/30" : "border-olive/25",
        )}
      />
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-full">{children}</div>
    </div>
  );
}
