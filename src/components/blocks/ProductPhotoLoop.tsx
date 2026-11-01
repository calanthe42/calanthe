"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FloralImage } from "@/components/ui/FloralImage";
import type { ProductImage } from "@/lib/data";
import { cn } from "@/lib/cn";

export type LoopPhoto = { image: ProductImage; name: string; href: string };

/* Long enough to look at an arrangement; the crossfade itself is slow. The
   drift and the hairline last exactly this long, so neither is cut short. */
const HOLD_MS = 5200;

/**
 * The shop's own arrangements, one after another, in the photograph slot of
 * the "made to order" moment — so the owner never has to choose a stock
 * picture for it: whatever she photographs for her products appears here.
 *
 * One slow crossfade with a gentle drift (opacity and transform only), the
 * arrangement's name in the corner linking to it, and a hairline that fills
 * while each photograph holds.
 *
 * IT STOPS WHEN SOMEONE REACHES FOR IT: pointer over it or focus inside it
 * holds the current photograph, so the name being tapped is the arrangement
 * that opens. It also waits while the tab is hidden, and with reduced motion
 * it shows the first photograph and stays still.
 *
 * Only the photographs shown so far and the next one are mounted, so a
 * visitor who never watches the loop downloads two, not six.
 */
export function ProductPhotoLoop({ photos, sizes }: { photos: LoopPhoto[]; sizes: string }) {
  const [index, setIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const [still, setStill] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const moving = !still && !held && photos.length > 1;

  useEffect(() => {
    if (!moving) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((i) => (i + 1) % photos.length);
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, [moving, photos.length]);

  useEffect(() => {
    setReached((r) => Math.max(r, index));
  }, [index]);

  const current = photos[index] ?? photos[0];

  return (
    <div
      className="absolute inset-0"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {photos.map((photo, i) =>
        (still ? i === 0 : i <= reached + 1) ? (
          <div
            key={photo.image.src ?? i}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-opacity duration-[1600ms] ease-bloom motion-reduce:transition-none",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            <div
              className={cn(
                "relative h-full w-full motion-reduce:animate-none",
                i === index && !still && photos.length > 1 && "animate-[loop-drift_5200ms_var(--ease-bloom)_forwards]",
              )}
            >
              <FloralImage image={photo.image} sizes={sizes} priority={i === 0} />
            </div>
          </div>
        ) : null,
      )}

      {current ? (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 lg:p-6">
          <Link
            href={current.href}
            className="inline-flex min-h-11 items-center rounded-sm bg-olive/85 px-4 font-brand text-xs uppercase tracking-brand text-cream transition-colors duration-300 ease-bloom hover:bg-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
          >
            {current.name}
          </Link>
          {moving ? (
            <span aria-hidden className="mb-2 block h-px w-16 overflow-hidden bg-cream/40 motion-reduce:hidden">
              <span
                key={index}
                className="block h-full w-full origin-left bg-cream animate-[loop-hold_5200ms_linear_forwards] rtl:origin-right"
              />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
