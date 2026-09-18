import type { Metadata } from "next";
import { ShopGrid } from "@/components/commerce/ShopGrid";
import { PageHeader } from "@/components/blocks/PageHeader";
import { CatalogueEmpty } from "@/components/blocks/CatalogueEmpty";
import { getAvailableProducts } from "@backend/data/products";
import { getActiveOccasions } from "@backend/data/occasions";
import { getDictionary } from "@/lib/i18n/server";
import { SAME_DAY_CUTOFF_HOUR } from "@/lib/data";

/* The catalogue is now database-backed, so these pages must be allowed to
   change without a redeploy — otherwise an edit in /admin would never reach
   the site. Five minutes is a deliberate compromise: fresh enough that the
   client sees her change while she is still looking, cheap enough that the
   shop is served from cache under load. On-demand revalidation from a Payload
   afterChange hook (docs/DATABASE.md §4) is the eventual upgrade. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Hand-composed arrangements from the Calanthe atelier — same-day delivery across the UAE.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; flower?: string; price?: string; ready?: string }>;
}) {
  const { q = "", flower = "", price = "", ready = "" } = await searchParams;

  /* "Ready Made for Today" is the same catalogue, filtered to what the
     atelier can compose and deliver the same day — not a separate page
     to keep in sync. */
  const readyToday = ready === "today";
  /* Availability is enforced by the query, not here: getAvailableProducts
     only ever returns products the public may buy. */
  /* SHOP ALL MEANS ALL. Every available product, whatever occasions it is
     assigned to and whether it is assigned to any — the only filter is the
     one the data layer always applies, `available: true`. The limit is raised
     well past the catalogue's size so nothing is silently cut off. */
  const [available, occasions, { t }] = await Promise.all([
    getAvailableProducts(500),
    getActiveOccasions(),
    getDictionary(),
  ]);
  const list = readyToday
    ? available.filter((p) => p.featured || p.newArrival)
    : available;

  return (
    <main className="mx-auto max-w-7xl gutter section-pad">
      <PageHeader
        eyebrow={readyToday ? t.pages.shopReadyEyebrow : t.pages.shopEyebrow}
        title={readyToday ? t.pages.shopReadyTitle : t.pages.shopTitle}
        intro={
          readyToday
            ? `${t.pages.shopIntro} ${SAME_DAY_CUTOFF_HOUR}:00.`
            : t.pages.shopIntro
        }
        meta={
          list.length
            ? `${list.length} ${list.length === 1 ? t.pages.arrangementOne : t.pages.arrangementMany}`
            : undefined
        }
      />

      {available.length === 0 ? (
        <CatalogueEmpty />
      ) : (
        <ShopGrid
          products={list}
          occasions={occasions}
          initialQuery={q}
          initialFlower={flower}
          initialPrice={price}
        />
      )}
    </main>
  );
}
