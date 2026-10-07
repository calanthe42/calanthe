import Image from "next/image";
import { getDictionary } from "@/lib/i18n/server";
import { Parallax } from "@/components/motion/Parallax";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { cn } from "@/lib/cn";

/**
 * THE THREE PIECES — the brand's own packaging, cut out of the client's
 * identity book (the October 2026 deck, pp. 15–16): the burgundy bag, the
 * olive bag and the terracotta sleeve, each holding its pastel bouquet.
 *
 * They stand on one baseline at their true relative size, the way the deck
 * lines them up: the two bags alike, the sleeve a little smaller. The
 * bouquets spread wider than the paper beneath them, so the boxes overlap
 * by exactly that spread and the paper bodies keep an even gap. Widths and
 * the two negative margins sum to 100% of the column at every width, so the
 * group fills it and can never push the page sideways. In Arabic the row
 * mirrors; the pictures do not, because the wordmark is printed on them.
 *
 * The pictures are TRANSPARENT cut-outs at the deck's native resolution, so
 * they stand on whatever ground the section has — never a flattened photo.
 * A soft contact shadow under each body grounds them; without it they
 * float. MOTION: the house stagger, once; a very slight drift on desktop.
 *
 * `withTag` leans the cream orchid tag against the front of the row — the
 * fourth piece a customer receives.
 */

const PIECES = [
  {
    src: "/brand/packaging/bag-burgundy.webp",
    altKey: "packagingBurgundy",
    width: 1312,
    height: 1624,
    className: "relative z-0 w-[40%]",
    /* The paper body spans roughly 12%–88% of the picture. */
    shadow: "left-[14%] right-[14%]",
    speed: 0.97,
  },
  {
    src: "/brand/packaging/bag-olive.webp",
    altKey: "packagingOlive",
    width: 1384,
    height: 1714,
    className: "relative z-10 -ms-[6%] w-[42%]",
    shadow: "left-[14%] right-[14%]",
    speed: 1,
  },
  {
    src: "/brand/packaging/sleeve-terracotta.webp",
    altKey: "packagingTerracotta",
    width: 1134,
    height: 1592,
    className: "relative z-0 -ms-[6%] w-[30%]",
    shadow: "left-[26%] right-[26%]",
    speed: 0.95,
  },
] as const;

export async function PackagingTrio({
  className,
  withTag = false,
}: {
  className?: string;
  withTag?: boolean;
}) {
  const { t } = await getDictionary();

  return (
    <div className={cn("relative", className)}>
      <Stagger className="flex items-end justify-center pb-2">
        {PIECES.map((piece) => (
          <StaggerItem key={piece.src} className={piece.className}>
            <Parallax speed={piece.speed} desktopOnly>
              <div className="relative">
                <span
                  aria-hidden
                  className={`absolute -bottom-1.5 h-3 rounded-[50%] bg-olive/25 blur-[6px] ${piece.shadow}`}
                />
                <Image
                  src={piece.src}
                  alt={t.alt[piece.altKey]}
                  width={piece.width}
                  height={piece.height}
                  sizes="(max-width: 1024px) 42vw, 22vw"
                  quality={90}
                  className="relative h-auto w-full"
                />
              </div>
            </Parallax>
          </StaggerItem>
        ))}
      </Stagger>

      {withTag ? (
        /* The tag rests against the front of the row, tipped a little, as a
           tag that has just been set down does. Decorative here: the tag is
           described where it is shown on its own. */
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 start-[6%] z-20 block w-[20%] -rotate-6 drop-shadow-[0_6px_10px_rgba(43,47,27,0.22)] rtl:rotate-6"
        >
          <Image
            src="/brand/packaging/tag-cream.webp"
            alt=""
            width={928}
            height={848}
            sizes="(max-width: 1024px) 20vw, 10vw"
            quality={90}
            className="h-auto w-full"
          />
        </span>
      ) : null}
    </div>
  );
}
