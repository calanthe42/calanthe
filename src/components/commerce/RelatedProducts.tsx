import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import type { Product } from "@/lib/data";

/**
 * The row beneath a product. Uses the same card grammar as the homepage
 * rows — mobile scroll-snap with a next-card peek, four-up on desktop —
 * so a customer who scrolls past one arrangement meets the next in a
 * shape she already knows.
 *
 * Renders nothing at all when there is nothing to show. An empty
 * "You may also like" heading over blank space is worse than silence.
 */
export function RelatedProducts({ products }: { products: readonly Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="border-t border-hairline section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal>
          <Eyebrow>Also from the atelier</Eyebrow>
          <h2 className="display-2 mt-3 font-display font-light text-olive">
            Composed in the same spirit.
          </h2>
        </Reveal>
      </div>

      <Stagger className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-2 lg:mx-auto lg:mt-12 lg:grid lg:max-w-7xl lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-8 lg:pb-0">
        {products.map((product) => (
          <StaggerItem
            key={product.id}
            className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-auto"
          >
            <ProductCard product={product} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
