import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { ShopGrid } from "@/components/commerce/ShopGrid";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CatalogueEmpty } from "@/components/blocks/CatalogueEmpty";
import {
  getActiveOccasionBySlug,
  getActiveOccasionSlugs,
} from "@backend/data/occasions";
import { getProductsForOccasion } from "@backend/data/products";

/* The catalogue is now database-backed, so these pages must be allowed to
   change without a redeploy — otherwise an edit in /admin would never reach
   the site. Five minutes is a deliberate compromise: fresh enough that the
   client sees her change while she is still looking, cheap enough that the
   shop is served from cache under load. On-demand revalidation from a Payload
   afterChange hook (docs/DATABASE.md §4) is the eventual upgrade. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const occasion = await getActiveOccasionBySlug(slug);
  if (!occasion) return { title: "Occasion" };

  const description =
    occasion.description ||
    `${occasion.name} flowers, hand-composed by the Calanthe atelier and delivered across the UAE.`;
  const image = occasion.image.src;

  return {
    title: occasion.name,
    description,
    alternates: { canonical: `/occasions/${occasion.slug}` },
    openGraph: {
      type: "website",
      title: `${occasion.name} — CALANTHE`,
      description,
      url: `/occasions/${occasion.slug}`,
      ...(image ? { images: [{ url: image, alt: occasion.image.alt }] } : {}),
    },
  };
}

export async function generateStaticParams() {
  const slugs = await getActiveOccasionSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const occasion = await getActiveOccasionBySlug(slug);
  if (!occasion) notFound();

  /* The occasion -> product relationship now lives in the database, and the
     query returns available products only. */
  const matches = await getProductsForOccasion(occasion.slug);

  return (
    <main className="mx-auto max-w-7xl gutter section-pad">
      <Reveal className="mb-10 max-w-2xl lg:mb-14">
        <Eyebrow>Occasions</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          {occasion.name}
        </h1>
        {/* The owner's own words, when she has written them in /admin. */}
        {occasion.description ? (
          <p className="mt-4 max-w-md text-base leading-relaxed text-sage">
            {occasion.description}
          </p>
        ) : null}
      </Reveal>

      {matches.length === 0 ? (
        <CatalogueEmpty
          title={`No ${occasion.name.toLowerCase()} arrangements just yet.`}
          message="This collection is being composed. Do come back shortly."
        />
      ) : (
        <ShopGrid products={matches} showOccasionFilter={false} />
      )}
    </main>
  );
}
