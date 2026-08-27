import { HairlineDraw } from "@/components/motion/HairlineDraw";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";

const pillars = [
  {
    title: "Hand-arranged daily",
    copy: "Every stem is chosen and placed by hand in our atelier, morning by morning.",
  },
  {
    title: "Thoughtful presentation",
    copy: "Wrapped in embossed paper, tied and sealed with the Calanthe monogram.",
  },
  {
    title: "Delivered with care",
    copy: "Kept cool and upright to your door, across all seven emirates.",
  },
] as const;

/** Quiet cream section — quality, presentation, attention to detail. */
export function CalantheTouch() {
  return (
    <section className="bg-cream section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal className="flex flex-col items-center text-center">
          <MonogramBloom className="w-14 text-olive" />
          <h2 className="display-2 mt-6 font-display font-light text-olive">
            The Calanthe Touch
          </h2>
        </Reveal>

        <Stagger className="mt-12 grid grid-cols-1 gap-10 lg:mt-16 lg:grid-cols-3 lg:gap-12">
          {pillars.map((pillar, i) => (
            <StaggerItem key={pillar.title}>
              <HairlineDraw delay={i * 0.12} className="mb-6" />
              <h3 className="font-brand text-xs font-medium uppercase tracking-brand text-olive">
                {pillar.title}
              </h3>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-sage">
                {pillar.copy}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
