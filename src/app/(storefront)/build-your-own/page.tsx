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
    <main className="mx-auto max-w-3xl gutter section-pad">
      <Reveal className="mb-12">
        <Eyebrow>Bespoke</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
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
