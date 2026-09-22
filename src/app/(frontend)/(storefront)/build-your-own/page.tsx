import type { Metadata } from "next";
import { Reveal } from "@/components/motion/Reveal";
import { BuildYourOwnForm } from "@/components/commerce/BuildYourOwnForm";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LilyField } from "@/components/ui/LilyField";

export const metadata: Metadata = {
  title: "Build Your Own",
  description:
    "Choose your budget, colours and preferences — Calanthe's florists take care of the flowers.",
};

export default function BuildYourOwnPage() {
  return (
    /*
     * THE CONSULTATION HAPPENS ON THE SHOP'S OWN PAPER.
     *
     * One lily, drawn as line art at four times the width of the column,
     * cropped by the top and the reading edge, printed tone on tone in olive
     * at 5% — the same treatment the brand gives its paper bags and presses
     * into its greeting cards. It sits behind everything and moves with the
     * page; nothing animates it, because the brand's rule for this surface is
     * that it is texture, never the subject.
     */
    <main className="relative isolate mx-auto max-w-6xl gutter section-pad">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <LilyField
          opacity={0.045}
          className="absolute -top-[38%] end-[-55%] w-[min(190vw,78rem)] text-olive rtl:-scale-x-100 lg:-top-[30%] lg:end-[-25%]"
        />
      </div>

      <Reveal className="mb-12 max-w-2xl lg:mb-16">
        <Eyebrow>Bespoke</Eyebrow>
        <h1 className="display-2 mt-3 font-display font-light text-olive">
          Made for them, by you.
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">
          Choose your budget, colours and preferences. We&apos;ll take care of the
          flowers.
        </p>
      </Reveal>

      <BuildYourOwnForm />
    </main>
  );
}
