import type { Metadata } from "next";
import { Reveal } from "@/components/motion/Reveal";
import { ShopGrid } from "@/components/commerce/ShopGrid";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { products } from "@/lib/data";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Hand-composed arrangements from the Calanthe atelier — same-day delivery across the UAE.",
};

export default function ShopPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-20">
      <Reveal className="mb-10 max-w-2xl lg:mb-14">
        <Eyebrow>The Collection</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-[1.08] text-olive lg:text-6xl">
          Composed this morning, at your door today.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-sage">
          Every arrangement is built stem by stem in the atelier — no two ever quite the
          same.
        </p>
      </Reveal>

      <ShopGrid products={products} />
    </main>
  );
}
