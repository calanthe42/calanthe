import { cn } from "@/lib/cn";

/**
 * Charts drawn as inline SVG.
 *
 * No charting library: the shapes needed here are a bar series and a
 * proportion bar, and a dependency to draw rectangles is weight the admin
 * would carry on every page load forever. Server-rendered, so there is no
 * hydration cost and no flash of an empty canvas. Colours come from the
 * theme tokens, so both themes are correct with no extra code.
 *
 * NOTHING IS SYNTHESISED. Every point comes from a real order. A day with no
 * orders is drawn as zero, because that is what happened.
 *
 * In Arabic the time axis runs right to left, like the text around it.
 */

export type ChartBar = { key: string; label: string; value: number; display: string };

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function BarChart({
  bars,
  summary,
  emptyText,
  tone = "accent",
}: {
  bars: readonly ChartBar[];
  /** The whole chart in one sentence, for screen readers. */
  summary: string;
  emptyText: string;
  tone?: "accent" | "ink";
}) {
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-md bg-sunken/50 text-center">
        <p className="text-sm text-ink-3">{emptyText}</p>
      </div>
    );
  }

  const max = niceMax(Math.max(...bars.map((bar) => bar.value)));
  const width = 100;
  const height = 40;
  const gap = bars.length > 40 ? 0.25 : bars.length > 14 ? 0.55 : 1.4;
  const barWidth = Math.max((width - gap * (bars.length - 1)) / bars.length, 0.3);
  const middle = bars[Math.floor(bars.length / 2)];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
        className="h-44 w-full rtl:-scale-x-100"
      >
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={0}
            x2={width}
            y1={height - fraction * height}
            y2={height - fraction * height}
            className="stroke-line"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {bars.map((bar, index) => {
          const h = (bar.value / max) * height;
          return (
            <rect
              key={bar.key}
              x={index * (barWidth + gap)}
              y={height - h}
              width={barWidth}
              height={h}
              rx={0.35}
              className={cn(
                "transition-opacity duration-150 hover:opacity-75",
                tone === "accent" ? "fill-chart-1" : "fill-chart-2",
              )}
            >
              {/* ONE string child: React refuses several children in <title>. */}
              <title>{`${bar.label}: ${bar.display}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between gap-2 text-xs text-ink-3 tabular">
        <span>{bars[0]?.label}</span>
        {bars.length > 6 && middle ? <span className="hidden sm:inline">{middle.label}</span> : null}
        <span>{bars[bars.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export type StatusSegment = { key: string; label: string; count: number; className: string };

/** Open orders by status: one proportional bar and a key. */
export function StatusBar({
  segments,
  summary,
  emptyText,
}: {
  segments: readonly StatusSegment[];
  summary: string;
  emptyText: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) {
    return <p className="rounded-md bg-sunken/50 px-4 py-10 text-center text-sm text-ink-3">{emptyText}</p>;
  }

  return (
    <div>
      <div role="img" aria-label={summary} className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-sm">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <span key={s.key} className={cn("h-full", s.className)} style={{ width: `${(s.count / total) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-4 space-y-2">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", s.className)} />
            <span className={cn("min-w-0 flex-1 truncate", s.count > 0 ? "text-ink" : "text-ink-3")}>{s.label}</span>
            <span className="text-ink-2 tabular">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
