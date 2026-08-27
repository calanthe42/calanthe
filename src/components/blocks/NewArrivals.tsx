import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getNewArrivals } from "@/lib/data";

export function NewArrivals() {
  const arrivals = getNewArrivals().slice(0, 4);

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <Reveal>
          <Eyebrow>New Arrivals</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-light text-olive lg:text-5xl">
            Fresh from the atelier.
          </h2>
        </Reveal>
      </div>

      {/* Mobile: scroll-snap row with next-card peek · Desktop: 4-up grid */}
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
    </section>
  );
}
