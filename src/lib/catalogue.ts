import type { Product, ProductImage } from "@/lib/data";

/**
 * Pure catalogue rules, kept out of the components that render them so
 * they can be tested without a DOM — and so there is one place to look
 * when the question is "why does this card say New?".
 */

/**
 * The single badge a product card may wear, or null.
 *
 * BOTH INPUTS ARE DATABASE STATE. `newArrival` and `featured` are real
 * fields on the product document that the client sets in /admin. This
 * function invents nothing: there is deliberately no "selling fast",
 * no "only 2 left" and no "popular", because the schema knows none of
 * those things and a badge that cannot be traced to a field is a badge
 * that is lying.
 *
 * At most one is returned. A card wearing two labels reads as a sale
 * rack rather than an atelier, and New wins over Featured because it is
 * the more time-sensitive claim.
 *
 * "sale" comes first of all, and it is database state too: `sale` is on the
 * product only while one of the owner's automatic sales (the `discounts`
 * collection) applies to it right now. The card then shows the label SHE
 * wrote for that sale in place of New or Featured — still one label.
 */
export function productBadge(
  product: Pick<Product, "featured" | "newArrival"> & Partial<Pick<Product, "sale">>,
): "sale" | "new" | "featured" | null {
  if (product.sale) return "sale";
  if (product.newArrival) return "new";
  if (product.featured) return "featured";
  return null;
}

/**
 * What a product costs right now: its sale price while it is on sale, its
 * regular price otherwise. For sorting, filtering and "from AED …" — every
 * place that needs ONE number for a product.
 */
export function effectivePriceAed(product: Pick<Product, "priceAed" | "sale">): number {
  return product.sale?.priceAed ?? product.priceAed;
}

/**
 * A product's distinct photographs, in order.
 *
 * The data layer pads every product to exactly two images so the card
 * design always has a hover partner, which means a product with one
 * real photograph carries that photograph twice. The gallery must not
 * present that as two views, and the card must not crossfade an image
 * with itself.
 *
 * Generated botanical art has no `src`, so it is keyed on its seed —
 * two different placeholders are genuinely two different pictures.
 */
export function uniqueProductViews(images: readonly ProductImage[]): ProductImage[] {
  const seen = new Set<string>();
  const unique: ProductImage[] = [];
  for (const image of images) {
    const key = image.src ?? `seed:${image.placeholder.seed}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(image);
  }
  return unique;
}

/** True when the card has a genuine second photograph to crossfade to. */
export function hasSecondView(images: readonly ProductImage[]): boolean {
  return uniqueProductViews(images).length > 1;
}

/**
 * The occasion the gallery leads with.
 *
 * The bento grid gives its first tile twice the size, so whichever occasion
 * sits at index 0 is the one a visitor meets first. The client chose **Just
 * Because** for that position, and the occasion it displaces takes its old
 * small tile — a swap, not a re-sort, so the rest of the row keeps the order
 * set in /admin.
 *
 * A pure function on purpose: the same rule runs on the homepage band and on
 * the occasions index, and it cannot drift between them.
 */
export const FEATURED_OCCASION_SLUG = "just-because";

export function leadWithOccasion<T extends { slug: string }>(
  occasions: readonly T[],
  slug: string = FEATURED_OCCASION_SLUG,
): T[] {
  const ordered = [...occasions];
  const index = ordered.findIndex((occasion) => occasion.slug === slug);
  /* Absent, or already leading: the client's order is whatever /admin says. */
  if (index <= 0) return ordered;
  const lead = ordered[index]!;
  ordered[index] = ordered[0]!;
  ordered[0] = lead;
  return ordered;
}
