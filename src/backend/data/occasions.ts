import { getPayload } from "payload";
import config from "@payload-config";
import type { Media, Occasion as PayloadOccasion } from "@/payload-types";
import type { Occasion, ProductImage } from "@/lib/data";
import { servedMediaPath } from "@backend/domain/media-option";

/**
 * The only place the storefront reads occasions from the database.
 *
 * Same contract as backend/data/products.ts: an explicit field allow-list, and
 * visibility enforced in the query rather than by the caller. `active: false`
 * hides an occasion from the site entirely, so a retired occasion cannot be
 * reached by guessing its slug.
 *
 * Returns the `Occasion` shape the existing components already render, so the
 * occasion pages and the homepage band change data source without changing
 * design.
 */

const ACTIVE = { active: { equals: true } } as const;

function isMedia(value: unknown): value is Media {
  return typeof value === "object" && value !== null && "url" in value;
}

/**
 * The tile image. Occasions imported from the pre-database catalogue have no
 * Media yet, so this falls back to generated botanical art keyed on the slug —
 * deterministic, so the same occasion always draws the same artwork.
 */
function toImage(doc: PayloadOccasion): ProductImage {
  const media = doc.image;
  if (isMedia(media)) {
    return {
      alt: media.alt ?? `${doc.name} arrangements`,
      src: servedMediaPath(media.url),
      placeholder: { seed: `occ-${doc.slug}`, palette: "warm" },
    };
  }
  return {
    alt: `${doc.name} arrangements`,
    placeholder: { seed: `occ-${doc.slug}`, palette: "warm" },
  };
}

function toStorefrontOccasion(doc: PayloadOccasion): Occasion {
  return {
    slug: doc.slug as Occasion["slug"],
    name: doc.name,
    image: toImage(doc),
    ...(doc.description ? { description: doc.description } : {}),
  };
}

/** Every occasion the public may browse, in the client's chosen order. */
export async function getActiveOccasions(limit = 50): Promise<Occasion[]> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "occasions",
    where: ACTIVE,
    sort: "sortOrder",
    depth: 1,
    limit,
  });
  return result.docs.map(toStorefrontOccasion);
}

/** One occasion by slug, or null when missing or retired. */
export async function getActiveOccasionBySlug(slug: string): Promise<Occasion | null> {
  if (!slug) return null;
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "occasions",
    where: { and: [ACTIVE, { slug: { equals: slug } }] },
    depth: 1,
    limit: 1,
  });
  const doc = result.docs[0];
  return doc ? toStorefrontOccasion(doc) : null;
}

/** Slugs for generateStaticParams — active occasions only. */
export async function getActiveOccasionSlugs(): Promise<string[]> {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "occasions",
    where: ACTIVE,
    depth: 0,
    limit: 200,
    select: { slug: true },
  });
  return result.docs.map((doc) => doc.slug).filter(Boolean);
}

/** Exported for tests: the mapping is pure. */
export const __internal = { toStorefrontOccasion, toImage };
