import { cn } from "@/lib/cn";

type SplitLinesProps = {
  /** Art-directed line breaks — one string per line. */
  lines: readonly string[];
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  /**
   * Play on mount instead of on scroll — for above-the-fold (LCP)
   * headlines. Runs as a maskless CSS animation from first paint, so
   * the text is painted (and counted as LCP) immediately.
   */
  immediate?: boolean;
  delay?: number;
};

/**
 * Editorial headline reveal. Scroll mode: lines rise out of overflow
 * masks once at 80% viewport. Immediate mode: a gentle maskless rise
 * that starts before hydration. Server component in both modes.
 */
export function SplitLines({
  lines,
  as: Tag = "h2",
  className,
  immediate = false,
  delay = 0,
}: SplitLinesProps) {
  if (immediate) {
    return (
      <Tag className={className}>
        <span className="sr-only">{lines.join(" ")}</span>
        {lines.map((line, i) => (
          <span
            key={i}
            aria-hidden
            className="splitline-rise"
            style={{ animationDelay: `${delay + i * 0.08}s` }}
          >
            {line}
          </span>
        ))}
      </Tag>
    );
  }

  return (
    <Tag
      data-io
      className={cn("io-lines", className)}
      style={delay > 0 ? { transitionDelay: `${delay}s` } : undefined}
    >
      <span className="sr-only">{lines.join(" ")}</span>
      {lines.map((line, i) => (
        <span key={i} aria-hidden className="block overflow-hidden">
          <span className="io-line block">{line}</span>
        </span>
      ))}
    </Tag>
  );
}
