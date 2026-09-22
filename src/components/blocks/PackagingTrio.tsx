import Image from "next/image";
import { Parallax } from "@/components/motion/Parallax";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { LilyField } from "@/components/ui/LilyField";

/**
 * THE THREE BAGS — the brand's own packaging, photographed and cut out.
 *
 * This section is about craft: arranged, wrapped, delivered. Until now it
 * illustrated that with a stock photograph of somebody else's roses, hidden
 * below 1024px, which is the opposite of showing the work. Calanthe's
 * identity already contains the strongest possible picture of "wrapped" —
 * the olive, burgundy and terracotta paper bags, each with an arrangement
 * standing in it, shot as cut-outs with no background.
 *
 * So they stand on the page's own cream, at three sizes, overlapping the way
 * they would on a counter. No cards, no frames, no drop shadows: the brand
 * prints tone-on-tone on paper, and cut-outs on canvas are that idea on a
 * screen. Behind them the lily linework, at a few percent, is the same
 * surface the bags themselves are printed with.
 *
 * MOTION. One idea: they rise and settle, 90ms apart, once, at 80% of the
 * viewport — the house stagger, nothing invented here. The drift as you
 * scroll past is desktop-only and very slight (the tallest bag moves least,
 * so the group reads as depth rather than as three separate animations).
 * Under reduced motion the primitives fall back to a plain fade on their
 * own; nothing here needs to know about it.
 */

const BAGS = [
  {
    src: "/brand/bag-terracotta.webp",
    alt: "A Calanthe terracotta carrier holding white lisianthus and calla lilies",
    width: 900,
    height: 1320,
    /* Smallest, set low and behind — the one that starts the group. */
    className: "relative z-0 w-[35%] translate-y-[10%]",
    speed: 0.97,
  },
  {
    src: "/brand/bag-olive.webp",
    alt: "A Calanthe olive paper bag, printed tone on tone, holding a full autumn arrangement",
    width: 1000,
    height: 1195,
    /* The tallest, centre, in front: the one the eye lands on. */
    className: "relative z-20 -ms-[10%] w-[47%]",
    speed: 1,
  },
  {
    src: "/brand/bag-burgundy.webp",
    alt: "A Calanthe burgundy bag with its lily hang tag, holding roses and dahlias",
    width: 847,
    height: 1031,
    className: "relative z-10 -ms-[12%] w-[39%] translate-y-[6%]",
    speed: 0.94,
  },
] as const;

export function PackagingTrio({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="relative isolate">
        {/* The surface they are printed on, cropped hard by the frame. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <LilyField
            opacity={0.06}
            className="absolute -bottom-[45%] start-[-30%] w-[150%] text-olive rtl:-scale-x-100"
          />
        </div>

        {/* OVERLAPPING, as they would stand on a counter. The widths and the
            two negative margins sum to 99% of the column, so the group fills
            it at every width and can never push the page sideways; the
            olive bag sits in front, the terracotta behind. */}
        <Stagger className="flex items-end justify-center">
          {BAGS.map((bag) => (
            <StaggerItem key={bag.src} className={bag.className}>
              <Parallax speed={bag.speed} desktopOnly>
                <Image
                  src={bag.src}
                  alt={bag.alt}
                  width={bag.width}
                  height={bag.height}
                  sizes="(max-width: 1024px) 50vw, 18vw"
                  className="h-auto w-full"
                />
              </Parallax>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
