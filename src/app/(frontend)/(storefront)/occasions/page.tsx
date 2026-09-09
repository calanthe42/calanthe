import type { Metadata } from "next";
import Link from "next/link";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { FloralImage } from "@/components/ui/FloralImage";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CatalogueEmpty } from "@/components/blocks/CatalogueEmpty";
import { getActiveOccasions } from "@backend/data/occasions";
import { cn } from "@/lib/cn";

/* The catalogue is now database-backed, so these pages must be allowed to
   change without a redeploy — otherwise an edit in /admin would never reach
   the site. Five minutes is a deliberate compromise: fresh enough that the
   client sees her change while she is still looking, cheap enough that the
   shop is served from cache under load. On-demand revalidation from a Payload
   afterChange hook (docs/DATABASE.md §4) is the eventual upgrade. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Occasions",
  description: "Flowers for every unspoken thing — shop Calanthe by occasion.",
};

/**
 * The occasion index carried a different visual grammar from the
 * homepage band that sends people here: a flat olive wash over the
 * whole photograph and a centred caption, which is the arrangement
 * every template ships with. It now reads the way SHOP BY OCCASION
 * reads — the gradient anchored at the bottom so the photograph keeps
 * its own light, the label set bottom-left, a burnt-orange hairline
 * drawing under it on hover — and the first occasion leads at twice
 * the size, so the page has a hierarchy instead of a repetition.
 */
export default async function OccasionsPage() {
  const occasions = await getActiveOccasions();
  const [lead, ...rest] = occasions;

  return (
    <main className="mx-auto max-w-7xl gutter section-pad">
      <Reveal className="mb-10 max-w-2xl lg:mb-14">
        <Eyebrow>Occasions</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          For every unspoken thing.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-sage">
          Some things are easier handed over than said. Begin with the moment,
          and we will compose the rest.
        </p>
      </Reveal>

      {!lead ? (
        <CatalogueEmpty
          title="The collections are being composed."
          message="Occasions will appear here as soon as they are ready."
        />
      ) : (
        <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {/* The lead occasion: full width on a phone, two-thirds and
              taller on desktop — the page opens on one photograph
              rather than on a row of equals. */}
          <StaggerItem className="col-span-2 lg:col-span-2 lg:row-span-2">
            <OccasionTile occasion={lead} lead />
          </StaggerItem>
          {rest.map((occasion) => (
            <StaggerItem key={occasion.slug}>
              <OccasionTile occasion={occasion} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </main>
  );
}

type OccasionTileProps = {
  occasion: Awaited<ReturnType<typeof getActiveOccasions>>[number];
  lead?: boolean;
};

function OccasionTile({ occasion, lead = false }: OccasionTileProps) {
  return (
    <Link
      href={`/occasions/${occasion.slug}`}
      className={cn(
        "group relative block h-full overflow-hidden rounded-media shadow-soft",
        lead ? "aspect-[4/3] lg:aspect-auto lg:min-h-[30rem]" : "aspect-[4/5]",
      )}
    >
      <ClipReveal className="absolute inset-0">
        <FloralImage
          image={occasion.image}
          sizes={
            lead
              ? "(max-width: 1024px) 100vw, 62vw"
              : "(max-width: 1024px) 48vw, 31vw"
          }
        />
      </ClipReveal>

      {/* Anchored at the bottom, not a flat wash: the photograph keeps
          its own colour and light, and the label sits on a dark base. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-olive/85 via-olive/25 to-olive/5 transition-opacity duration-500 ease-bloom group-hover:opacity-85"
      />

      <span className="absolute inset-x-0 bottom-0 flex items-end p-4 lg:p-6">
        <span className="flex flex-col gap-1.5">
          <span
            className={cn(
              "font-brand font-medium uppercase tracking-brand text-cream transition-[letter-spacing] duration-300 ease-bloom group-hover:tracking-[0.26em]",
              lead ? "text-sm lg:text-xl" : "text-[0.6875rem] lg:text-[0.8125rem]",
            )}
          >
            {occasion.name}
          </span>
          <span
            aria-hidden
            className="h-px w-0 bg-burnt-orange transition-all duration-500 ease-bloom group-hover:w-10"
          />
        </span>
      </span>
    </Link>
  );
}
