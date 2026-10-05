"use client";

/*
 * A CLIENT COMPONENT, so the card can read the dictionary.
 *
 * It carries three words of its own — "from", "View arrangement", and the
 * New/Featured badge — and they were English on every card in every grid.
 * The card cannot read the language on the server and be rendered inside
 * ShopGrid, which is a client component, so it becomes a client component
 * itself. Its two interactive children (TransitionLink, WishlistButton)
 * already were, and the markup is still server-rendered in the first byte.
 */
import { ClipReveal } from "@/components/motion/ClipReveal";
import { TransitionLink } from "@/components/motion/TransitionLink";
import { Price } from "@/components/commerce/Price";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { FloralImage } from "@/components/ui/FloralImage";
import { hasSecondView, productBadge } from "@/lib/catalogue";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/data";
import { useLocale } from "@/lib/locale";

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
 *
 * A SALE is database state too. While one of the owner's automatic sales
 * applies, the card wears the label she wrote for it (in place of New or
 * Featured — one label, always), the regular price struck through, and the
 * price to pay. Nothing turns orange and nothing counts down: the regular
 * price is muted, the sale price is Olive, and that is the whole of it.
 */
export function ProductCard({
  product,
  className,
  editorial = false,
  showView = false,
  sizes = "(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 25vw",
}: ProductCardProps) {
  const { locale, t } = useLocale();
  const [front, back] = product.images;
  const sale = product.sale;
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
          /* `start`, not `left`: the label sits at the reading edge and the
             wishlist heart at the far one, in either direction. The owner's
             sale label may be long, so it wraps to a second line instead of
             being cut, and stops short of the heart. Arabic is set at 12px:
             Cinzel has no Arabic, so the fallback face needs the size to be
             read at all. */
          <span className="pointer-events-none absolute start-3 top-3 max-w-[calc(100%-4rem)] font-brand text-[0.5625rem] font-medium uppercase leading-snug tracking-brand text-cream rtl:text-xs">
            {badge === "sale" && sale
              ? sale.label[locale]
              : badge === "new"
                ? t.ui.badgeNew
                : t.ui.badgeFeatured}
          </span>
        )}

        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-normal text-olive lg:text-xl">
            {product.name}
          </h3>
          {/* On offer, the regular price sits on its own line above the
              price to pay, so a two-up card at 390px never has to squeeze
              three figures onto one row; the name wraps before this does. */}
          <p className="shrink-0 text-end text-sm text-ink-muted lg:text-base">
            <Price
              t={t}
              layout="stack"
              prefix={showView ? <span className="me-1 text-xs">{t.ui.from}</span> : null}
              nowFils={Math.round((sale?.priceAed ?? product.priceAed) * 100)}
              wasFils={sale ? Math.round(product.priceAed * 100) : null}
              wasClassName="text-xs lg:text-sm"
            />
            {sale?.valueType === "percentage" && (
              <span className="block text-xs text-ink-muted">
                {t.ui.salePercent.replace("{n}", String(sale.percentOff))}
              </span>
            )}
          </p>
        </div>
        {showView && (
          <p className="mt-1.5 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-ink-muted transition-colors duration-200 ease-bloom group-hover:text-burnt-orange">
            {t.ui.viewArrangement}
          </p>
        )}
      </TransitionLink>

      <WishlistButton
        productId={product.id}
        productName={product.name}
        className="absolute end-1 top-1 text-cream"
      />
    </article>
  );
}
