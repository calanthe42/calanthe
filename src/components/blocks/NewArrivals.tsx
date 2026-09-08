import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getNewArrivals } from "@backend/data/products";

export async function NewArrivals() {
  const arrivals = await getNewArrivals(4);

  return (
    <section className="section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal>
          <Eyebrow>New Arrivals</Eyebrow>
          <h2 className="display-2 mt-3 font-display font-light text-olive">
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
