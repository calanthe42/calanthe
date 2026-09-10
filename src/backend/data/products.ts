import { getPayload } from "payload";
import config from "@payload-config";
import type { Media, Product as PayloadProduct } from "@/payload-types";
import type { PlaceholderPalette, Product, ProductImage } from "@/lib/data";
import { servedMediaPath } from "@backend/domain/media-option";

/**
 * The only place the storefront reads products from the database.
 *
 * WHY A MAPPING LAYER rather than handing Payload documents to components:
 *
 * 1. It is the field allow-list. A Payload document carries `stock`,
 *    `trackStock`, `compareAtPriceFils`, `seo.noIndex` and internal ids. The
 *    storefront needs none of them, and a component that receives a whole
 *    document will eventually render one by accident. Everything below is
 *    built by naming fields explicitly, so nothing leaks by default.
 *
 * 2. It keeps the design untouched. The existing components were written
 *    against the `Product` shape in lib/data.ts. Returning that exact shape
 *    means the source of truth moves from a constant file to Postgres without
 *    a single component changing — which is the entire point of this step.
 *
 * AVAILABILITY IS ENFORCED IN THE QUERY, never in the caller. Every function
 * here filters `available: true` in the `where` clause, so an unavailable
 * product cannot reach a page even if a caller forgets to check — and cannot
 * be reached by guessing a slug either.
 *
 * Note there is no `import "server-only"` here. It would be correct for the
 * browser but breaks the Payload CLI, which loads the config in plain Node
 * (see backend/payload/access/index.ts). The guarantee instead is that this
 * module is imported only by Server Components and calls getPayload, which
 * cannot run in a browser.
 */

/** Only products the public may see. Written once, used by every query. */
const AVAILABLE = { available: { equals: true } } as const;

/** Fields the storefront needs. Anything absent here can never be rendered. */
const STOREFRONT_DEPTH = 1;

async function payloadClient() {
  return getPayload({ config });
}

function isMedia(value: unknown): value is Media {
  return typeof value === "object" && value !== null && "url" in value;
}

const PALETTES: readonly PlaceholderPalette[] = ["warm", "olive", "burgundy"];

function toPalette(value: unknown): PlaceholderPalette {
  return typeof value === "string" && (PALETTES as readonly string[]).includes(value)
    ? (value as PlaceholderPalette)
    : "warm";
}

/**
 * Real Media first, then the imported legacy references, then generated
 * botanical art.
 *
 * The catalogue was migrated before the client's photography existed, so most
 * products still carry only `legacyImages`. FloralImage already falls back to
 * generated art when `src` is absent, so an image-less product renders as
 * designed rather than as a broken box.
 */
function toImages(doc: PayloadProduct): readonly [ProductImage, ProductImage] {
  const fromMedia: ProductImage[] = (doc.images ?? [])
    .map((row) => row.image)
    .filter(isMedia)
    .map((media, index) => ({
      alt: media.alt ?? doc.name,
      src: servedMediaPath(media.url),
      placeholder: { seed: `${doc.slug}-${index}`, palette: toPalette(undefined) },
    }));

  const fromLegacy: ProductImage[] = (doc.legacyImages ?? []).map((row, index) => ({
    alt: row.alt,
    src: row.src ?? undefined,
    placeholder: {
      seed: row.placeholderSeed ?? `${doc.slug}-${index}`,
      palette: toPalette(row.placeholderPalette),
    },
  }));

  const images = fromMedia.length > 0 ? fromMedia : fromLegacy;

  /* The design renders exactly two images per product. Pad rather than crash
     if a product has one or none — a missing photograph is a content gap, not
     a reason to fail a page. */
  const first: ProductImage = images[0] ?? {
    alt: doc.name,
    placeholder: { seed: doc.slug, palette: "warm" },
  };
  const second: ProductImage = images[1] ?? {
    ...first,
    placeholder: { seed: `${first.placeholder.seed}-b`, palette: first.placeholder.palette },
  };

  return [first, second] as const;
}

/** Occasion relationships arrive as ids or documents depending on depth. */
function toOccasionSlugs(doc: PayloadProduct): Product["occasions"] {
  return (doc.occasions ?? [])
    .map((occasion) =>
      typeof occasion === "object" && occasion !== null ? occasion.slug : undefined,
    )
    .filter((slug): slug is string => typeof slug === "string") as Product["occasions"];
}

