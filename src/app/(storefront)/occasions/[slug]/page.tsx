import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { ShopGrid } from "@/components/commerce/ShopGrid";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { occasions, products } from "@/lib/data";

export function generateStaticParams() {
  return occasions.map((o) => ({ slug: o.slug }));
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const occasion = occasions.find((o) => o.slug === slug);
  if (!occasion) notFound();

  const matches = products.filter((p) => p.occasions.includes(occasion.slug));

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-20">
      <Reveal className="mb-10 max-w-2xl lg:mb-14">
        <Eyebrow>Occasions</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-[1.08] text-olive lg:text-6xl">
          {occasion.name}
        </h1>
      </Reveal>

      <ShopGrid products={matches} showOccasionFilter={false} />
    </main>
  );
}
