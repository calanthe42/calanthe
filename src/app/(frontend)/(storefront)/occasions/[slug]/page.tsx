import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { ShopGrid } from "@/components/commerce/ShopGrid";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CatalogueEmpty } from "@/components/blocks/CatalogueEmpty";
import { getActiveOccasionBySlug } from "@backend/data/occasions";
import { getProductsForOccasion } from "@backend/data/products";

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
 * Here the trap is quieter than on /product, where it is already a live
 * 500: the occasions that existed at build time WERE prerendered, so they
 * work. An occasion the owner adds afterwards is not in that set, so its
 * page would 500 on its first visit -- a new category that breaks the
 * moment it is created. Same cause, same digest: DYNAMIC_SERVER_USAGE.
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
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">
            {occasion.description}
          </p>
        ) : null}
      </Reveal>

      {matches.length === 0 ? (
        <CatalogueEmpty
          title={`The ${occasion.name.toLowerCase()} collection is being composed.`}
          message="Until it arrives, a florist can compose one for this moment. Tell us who it is for, the colours and your budget."
        />
      ) : (
        <ShopGrid products={matches} showOccasionFilter={false} />
      )}
    </main>
  );
}
