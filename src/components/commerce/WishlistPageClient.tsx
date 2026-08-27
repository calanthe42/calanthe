"use client";

import Link from "next/link";
import { ProductCard } from "@/components/commerce/ProductCard";
import { buttonClasses } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { products } from "@/lib/data";
import { useWishlist } from "@/lib/wishlist";

export function WishlistPageClient() {
  const { ids } = useWishlist();
  const saved = products.filter((p) => ids.includes(p.id));

  if (saved.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-24 text-center">
        <Monogram className="w-14 text-sage" />
        <p className="max-w-sm font-display text-2xl font-light italic text-olive">
          Hearts you leave here never wilt.
        </p>
        <p className="max-w-xs text-sm text-sage">
          Tap the heart on any arrangement to keep it close.
        </p>
        <Link href="/shop" className={buttonClasses("secondary")}>
          Shop Flowers
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12">
      {saved.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
