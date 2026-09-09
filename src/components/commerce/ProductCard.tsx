import { ClipReveal } from "@/components/motion/ClipReveal";
import { TransitionLink } from "@/components/motion/TransitionLink";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { FloralImage } from "@/components/ui/FloralImage";
import { hasSecondView, productBadge } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import { formatAed, type Product } from "@/lib/data";

type ProductCardProps = {
  product: Product;
  className?: string;
  /** Editorial (2x) tiles use a wider image crop. */
  editorial?: boolean;
  /** Collection-grid variant: from-price + quick View affordance. */
  showView?: boolean;
  /**
   * next/image `sizes` for THIS placement. Defaults to the homepage
   * rows (one card per screen on a phone). The shop and occasion grids
   * are two-up on a phone and must say so — the default made every
   * phone download images at roughly twice the pixels it could show.
   */
  sizes?: string;
};

/**
 * Server component: 4:5 ClipReveal image with hover crossfade; the
 * [data-vt-hero] container is named for the view-transition morph by
 * TransitionLink at click time. Wishlist heart is a 44px target.
 *
 * BADGES ARE DATABASE STATE, never decoration. A card says "New" only
 * because `newArrival` is true on the document, and "Featured" only
 * because `featured` is. There is no invented urgency here — no "only
 * 2 left", no "selling fast" — because nothing in the schema knows
 * either of those things.
 */
export function ProductCard({
  product,
  className,
  editorial = false,
  showView = false,
  sizes = "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 25vw",
}: ProductCardProps) {
  const [front, back] = product.images;
  /* Both rules are pure and tested — see lib/catalogue.ts. A card
     wearing two labels reads as a sale rack, and a product whose two
     slots hold the same photograph would otherwise crossfade with
     itself: a hover that looks broken rather than subtle. */
  const badge = productBadge(product);
  const showBack = hasSecondView(product.images);

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
            <FloralImage image={front} sizes={sizes} />
            {showBack && (
              <div className="absolute inset-0 opacity-0 transition-opacity duration-500 ease-bloom group-hover:opacity-100">
                <FloralImage image={back} sizes={sizes} />
              </div>
            )}
            {/* A quiet scrim from the top only, so the label has
                something to sit on without greying the photograph. */}
            {badge && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-olive/35 to-transparent"
              />
            )}
          </div>
        </ClipReveal>

        {badge && (
          <span className="pointer-events-none absolute left-3 top-3 font-brand text-[0.5625rem] font-medium uppercase tracking-brand text-cream">
            {badge}
          </span>
        )}

        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-normal text-olive lg:text-xl">
            {product.name}
          </h3>
          <p className="shrink-0 text-sm text-sage lg:text-base">
            {showView && <span className="mr-1 text-xs">from</span>}
            {formatAed(product.priceAed)}
          </p>
        </div>
        {showView && (
          <p className="mt-1.5 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage transition-colors duration-200 ease-bloom group-hover:text-burnt-orange">
            View —
          </p>
        )}
      </TransitionLink>

      <WishlistButton
        productId={product.id}
        productName={product.name}
        className="absolute right-1 top-1 text-cream"
      />
    </article>
  );
}