/** Payload document -> the shape the storefront already renders. */
function toStorefrontProduct(doc: PayloadProduct): Product {
  return {
    id: String(doc.id),
    slug: doc.slug,
    name: doc.name,
    /* Stored as integer fils; the storefront's existing contract is AED. */
    priceAed: Number(doc.priceFils) / 100,
    images: toImages(doc),
    occasions: toOccasionSlugs(doc),
    flowers: (doc.flowers ?? []) as Product["flowers"],
    featured: Boolean(doc.featured),
    newArrival: Boolean(doc.newArrival),
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Every product the public may buy, in the client's chosen order. */
export async function getAvailableProducts(limit = 100): Promise<Product[]> {
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "products",
    where: AVAILABLE,
    sort: "sortOrder",
    depth: STOREFRONT_DEPTH,
    limit,
  });
  return result.docs.map(toStorefrontProduct);
}

/**
 * One product by its public slug, or null.
 *
 * Returns null for an unavailable product as well as a missing one: from the
 * outside those are the same thing, and distinguishing them would tell a
 * stranger which unpublished slugs exist.
 */
export async function getAvailableProductBySlug(slug: string): Promise<Product | null> {
  if (!slug) return null;
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "products",
    where: { and: [AVAILABLE, { slug: { equals: slug } }] },
    depth: STOREFRONT_DEPTH,
    limit: 1,
  });
  const doc = result.docs[0];
  return doc ? toStorefrontProduct(doc) : null;
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "products",
    where: { and: [AVAILABLE, { featured: { equals: true } }] },
    sort: "sortOrder",
    depth: STOREFRONT_DEPTH,
    limit,
  });
  return result.docs.map(toStorefrontProduct);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "products",
    where: { and: [AVAILABLE, { newArrival: { equals: true } }] },
    sort: "sortOrder",
    depth: STOREFRONT_DEPTH,
    limit,
  });
  return result.docs.map(toStorefrontProduct);
}

/**
 * The Best Sellers row.
 *
 * The pre-database catalogue had no independent bestseller data —
 * `getBestSellers()` in lib/data.ts was `products.filter(p => p.featured)` —
 * so nothing was invented during the migration and `bestseller` is false on
 * every row. This preserves the behaviour the site actually had, while
 * honouring a real `bestseller` flag the moment the client sets one.
 */
export async function getBestSellers(limit = 8): Promise<Product[]> {
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "products",
    where: {
      and: [AVAILABLE, { or: [{ bestseller: { equals: true } }, { featured: { equals: true } }] }],
    },
    sort: "sortOrder",
    depth: STOREFRONT_DEPTH,
    limit,
  });
  return result.docs.map(toStorefrontProduct);
}

/** Available products attached to an occasion, by the occasion's slug. */
export async function getProductsForOccasion(
  occasionSlug: string,
  limit = 100,
): Promise<Product[]> {
  if (!occasionSlug) return [];
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "products",
    where: { and: [AVAILABLE, { "occasions.slug": { equals: occasionSlug } }] },
    sort: "sortOrder",
    depth: STOREFRONT_DEPTH,
    limit,
  });
  return result.docs.map(toStorefrontProduct);
}

/**
 * Products to show alongside another one: same occasions where possible,
 * excluding itself. Falls back to the general catalogue so the slot is never
 * empty on a product that has no occasions set.
 */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const payload = await payloadClient();

  if (product.occasions.length > 0) {
    const result = await payload.find({
      collection: "products",
      where: {
        and: [
          AVAILABLE,
          { "occasions.slug": { in: [...product.occasions] } },
          { slug: { not_equals: product.slug } },
        ],
      },
      sort: "sortOrder",
      depth: STOREFRONT_DEPTH,
      limit,
    });
    if (result.docs.length > 0) return result.docs.map(toStorefrontProduct);
  }

  const fallback = await payload.find({
    collection: "products",
    where: { and: [AVAILABLE, { slug: { not_equals: product.slug } }] },
    sort: "sortOrder",
    depth: STOREFRONT_DEPTH,
    limit,
  });
  return fallback.docs.map(toStorefrontProduct);
}

/** Slugs for generateStaticParams — available products only. */
export async function getAvailableProductSlugs(): Promise<string[]> {
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "products",
    where: AVAILABLE,
    depth: 0,
    limit: 500,
    select: { slug: true },
  });
  return result.docs.map((doc) => doc.slug).filter(Boolean);
}

/** Exported for tests: the document -> view-model mapping is pure. */
export const __internal = { toStorefrontProduct, toImages, toOccasionSlugs };
