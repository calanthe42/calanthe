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
 * Server component: 4:5 ClipReveal image with hover crossfade; the
 * [data-vt-hero] container is named for the view-transition morph by
 * TransitionLink at click time. Wishlist heart is a 44px target.
 */
export function ProductCard({ product, className, editorial = false }: ProductCardProps) {
  const [front, back] = product.images;

  return (
    <article className={cn("group relative", className)}>
      <TransitionLink
        href={`/product/${product.slug}`}
        aria-label={product.name}
        className="block"
      >
        <ClipReveal
          className={cn(
            "relative w-full rounded-media shadow-soft ring-1 ring-olive/5",
            editorial ? "aspect-[4/3] lg:aspect-[8/5]" : "aspect-[4/5]",
          )}
        >
          <div data-vt-hero className="relative h-full w-full">
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
          <h3 className="font-display text-lg font-normal text-olive lg:text-xl">{product.name}</h3>
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
