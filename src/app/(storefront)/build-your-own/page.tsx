import type { Metadata } from "next";
import { Reveal } from "@/components/motion/Reveal";
import { BuildYourOwnForm } from "@/components/commerce/BuildYourOwnForm";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Build Your Own",
  description:
    "Choose your budget, colours and preferences — Calanthe's florists take care of the flowers.",
};

export default function BuildYourOwnPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:py-20">
      <Reveal className="mb-12">
        <Eyebrow>Bespoke</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-light leading-[1.08] text-olive lg:text-6xl">
          Made for them, by you.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-sage">
          Choose your budget, colours and preferences. We&apos;ll take care of the
          flowers.
        </p>
      </Reveal>

      <BuildYourOwnForm />
    </main>
  );
}
