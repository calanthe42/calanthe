"use client";

import { useRef } from "react";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { TransitionLink } from "@/components/motion/TransitionLink";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { cn } from "@/lib/cn";
import { formatAed, type Product } from "@/lib/data";

type ProductCardProps = {
  product: Product;
  className?: string;
  /** Editorial (2x) tiles use a wider image crop. */
  editorial?: boolean;
};

/**
 * 4:5 image with ClipReveal entrance; on devices with hover the second
 * image crossfades in. Wishlist heart is a 44px target.
 */
export function ProductCard({ product, className, editorial = false }: ProductCardProps) {
  const [front, back] = product.images;
  const imageRef = useRef<HTMLDivElement>(null);

  return (
    <article className={cn("group relative", className)}>
      <TransitionLink
        href={`/product/${product.slug}`}
        aria-label={product.name}
        className="block"
        onClick={() => {
          /* Only the clicked card carries the morph name — products can
             appear in several sections, and duplicate names abort the
             view transition. */
          if (imageRef.current) {
            imageRef.current.style.viewTransitionName = "product-hero";
          }
        }}
      >
        <ClipReveal
          className={cn(
            "relative w-full rounded-sm",
            editorial ? "aspect-[4/3] lg:aspect-[8/5]" : "aspect-[4/5]",
          )}
        >
          <div ref={imageRef} className="relative h-full w-full">
            <BotanicalPlaceholder
              seed={front.placeholder.seed}
              palette={front.placeholder.palette}
            />
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 ease-bloom group-hover:opacity-100">
              <BotanicalPlaceholder
                seed={back.placeholder.seed}
                palette={back.placeholder.palette}
              />
            </div>
          </div>
        </ClipReveal>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-xl font-normal text-olive">{product.name}</h3>
          <p className="shrink-0 text-base text-sage">{formatAed(product.priceAed)}</p>
        </div>
      </TransitionLink>

      <WishlistButton
        productId={product.id}
        productName={product.name}
        className="absolute right-1 top-1 text-cream"
      />
    </article>
  );
}
