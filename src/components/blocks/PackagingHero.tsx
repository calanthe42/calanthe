import Image from "next/image";
import { OrchidPrint } from "@/components/ui/OrchidPrint";
import { cn } from "@/lib/cn";

/**
 * THE BAG, ON THE BRAND'S PAPER.
 *
 * The olive bag with its pastel bouquet and the orchid tag hanging from the
 * handle — the piece the identity book opens its packaging chapter with
 * (October 2026 deck, p.12) — standing on a sheet of the brand's own paper:
 * cream, printed tone on tone with the orchid, a soft contact shadow under
 * the body.
 *
 * It is composed here rather than delivered as a flattened photograph so
 * that the cut-out stays at the deck's native resolution on every screen
 * and the paper is always the page's own colour. 4:5, like a portrait.
 */
export function PackagingHero({
  alt,
  ground = "cream",
  sizes = "(max-width: 1024px) 92vw, 46vw",
  className,
}: {
  alt: string;
  ground?: "cream" | "canvas";
  sizes?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex aspect-[4/5] w-full items-end justify-center overflow-hidden rounded-media",
        ground === "cream" ? "bg-cream" : "bg-canvas",
        className,
      )}
    >
      <OrchidPrint ground={ground} />
      <div className="relative mb-[7%] w-[82%]">
        <span
          aria-hidden
          className="absolute -bottom-[1.2%] left-[12%] right-[12%] h-[3.5%] rounded-[50%] bg-olive/30 blur-[10px]"
        />
        <Image
          src="/brand/packaging/bag-olive-tag.webp"
          alt={alt}
          width={1554}
          height={1926}
          sizes={sizes}
          quality={90}
          className="relative h-auto w-full"
        />
      </div>
    </div>
  );
}
