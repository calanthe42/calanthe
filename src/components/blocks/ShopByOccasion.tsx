import Link from "next/link";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { occasions } from "@/lib/data";
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

export function ShopByOccasion() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal>
          <Eyebrow>Shop by Occasion</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-light text-olive lg:text-5xl">
            For every unspoken thing.
          </h2>
        </Reveal>

        <Stagger className="mt-8 grid auto-rows-[8.5rem] grid-cols-2 gap-3 sm:auto-rows-[10rem] lg:mt-12 lg:auto-rows-[12rem] lg:grid-cols-4 lg:gap-4">
          {occasions.map((occasion, i) => (
            <StaggerItem key={occasion.slug} className={cn(tileLayout[i])}>
              <Link
                href={`/occasions/${occasion.slug}`}
                className="group relative block h-full w-full overflow-hidden rounded-sm"
              >
                <Parallax speed={parallaxSpeeds[i] ?? 1} className="absolute inset-[-8%]">
                  <BotanicalPlaceholder
                    seed={occasion.image.placeholder.seed}
                    palette={occasion.image.placeholder.palette}
                  />
                </Parallax>
                <span className="absolute inset-0 bg-olive/35 transition-colors duration-300 ease-bloom group-hover:bg-olive/55" />
                <span className="absolute inset-0 flex items-center justify-center px-2 text-center">
                  <span className="font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-cream transition-[letter-spacing] duration-300 ease-bloom group-hover:tracking-[0.28em] sm:text-sm lg:text-base">
                    {occasion.name}
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
