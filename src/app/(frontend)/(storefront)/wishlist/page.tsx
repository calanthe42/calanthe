import type { Metadata } from "next";
import { WishlistPageClient } from "@/components/commerce/WishlistPageClient";
import { getAvailableProducts } from "@backend/data/products";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    robots: { index: false },
    title: t.meta.wishlist,
  };
}

export default async function WishlistPage() {
  const [products, { t }] = await Promise.all([getAvailableProducts(), getDictionary()]);

  return (
    <main className="mx-auto max-w-7xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>{t.wishlist.eyebrow}</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          {t.wishlist.title}
        </h1>
      </Reveal>
      <WishlistPageClient products={products} />
    </main>
  );
}
