import { CONTACT } from "@/lib/data";
import { SITE_ORIGIN, absoluteUrl } from "@/lib/site";

/**
 * Structured data — built from real business facts only.
 *
 * WHAT IS DELIBERATELY ABSENT: `aggregateRating`, `review`, `award`.
 * Those are the fields that most improve a search listing, and Calanthe
 * has none of them yet. Emitting them would be inventing customer
 * reviews, which is both a lie to the customer and, under Google's
 * spam policies, the kind of thing that gets rich results revoked for
 * the whole domain.
 *
 * Everything below comes from either CONTACT (the client's own details)
 * or the product document itself.
 */

/** The share image: real Calanthe photography, not a generated card. */
export const OG_IMAGE = {
  url: absoluteUrl("/brand/hero-desktop.jpg"),
  width: 1600,
  height: 1000,
  alt: "A Calanthe arrangement of garden roses, daisies and coral blossom",
} as const;

type JsonLd = Record<string, unknown>;

/**
 * The brand itself. `Florist` is a real schema.org type (a subtype of
 * LocalBusiness) and is more useful to a search engine than the generic
 * Organization.
 *
 * No `address` and no `openingHours`: the client's public details are a
 * phone number, an Instagram and an email. Emitting an empty or guessed
 * PostalAddress would be worse than omitting it — a wrong address in
 * structured data is the one SEO error that costs a real delivery.
 */
export function floristJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Florist",
    "@id": `${SITE_ORIGIN}/#florist`,
    name: "Calanthe",
    description:
      "Abu Dhabi-based floral brand created around the art of thoughtful giving. Hand-composed arrangements, delivered across the UAE.",
    url: SITE_ORIGIN,
    image: OG_IMAGE.url,
    email: CONTACT.email,
    telephone: CONTACT.whatsapp,
    areaServed: { "@type": "Country", name: "United Arab Emirates" },
    sameAs: [CONTACT.instagramHref],
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: "Calanthe",
    url: SITE_ORIGIN,
    publisher: { "@id": `${SITE_ORIGIN}/#florist` },
  };
}

type ProductJsonLdInput = {
  name: string;
  slug: string;
  priceAed: number;
  image?: string;
};

/**
 * A product listing. `availability` is InStock unconditionally here
 * because this is only ever called for a product the catalogue query
 * already returned, and that query filters `available: true` — an
 * unavailable product 404s and never reaches this function.
 */
export function productJsonLd(product: ProductJsonLdInput): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: absoluteUrl(`/product/${product.slug}`),
    /* Photos are served root-relative; structured data must be absolute. */
    ...(product.image
      ? { image: product.image.startsWith("/") ? absoluteUrl(product.image) : product.image }
      : {}),
    brand: { "@type": "Brand", name: "Calanthe" },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/product/${product.slug}`),
      priceCurrency: "AED",
      price: product.priceAed.toFixed(2),
      availability: "https://schema.org/InStock",
      seller: { "@id": `${SITE_ORIGIN}/#florist` },
    },
  };
}

export function breadcrumbJsonLd(
  trail: ReadonlyArray<{ name: string; path: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}
