import Link from "next/link";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { FloralImage } from "@/components/ui/FloralImage";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getActiveOccasions } from "@backend/data/occasions";
import { cn } from "@/lib/cn";

/* Bento shapes per tile, in the client's exact order. */
const tileLayout = [
  /* Birthday — large square */
  "col-span-2 row-span-2 lg:col-span-2 lg:row-span-2",
  /* Congratulations — wide */
  "col-span-1 row-span-1 lg:col-span-2 lg:row-span-1",
  /* New Baby — small */
  "col-span-1 row-span-1 lg:col-span-1 lg:row-span-1",
  /* Love — small */
  "col-span-1 row-span-1 lg:col-span-1 lg:row-span-1",
  /* Just Because — pairs with Love on mobile, full-width band on desktop */
  "col-span-1 row-span-1 lg:col-span-4 lg:row-span-1",
] as const;

const parallaxSpeeds = [0.9, 1, 1.1, 0.9, 1.1] as const;

export async function ShopByOccasion() {
  const occasions = await getActiveOccasions();
  return (
    <section className="section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal>
          <Eyebrow>Shop by Occasion</Eyebrow>
          <h2 className="display-2 mt-3 font-display font-light text-olive">
            For every unspoken thing.
          </h2>
        </Reveal>

        <Stagger className="mt-8 grid auto-rows-[8.5rem] grid-cols-2 gap-3 sm:auto-rows-[10rem] lg:mt-12 lg:auto-rows-[12rem] lg:grid-cols-4 lg:gap-4">
          {occasions.map((occasion, i) => (
            <StaggerItem key={occasion.slug} className={cn(tileLayout[i])}>
              <Link
                href={`/occasions/${occasion.slug}`}
                className="group relative block h-full w-full overflow-hidden rounded-media shadow-soft"
              >
                <Parallax speed={parallaxSpeeds[i] ?? 1} className="absolute inset-[-8%]">
                  <FloralImage
                    image={occasion.image}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </Parallax>
                {/* A gradient anchored at the bottom, not a flat wash
                    over the whole tile: the photograph keeps its own
                    colour and light up top and the label sits on a dark
                    base. The flat olive/35 overlay was what made this
                    grid read as one grey-green block. */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-olive/85 via-olive/25 to-olive/5 transition-opacity duration-500 ease-bloom group-hover:opacity-85"
                />
                {/* Label bottom-left, the lead tile carrying larger type
                    — hierarchy between tiles instead of five identical
                    centred captions. */}
                <span className="absolute inset-x-0 bottom-0 flex items-end p-4 lg:p-5">
                  <span className="flex flex-col gap-1.5">
                    <span
                      className={cn(
                        "font-brand font-medium uppercase tracking-brand text-cream transition-[letter-spacing] duration-300 ease-bloom group-hover:tracking-[0.26em]",
                        i === 0
                          ? "text-sm lg:text-lg"
                          : "text-[0.6875rem] lg:text-[0.8125rem]",
                      )}
                    >
                      {occasion.name}
                    </span>
                    <span
                      aria-hidden
                      className="h-px w-0 bg-burnt-orange transition-all duration-500 ease-bloom group-hover:w-10"
                    />
                  </span>
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
