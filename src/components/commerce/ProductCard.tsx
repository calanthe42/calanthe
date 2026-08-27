import Link from "next/link";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { cn } from "@/lib/cn";
import { formatAed, type Product } from "@/lib/data";

type ProductCardProps = {
  product: Product;
  className?: string;
};

/**
 * 4:5 image with ClipReveal entrance; on devices with hover the second
 * image crossfades in. Wishlist heart is a 44px target.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const [front, back] = product.images;

  return (
    <article className={cn("group relative", className)}>
      <Link href={`/shop/${product.slug}`} aria-label={product.name} className="block">
        <ClipReveal className="relative aspect-[4/5] w-full rounded-sm">
          <div className="relative h-full w-full">
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
      </Link>

      <WishlistButton
        productId={product.id}
        productName={product.name}
        className="absolute right-1 top-1 text-cream"
      />
    </article>
  );
}
