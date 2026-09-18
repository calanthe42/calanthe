import { redirect } from "next/navigation";
import { getAvailableProductSlugs } from "@backend/data/products";

export async function generateStaticParams() {
  const slugs = await getAvailableProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

/** Canonical product URLs live at /product/[slug]. */
export default async function LegacyProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/product/${slug}`);
}
