import type { Metadata } from "next";
import { WishlistPageClient } from "@/components/commerce/WishlistPageClient";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false },
};

export default function WishlistPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-20">
      <Reveal className="mb-10">
        <Eyebrow>Kept Close</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light text-olive lg:text-5xl">
          Wishlist
        </h1>
      </Reveal>
      <WishlistPageClient />
    </main>
  );
}
