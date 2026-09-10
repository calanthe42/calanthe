import { formatFils } from "@/lib/money";

/**
 * Charts drawn as inline SVG.
 *
 * No charting library: the two shapes needed here are a bar series and a
 * proportion bar, and a dependency to draw a rectangle is weight the admin
 * would carry on every page load forever. Server-rendered, so there is no
 * hydration cost and no flash of an empty canvas.
 *
 * NOTHING IS SYNTHESISED. Every point comes from a real order. Where a day
 * had no orders it is drawn as zero, because that is what happened.
 */

export type SeriesPoint = { label: string; iso: string; orders: number; revenueFils: number };

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function BarChart({
  points,
  metric,
  title,
}: {
  points: SeriesPoint[];
  metric: "orders" | "revenue";
  title: string;
}) {
  const values = points.map((p) => (metric === "orders" ? p.orders : p.revenueFils));
  const max = niceMax(Math.max(...values, 0));
  const total = values.reduce((a, b) => a + b, 0);

  /* A viewBox plus percentage widths keeps this responsive without JS. */
  const width = 100;
  const height = 34;
  const gap = points.length > 40 ? 0.2 : 0.8;
  const barWidth = Math.max((width - gap * (points.length - 1)) / points.length, 0.4);

  return (
    <div className="rounded-md border border-hairline/70 bg-white p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="font-brand text-[10px] uppercase tracking-brand text-sage">{title}</h3>
        <p className="font-display text-2xl font-light tabular-nums lining-nums text-olive">
          {metric === "orders" ? total : formatFils(total)}
        </p>
      </div>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-sage">
          No {metric === "orders" ? "orders" : "revenue"} in this period yet.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${title}: ${points.length} days, ${
              metric === "orders" ? `${total} orders` : formatFils(total)
            } in total`}
            className="mt-2 h-32 w-full"
          >
            {values.map((value, i) => {
              const h = max === 0 ? 0 : (value / max) * height;
              return (
                <rect
                  key={points[i].iso}
                  x={i * (barWidth + gap)}
                  y={height - h}
                  width={barWidth}
                  height={h}
                  rx={0.3}
                  className={metric === "orders" ? "fill-olive/70" : "fill-[#b55b29]/75"}
                >
                  {/* ONE string child. `{label}:{" "}{value}` is four children,
                      which React 19 refuses for <title> — the dashboard failed
                      hydration the moment a period contained an order. */}
                  <title>
                    {`${points[i].label}: ${metric === "orders" ? `${value} orders` : formatFils(value)}`}
                  </title>
                </rect>
              );
            })}
          </svg>
          <div className="mt-1 flex justify-between text-[11px] text-sage">
            <span>{points[0]?.label}</span>
            <span>{points[points.length - 1]?.label}</span>
          </div>
        </>
      )}
    </div>
  );
}

/** Order status distribution as a single proportional bar plus a key. */
export function StatusDistribution({
  counts,
  total,
}: {
  counts: { label: string; value: number; className: string }[];
  total: number;
}) {
  return (
    <div className="rounded-md border border-hairline/70 bg-white p-5">
      <h3 className="font-brand text-[10px] uppercase tracking-brand text-sage">
        Where orders are
      </h3>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-sage">
          Nothing in the workshop yet — order statuses will appear here.
        </p>
      ) : (
        <>
          <div
            className="mt-3 flex h-3 w-full overflow-hidden rounded-sm"
            role="img"
            aria-label={counts
              .filter((c) => c.value > 0)
              .map((c) => `${c.label}: ${c.value}`)
              .join(", ")}
          >
            {counts
              .filter((c) => c.value > 0)
              .map((c) => (
                <span
                  key={c.label}
                  className={c.className}
                  style={{ width: `${(c.value / total) * 100}%` }}
                />
              ))}
          </div>
          <ul className="mt-4 space-y-1.5">
            {counts
              .filter((c) => c.value > 0)
              .map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm">
                  <span className={`inline-block h-2.5 w-2.5 rounded-sm ${c.className}`} />
                  <span className="text-olive">{c.label}</span>
                  <span className="ml-auto tabular-nums text-sage">{c.value}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Period-over-period movement, shown only when there is a prior period. */
export function Comparison({
  currentFils,
  previousFils,
  days,
}: {
  currentFils: number;
  previousFils: number;
  days: number;
}) {
  if (previousFils === 0 && currentFils === 0) return null;

  if (previousFils === 0) {
    return (
      <p className="mt-1 text-xs text-sage">
        No revenue in the previous {days} days to compare against.
      </p>
    );
  }

  const change = ((currentFils - previousFils) / previousFils) * 100;
  const up = change >= 0;

  return (
    <p className="mt-1 text-xs text-sage">
      <span className={up ? "text-[#3d5636]" : "text-burgundy"}>
        {up ? "▲" : "▼"} {Math.abs(change).toFixed(0)}%
      </span>{" "}
      vs the previous {days} days
    </p>
  );
}
