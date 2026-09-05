import Image from "next/image";
import { cn } from "@/lib/cn";

/** Native size of the client's stacked lockup artwork. */
export const STACKED_RATIO = 1081 / 719;

type StackedLogoProps = {
  /**
   * Which colourway shows. Both files are always rendered, stacked
   * pixel-for-pixel, so the change between them is a cross-dissolve
   * rather than a swap — `HeroLogoDock` scrubs these same two layers
   * directly from scroll position.
   */
  tone?: "cream" | "olive";
  className?: string;
  priority?: boolean;
  sizes?: string;
};

/**
 * The real Calanthe stacked lockup (Calanthe_Final Files/PNG/
 * Stacked_Warm Cream.png + Stacked_Deep Olive.png), not a redrawn one.
 * Size it by setting a width on the wrapper — the aspect ratio is
 * fixed to the artwork's own 1081×719.
 */
export function StackedLogo({
  tone = "cream",
  className,
  priority,
  sizes,
}: StackedLogoProps) {
  return (
    <span
      data-tone={tone}
      className={cn("stacked-logo relative block aspect-[1081/719]", className)}
    >
      <Image
        src="/brand/stacked-warm-cream.png"
        alt=""
        width={1081}
        height={719}
        priority={priority}
        sizes={sizes}
        className="stacked-cream absolute inset-0 h-full w-full object-contain"
      />
      <Image
        src="/brand/stacked-deep-olive.png"
        alt=""
        width={1081}
        height={719}
        priority={priority}
        sizes={sizes}
        className="stacked-olive absolute inset-0 h-full w-full object-contain"
      />
    </span>
  );
}
