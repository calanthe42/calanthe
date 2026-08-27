import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { occasions } from "@/lib/data";

export const metadata: Metadata = {
  title: "Occasions",
  description: "Flowers for every unspoken thing — shop Calanthe by occasion.",
};

export default function OccasionsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-20">
      <Reveal className="mb-10 max-w-2xl lg:mb-14">
        <Eyebrow>Occasions</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-[1.08] text-olive lg:text-6xl">
          For every unspoken thing.
        </h1>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {occasions.map((occasion) => (
          <StaggerItem key={occasion.slug}>
            <Link
              href={`/occasions/${occasion.slug}`}
              className="group relative block aspect-[4/3] overflow-hidden rounded-sm"
            >
              <BotanicalPlaceholder
                seed={occasion.image.placeholder.seed}
                palette={occasion.image.placeholder.palette}
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
