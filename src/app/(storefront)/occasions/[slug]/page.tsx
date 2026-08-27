import { notFound } from "next/navigation";
import { StubPage } from "@/components/blocks/StubPage";
import { occasions } from "@/lib/data";

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

  return (
    <StubPage
      eyebrow="Occasions"
      title={occasion.name}
      note="This collection is being arranged. Please visit again soon."
    />
  );
}
