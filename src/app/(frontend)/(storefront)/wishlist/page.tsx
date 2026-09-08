import type { Metadata } from "next";
import { WishlistPageClient } from "@/components/commerce/WishlistPageClient";
import { getAvailableProducts } from "@backend/data/products";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false },
};

export default async function WishlistPage() {
  const products = await getAvailableProducts();

  return (
    <main className="mx-auto max-w-7xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>Kept Close</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">Wishlist</h1>
      </Reveal>
      <WishlistPageClient products={products} />
    </main>
  );
}
