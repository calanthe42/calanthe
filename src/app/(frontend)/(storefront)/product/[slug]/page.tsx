import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/commerce/ProductDetail";
import {
  getAvailableProductBySlug,
  getAvailableProductSlugs,
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
  return { title: product?.name ?? "Product" };
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

  return (
    <main>
      <ProductDetail product={product} />
    </main>
  );
}
