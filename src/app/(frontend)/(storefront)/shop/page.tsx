import type { Metadata } from "next";
import { Reveal } from "@/components/motion/Reveal";
import { ShopGrid } from "@/components/commerce/ShopGrid";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CatalogueEmpty } from "@/components/blocks/CatalogueEmpty";
import { getAvailableProducts } from "@backend/data/products";

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
  const available = await getAvailableProducts();
  const list = readyToday ? available.filter((p) => p.featured || p.newArrival) : available;

  return (
    <main className="mx-auto max-w-7xl gutter section-pad">
      <Reveal className="mb-10 max-w-2xl lg:mb-14">
<Eyebrow>{readyToday ? "Ready made for today" : "The Collection"}</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          {readyToday
            ? "Made this morning, gone by evening."
            : "Composed this morning, at your door today."}
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-sage">
          {readyToday
            ? "Arrangements the atelier can compose and deliver today. Order before 2pm."
            : "Every arrangement is built stem by stem in the atelier — no two ever quite the same."}
        </p>
      </Reveal>

      {available.length === 0 ? (
        <CatalogueEmpty />
      ) : (
        <ShopGrid
          products={list}
          initialQuery={q}
          initialFlower={flower}
          initialPrice={price}
        />
      )}
    </main>
  );
}
