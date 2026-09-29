import Image from "next/image";
import { cn } from "@/lib/cn";

export type OrchidPlacement = {
  /** Which of the three orchids cut from the client's wallpaper. */
  orchid: "a" | "b" | "c";
  /** Position and width: `left-[x%] top-[y%] w-[..rem]`, centred on the point. */
  className: string;
  /** Strongest opacity, reached mid-screen. */
  peak?: number;
};

/**
 * The wallpaper, in parts — orchids that open and close with the scroll.
 *
 * Each orchid (cream linework from the client's wallpaper, fading to
 * nothing at its edges) opens as it rises into view — fading up, turning a
 * few degrees, settling from 88% — holds while it is mid-screen, and closes
 * as it leaves. Scroll back and it opens again: the motion is the scroll,
 * not a one-off reveal.
 *
 * No JavaScript. It is a CSS scroll-driven animation (`animation-timeline:
 * view()`, see `.orchid-bloom` in globals.css): Chrome, Edge and Safari 26
 * scrub it on the compositor; a browser without it, or a visitor who asked
 * for reduced motion, sees the orchids resting, still and softer.
 * Transform and opacity only. Decorative, so hidden from assistive tech.
 *
 * Place it first inside a `relative overflow-hidden` section, before the
 * content, so the content paints over it.
 */
export function OrchidBloom({
  orchids,
  className,
}: {
  orchids: readonly OrchidPlacement[];
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {orchids.map((o) => (
        <div
          key={`${o.orchid}-${o.className}`}
          className={cn("absolute -translate-x-1/2 -translate-y-1/2", o.className)}
        >
          <div
            className="orchid-bloom"
            style={{ "--orchid-peak": o.peak ?? 0.75 } as React.CSSProperties}
          >
            <Image
              src={`/brand/print/orchid-${o.orchid}.webp`}
              alt=""
              width={640}
              height={640}
              sizes="20rem"
              className="h-auto w-full"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
