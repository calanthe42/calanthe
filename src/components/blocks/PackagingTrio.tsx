import Image from "next/image";
import { getDictionary } from "@/lib/i18n/server";
import { Parallax } from "@/components/motion/Parallax";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

/**
 * THE THREE PIECES — the brand's own packaging, cut out of the client's
 * packaging slide: the terracotta sleeve, the burgundy bag and the olive
 * bag, each with its arrangement standing in it.
 *
 * They stand in the slide's order, at their true relative size, on one
 * baseline — the way the atelier presents them. The earlier version set
 * them at three different sizes for depth, which made two identical bags
 * read as a small and a large; these are one bag in two colours and a
 * sleeve, and the line-up says so.
 *
 * THE OVERLAP. Each bouquet spreads wider than the paper beneath it, so the
 * boxes overlap by exactly the spread and the paper bodies keep an even gap
 * — bouquets touch, bags never do, as on a counter. The widths and the two
 * negative margins sum to 100% of the column at every width, so the group
 * fills it and can never push the page sideways. In Arabic the row mirrors;
 * the pictures do not, because the wordmark is printed on them.
 *
 * A soft contact shadow under each body grounds the cut-outs on the page;
 * without it they float. MOTION: the house stagger, once; a very slight
 * drift on desktop only. Reduced motion falls back to a fade in the
 * primitives themselves.
 */

const BAGS = [
  {
    src: "/brand/packaging/sleeve-terracotta.webp",
    altKey: "packagingTerracotta",
    width: 389,
    height: 545,
    className: "relative z-0 w-[35.9%]",
    /* The sleeve's paper spans 29%–73% of its picture. */
    shadow: "left-[27%] right-[25%]",
    speed: 0.97,
  },
  {
    src: "/brand/packaging/bag-burgundy.webp",
    altKey: "packagingBurgundy",
    width: 449,
    height: 555,
    className: "relative z-10 -ms-[11.4%] w-[41.5%]",
    shadow: "left-[8%] right-[12%]",
    speed: 1,
  },
  {
    src: "/brand/packaging/bag-olive.webp",
    altKey: "packagingOlive",
    width: 448,
    height: 552,
    className: "relative z-0 -ms-[7.4%] w-[41.4%]",
    shadow: "left-[8%] right-[12%]",
    speed: 0.95,
  },
] as const;

export async function PackagingTrio({ className }: { className?: string }) {
  const { t } = await getDictionary();

  return (
    <div className={className}>
      <Stagger className="flex items-end justify-center pb-2">
        {BAGS.map((bag) => (
          <StaggerItem key={bag.src} className={bag.className}>
            <Parallax speed={bag.speed} desktopOnly>
              <div className="relative">
                <span
                  aria-hidden
                  className={`absolute -bottom-1.5 h-3 rounded-[50%] bg-olive/25 blur-[6px] ${bag.shadow}`}
                />
                <Image
                  src={bag.src}
                  alt={t.alt[bag.altKey]}
                  width={bag.width}
                  height={bag.height}
                  sizes="(max-width: 1024px) 42vw, 20vw"
                  className="relative h-auto w-full"
                />
              </div>
            </Parallax>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
