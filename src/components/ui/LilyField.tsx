import { cn } from "@/lib/cn";

/**
 * THE BRAND'S OWN SURFACE.
 *
 * Calanthe's identity has one device the website never had: the lily, drawn
 * as line art, blown up far past its own frame, cropped hard by the edges and
 * printed TONE ON TONE — olive on olive, cream on cream. It is on the paper
 * bags, debossed into the greeting cards, embossed on the booth's panels. The
 * brand book is explicit about how it behaves: "large-scale, cropped floral
 * illustrations · tone-on-tone application for a subtle and premium look ·
 * used as a full-surface visual texture · balanced with minimal logo
 * placement."
 *
 * So this is not decoration invented for a web page — it is the one surface
 * the brand already owns, and putting it behind the consultation is what
 * makes the screen feel like the shop's own paper rather than a form.
 *
 * DISCIPLINE. It is a single inline SVG (no request, no image weight), it
 * paints at a few percent opacity so type over it stays at full contrast, it
 * is `aria-hidden` and it never animates by itself — the page's own reveals
 * are the only movement. `currentColor` carries the tone, so a cream section
 * and an olive section use the same component.
 */
export function LilyField({
  className,
  opacity = 0.055,
}: {
  className?: string;
  /** Tone-on-tone means barely there. Above ~0.08 it starts to compete. */
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      className={cn("pointer-events-none select-none", className)}
      style={{ opacity }}
    >
      {/* Six petals around a centre, each drawn as two long curves meeting at
          a point — the lily's silhouette, not a botanical study. */}
      <g transform="translate(200 210)">
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <path d="M0 0C-26 -34 -34 -74 -16 -122C-8 -144 -2 -156 0 -168C2 -156 8 -144 16 -122C34 -74 26 -34 0 0Z" />
            {/* The midrib, and the two veins that make a petal read as paper. */}
            <path d="M0 -8V-150" strokeWidth="0.7" />
            <path d="M0 -40C-9 -62 -12 -90 -7 -118" strokeWidth="0.55" />
            <path d="M0 -40C9 -62 12 -90 7 -118" strokeWidth="0.55" />
          </g>
        ))}

        {/* Stamens: six filaments from the throat, each tipped with an anther. */}
        {[-38, -22, -7, 7, 22, 38].map((angle, i) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <path d={`M0 -4C${i % 2 ? 6 : -6} -30 ${i % 2 ? 9 : -9} -58 ${i % 2 ? 5 : -5} -${78 + (i % 3) * 9}`} strokeWidth="0.8" />
            <ellipse
              cx={i % 2 ? 5 : -5}
              cy={-(82 + (i % 3) * 9)}
              rx="4.6"
              ry="2.3"
              transform={`rotate(${i % 2 ? 18 : -18} ${i % 2 ? 5 : -5} ${-(82 + (i % 3) * 9)})`}
              strokeWidth="0.8"
            />
          </g>
        ))}

        {/* The stem, leaving the frame at the foot. */}
        <path d="M0 0C1 40 -1 84 2 132C4 168 6 200 6 240" strokeWidth="1.3" />
        {/* Two leaves off the stem, long and turned. */}
        <path d="M2 74C-26 66 -54 82 -72 116C-44 124 -14 112 2 74Z" />
        <path d="M3 128C29 122 56 140 71 174C44 180 17 166 3 128Z" />
      </g>
    </svg>
  );
}
