import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { ProductCard } from "@/components/commerce/ProductCard";
import { CatalogueEmpty } from "@/components/blocks/CatalogueEmpty";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getNewArrivals } from "@backend/data/products";
import { getDictionary } from "@/lib/i18n/server";

export async function NewArrivals() {
  const [arrivals, { t }] = await Promise.all([getNewArrivals(4), getDictionary()]);

  return (
    <section className="section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal>
          <Eyebrow>{t.sections.newArrivalsEyebrow}</Eyebrow>
          <h2 className="display-2 mt-3 font-display font-light text-olive">
            {t.sections.newArrivalsTitle}
          </h2>
        </Reveal>
      </div>

      {arrivals.length === 0 ? (
        /* No arrangement is published yet. A titled row with nothing under
           it read as a broken page; this is the atelier's own answer
           instead — order bespoke, or ask a florist. */
        <div className="mx-auto mt-8 max-w-7xl gutter lg:mt-12">
          <CatalogueEmpty />
        </div>
      ) : (
        /* Mobile: scroll-snap row with next-card peek · Desktop: 4-up grid */
        <Stagger className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-2 lg:mt-12 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-8 lg:pb-0">
          {arrivals.map((product) => (
            <StaggerItem
              key={product.id}
              className="w-[92%] shrink-0 snap-start sm:w-[46%] lg:w-auto"
            >
              <ProductCard product={product} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}
