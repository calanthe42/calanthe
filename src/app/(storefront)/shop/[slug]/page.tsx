import { notFound } from "next/navigation";
import { StubPage } from "@/components/blocks/StubPage";
import { products } from "@/lib/data";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <StubPage
      eyebrow="The Collection"
      title={product.name}
      note={`AED ${product.priceAed} — the full product page is being arranged.`}
    />
  );
}
