import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/blocks/JsonLd";
import { ProductDetail } from "@/components/commerce/ProductDetail";
import { RelatedProducts } from "@/components/commerce/RelatedProducts";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import { formatAed } from "@/lib/data";
import {
  getAvailableProductBySlug,
  getRelatedProducts,
} from "@backend/data/products";

/*
 * RENDERED PER REQUEST, DELIBERATELY.
 *
 * THE OUTAGE THIS FIXES. This route was ISR (`revalidate`) with
 * `generateStaticParams`, and the locale is read with `cookies()`
 * (lib/i18n/server.ts). That combination is only safe for paths Next
 * prerendered at build time. Any other path renders on demand in static
 * mode, where `cookies()` is illegal, and Next throws
 * DYNAMIC_SERVER_USAGE -> 500.
 *
 * In production every product is hidden, so the slug list was EMPTY,
 * nothing was prerendered, and EVERY product URL 500ed -- including slugs
 * that do not exist, which should have been 404. Publishing a product did
 * not help: the prerendered set is fixed at build time, so the owner's
 * first published arrangement still 500ed. Proven from the runtime logs:
 * `digest: 'DYNAMIC_SERVER_USAGE'`.
 *
 * `force-dynamic` makes `cookies()` legal, makes `notFound()` a real 404,
 * and means a product published in /admin is live on its next request with
 * no redeploy. The cost is the ISR cache, which is the right trade against
 * a page that returns 500.
 *
 * THIS IS THE SMALL FIX, NOT THE FINAL ONE. A8 moves the locale into the URL
 * (/en, /ar), after which these pages can be static again and
 * `generateStaticParams` comes back. Until then, static generation here is
 * a trap: it works in development, where products are seeded and available,
 * and fails in production, where they are not.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getAvailableProductBySlug(slug);
  if (!product) return { title: "Product" };

  /* The description is generated from real fields only — the name and
     the price. There is no marketing copy field on the document yet,
     and writing one here would be inventing product claims. */
  const description = `${product.name} — hand-composed by the Calanthe atelier, from ${formatAed(product.priceAed)}. Delivered across the UAE.`;
  const image = product.images[0]?.src;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      title: `${product.name} — CALANTHE`,
      description,
      url: `/product/${product.slug}`,
      /* A product with no photograph inherits the brand card rather
         than shipping a broken image reference. */
      ...(image ? { images: [{ url: image, alt: product.images[0].alt }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} — CALANTHE`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  /* Returns null for an unavailable product as well as a missing one, so an
     unpublished slug 404s instead of confirming it exists. */
  const product = await getAvailableProductBySlug(slug);
  if (!product) notFound();

  /* Same occasions where possible, the wider catalogue otherwise, and
     never this product itself — the rule lives in the data layer. */
  const related = await getRelatedProducts(product, 4);

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: product.name,
          slug: product.slug,
          priceAed: product.priceAed,
          image: product.images[0]?.src,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />
      <ProductDetail product={product} />
      <RelatedProducts products={related} />
    </main>
  );
}
