import { cn } from "@/lib/cn";

/**
 * THE BRAND'S OWN SURFACE — the client's orchid wallpaper.
 *
 * The identity prints one texture on everything it owns: the orchid, drawn
 * as line art and repeated as a wallpaper, printed tone on tone — on the
 * paper bags, the terracotta sleeve and the booth's panels. The brand book
 * asks for exactly that: "large-scale floral illustrations · tone-on-tone
 * application for a subtle and premium look · used as a full-surface visual
 * texture". This replaces the lily line drawing that stood in for it before
 * the wallpaper file existed.
 *
 * It is the wallpaper itself, rendered from the client's vector file and
 * baked onto each ground it is used on (olive lines at about 5% on the
 * page colour or on cream), so it costs one small tiled image (~25 KB) and
 * no work at runtime. The tile's own ground IS the section's colour, so it
 * can be cropped or faded anywhere without a seam.
 *
 * Put it first inside a `relative isolate` section; it sits at -z-10 behind
 * everything and never animates. Decorative, so hidden from assistive tech.
 */
const GROUNDS = {
  /* The page colour (#F3EFDF). */
  canvas: "bg-[url(/brand/print/orchid-canvas.webp)]",
  /* Warm cream (#E4DCC5). */
  cream: "bg-[url(/brand/print/orchid-cream.webp)]",
} as const;

export function OrchidPrint({
  ground,
  className,
}: {
  ground: keyof typeof GROUNDS;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 bg-[length:30rem_auto] bg-repeat lg:bg-[length:42rem_auto]",
        GROUNDS[ground],
        className,
      )}
    />
  );
}
