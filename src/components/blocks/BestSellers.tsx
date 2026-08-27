import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { ProductCard } from "@/components/commerce/ProductCard";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getBestSellers } from "@/lib/data";

/** Same grammar as New Arrivals; the first tile is a 2x editorial moment. */
export function BestSellers() {
  const sellers = getBestSellers().slice(0, 4);

  return (
    <section className="section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal>
          <Eyebrow>Best Sellers</Eyebrow>
          <h2 className="display-2 mt-3 font-display font-light text-olive">
            Loved, week after week.
          </h2>
        </Reveal>
      </div>

      <Stagger className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-2 lg:mt-12 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-8 lg:pb-0">
        {/* Editorial tile — slow parallax + a quiet quote */}
        <StaggerItem className="w-[92%] shrink-0 snap-start sm:w-[46%] lg:col-span-2 lg:row-span-2 lg:w-auto">
          <div className="relative h-full min-h-[24rem] overflow-hidden rounded-media shadow-soft lg:min-h-0">
            <Parallax speed={0.92} className="absolute inset-[-8%]">
              <BotanicalPlaceholder seed="bestseller-editorial" palette="olive" />
            </Parallax>
            <div className="absolute inset-0 bg-olive/45" />
            <figure className="absolute inset-x-0 bottom-0 p-6 lg:p-10">
              <blockquote className="font-display text-2xl font-light italic leading-snug text-cream lg:text-4xl">
                &ldquo;The arrangements our couriers know by heart.&rdquo;
              </blockquote>
              <figcaption className="mt-3 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-cream/70">
                The Atelier
              </figcaption>
            </figure>
          </div>
        </StaggerItem>

        {sellers.map((product) => (
          <StaggerItem
            key={product.id}
            className="w-[92%] shrink-0 snap-start sm:w-[46%] lg:w-auto"
          >
            <ProductCard product={product} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
