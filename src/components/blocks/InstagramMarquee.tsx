import { FloralImage } from "@/components/ui/FloralImage";
import { instagramTiles, CONTACT } from "@/lib/data";
import { cn } from "@/lib/cn";

function MarqueeRow({
  tiles,
  reverse = false,
  className,
}: {
  tiles: readonly (typeof instagramTiles)[number][];
  reverse?: boolean;
  className?: string;
}) {
  /* Content duplicated once; the track translates -50% for a seamless loop. */
  const doubled = [...tiles, ...tiles];

  return (
    <div className={cn("group overflow-hidden", className)}>
      <div
        className={cn(
          "marquee-track flex w-max gap-3 lg:gap-4",
          reverse && "marquee-reverse",
        )}
      >
        {doubled.map((tile, i) => (
          <div
            key={`${tile.placeholder.seed}-${i}`}
            className="aspect-square w-36 shrink-0 overflow-hidden rounded-media lg:w-44"
            aria-hidden={i >= tiles.length}
          >
            <FloralImage image={tile} sizes="176px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InstagramMarquee() {
  const rowA = instagramTiles.slice(0, 6);
  const rowB = instagramTiles.slice(6, 12);

  return (
    <section className="overflow-hidden section-pad">
      <a
        href={CONTACT.instagramHref}
        target="_blank"
        rel="noreferrer"
        className="mb-8 block text-center font-brand text-xs font-medium uppercase tracking-brand text-olive transition-opacity duration-200 ease-bloom hover:opacity-60 lg:mb-10"
      >
        {CONTACT.instagramHandle}
      </a>
      <div className="flex flex-col gap-3 lg:gap-4">
        <MarqueeRow tiles={rowA} />
        <MarqueeRow tiles={rowB} reverse className="hidden sm:block" />
      </div>
    </section>
  );
}
