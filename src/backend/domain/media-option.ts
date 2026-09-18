import type { Media } from "@/payload-types";

/**
 * A photograph as the admin interface needs it — never a whole Media document.
 *
 * Shared by the media library, the media picker and the server action that
 * returns a freshly uploaded photo, so the three can never disagree about what
 * a "photo" carries.
 */
export type MediaOption = {
  id: number;
  alt: string;
  url: string;
  thumbnailUrl?: string;
  filename?: string;
  mimeType?: string;
  filesize?: number;
  width?: number;
  height?: number;
  createdAt?: string;
};

/**
 * A media URL as next/image can load it.
 *
 * Payload returns files it serves as ABSOLUTE URLs built from serverURL —
 * http://localhost:3000/api/media/file/x.jpg locally, and the site's own
 * domain in production. next/image refuses any absolute host not listed in
 * images.remotePatterns, and neither is listed: the moment a real photo
 * existed, the media library, the product editor and the storefront product
 * page all fell into their error screens.
 *
 * That file route always belongs to this app, so it is served root-relative.
 * Anything else — a Vercel Blob URL once Payload's proxy is bypassed — stays
 * absolute, and next.config's remotePatterns already allows it.
 */
export function servedMediaPath(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/api/media/file/")
      ? `${parsed.pathname}${parsed.search}`
      : url;
  } catch {
    return undefined;
  }
}

/** Null for a Media row with no file URL — there is nothing to show. */
export function toMediaOption(media: Media): MediaOption | null {
  const url = servedMediaPath(media.url);
  if (!url) return null;
  return {
    id: media.id,
    alt: media.alt ?? "",
    url,
    thumbnailUrl: servedMediaPath(media.sizes?.thumbnail?.url),
    filename: media.filename ?? undefined,
    mimeType: media.mimeType ?? undefined,
    filesize: media.filesize ?? undefined,
    width: media.width ?? undefined,
    height: media.height ?? undefined,
    createdAt: media.createdAt,
  };
}

type Ref = number | { id: number } | null | undefined;

function refId(ref: Ref): number | undefined {
  if (typeof ref === "number") return ref;
  if (ref && typeof ref === "object" && typeof ref.id === "number") return ref.id;
  return undefined;
}

export type ProductMediaRefs = {
  name: string;
  images?: readonly { image: Ref }[] | null;
  seo?: { image?: Ref } | null;
};
export type OccasionMediaRefs = { name: string; image?: Ref };

/**
 * Which products and occasions use each photograph.
 *
 * This is what lets the library say "Used by Amber Hour" and lets deletion be
 * refused with that sentence, instead of removing a photo out from under a
 * live product. Pure — tested in media-option.test.ts.
 */
export function collectMediaUsage(
  products: readonly ProductMediaRefs[],
  occasions: readonly OccasionMediaRefs[],
): Map<number, string[]> {
  const usage = new Map<number, string[]>();
  const add = (id: number | undefined, label: string) => {
    if (id === undefined) return;
    const list = usage.get(id) ?? [];
    if (!list.includes(label)) list.push(label);
    usage.set(id, list);
  };

  for (const product of products) {
    for (const row of product.images ?? []) add(refId(row.image), product.name);
    add(refId(product.seo?.image), `${product.name} (share image)`);
  }
  for (const occasion of occasions) add(refId(occasion.image), `${occasion.name} occasion`);

  return usage;
}

/** "A", "A and B", "A, B and 3 more". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}
