import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { FloralImage } from "@/components/ui/FloralImage";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getActiveOccasions } from "@backend/data/occasions";

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

export default async function OccasionsPage() {
  const occasions = await getActiveOccasions();

  return (
    <main className="mx-auto max-w-7xl gutter section-pad">
      <Reveal className="mb-10 max-w-2xl lg:mb-14">
        <Eyebrow>Occasions</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          For every unspoken thing.
        </h1>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {occasions.map((occasion) => (
          <StaggerItem key={occasion.slug}>
            <Link
              href={`/occasions/${occasion.slug}`}
              className="group relative block aspect-[4/3] overflow-hidden rounded-media shadow-soft"
            >
              <FloralImage
                image={occasion.image}
                sizes="(max-width: 1024px) 100vw, 33vw"
              />
              <span className="absolute inset-0 bg-olive/35 transition-colors duration-300 ease-bloom group-hover:bg-olive/55" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="font-brand text-sm font-medium uppercase tracking-brand text-cream transition-[letter-spacing] duration-300 ease-bloom group-hover:tracking-[0.28em]">
                  {occasion.name}
                </span>
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </main>
  );
}
