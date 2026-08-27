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

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; flower?: string; price?: string }>;
}) {
  const { q = "", flower = "", price = "" } = await searchParams;

  return (
    <main className="mx-auto max-w-7xl gutter section-pad">
      <Reveal className="mb-10 max-w-2xl lg:mb-14">
        <Eyebrow>The Collection</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          Composed this morning, at your door today.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-sage">
          Every arrangement is built stem by stem in the atelier — no two ever quite the
          same.
        </p>
      </Reveal>

      <ShopGrid
        products={products}
        initialQuery={q}
        initialFlower={flower}
        initialPrice={price}
      />
    </main>
  );
}
