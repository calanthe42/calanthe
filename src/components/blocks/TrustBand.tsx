import { HairlineDraw } from "@/components/motion/HairlineDraw";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { TRUST } from "@/lib/data";

/**
 * Quiet editorial trust layer: guarantees, rating line and an
 * "as featured in" strip. Every count and logo is a placeholder
 * awaiting the client's real numbers/press (see PROJECT-BRAIN.md).
 */
export function TrustBand() {
  return (
    <section className="section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal className="text-center">
          <p className="font-display text-2xl font-light italic text-olive lg:text-3xl">
            {TRUST.ratingLine}
          </p>
          <p className="mt-2 font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage">
            {TRUST.customersLine}
          </p>
        </Reveal>

        <Stagger className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {TRUST.guarantees.map((g, i) => (
            <StaggerItem key={g.title}>
              <HairlineDraw delay={i * 0.1} className="mb-4" />
              <h3 className="font-brand text-xs font-medium uppercase tracking-brand text-olive">
                {g.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-sage">{g.copy}</p>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Press strip — placeholder wordmarks, flagged for the client */}
        <Reveal className="mt-14 lg:mt-16">
          <p className="mb-5 text-center font-brand text-[0.625rem] font-medium uppercase tracking-brand text-sage">
            As featured in
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-50">
            {TRUST.pressPlaceholders.map((name) => (
              <span
                key={name}
                aria-label="Press logo placeholder"
                className="font-display text-xl font-light italic text-sage"
              >
                {name}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
