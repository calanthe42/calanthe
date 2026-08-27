import { redirect } from "next/navigation";
import { products } from "@/lib/data";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
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
