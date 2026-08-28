import type { Metadata } from "next";
import { FaqAccordion } from "@/components/commerce/MembershipInteractive";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { siteFaq } from "@/lib/data";

export const metadata: Metadata = {
  title: "FAQs",
  description:
    "Delivery times, freshness, substitutions, video approval and payment — Calanthe's most-asked questions.",
};

export default function FaqsPage() {
  return (
    <main className="mx-auto max-w-3xl gutter section-pad">
      <Reveal className="mb-10">
        <Eyebrow>Help</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          Questions, answered.
        </h1>
      </Reveal>
      <FaqAccordion items={siteFaq} />
    </main>
  );
}
