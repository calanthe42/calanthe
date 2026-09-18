import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/blocks/JsonLd";
import { ProductDetail } from "@/components/commerce/ProductDetail";
import { RelatedProducts } from "@/components/commerce/RelatedProducts";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";
import { formatAed } from "@/lib/data";
import {
  getAvailableProductBySlug,
  getAvailableProductSlugs,
  getRelatedProducts,
} from "@backend/data/products";

/* The catalogue is now database-backed, so these pages must be allowed to
   change without a redeploy — otherwise an edit in /admin would never reach
   the site. Five minutes is a deliberate compromise: fresh enough that the
   client sees her change while she is still looking, cheap enough that the
   shop is served from cache under load. On-demand revalidation from a Payload
   afterChange hook (docs/DATABASE.md §4) is the eventual upgrade. */
export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getAvailableProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

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
