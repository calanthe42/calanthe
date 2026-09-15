import { HairlineDraw } from "@/components/motion/HairlineDraw";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { CONTACT, TRUST } from "@/lib/data";

/**
 * The service promise, stated once and plainly.
 *
 * Only things the atelier does on every order appear here (see TRUST in
 * lib/data.ts for why there is no rating, count or press strip). The
 * heading sits beside the promises on desktop rather than centred above
 * them, so the band reads as a statement with its evidence, and the one
 * line under it is a real way to ask a question before ordering.
 */
export function TrustBand() {
  return (
    <section className="section-pad">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 gutter lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Reveal>
          <h2 className="display-2 font-display font-light text-olive">
            {TRUST.headline}
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-sage">
            Questions before you order? A florist answers on{" "}
            <a
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="text-olive underline decoration-hairline underline-offset-4 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
            >
              WhatsApp
            </a>
            .
          </p>
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-x-8 gap-y-9 sm:grid-cols-2">
          {TRUST.guarantees.map((g, i) => (
            <StaggerItem key={g.title}>
              <HairlineDraw delay={i * 0.1} className="mb-4" />
              <h3 className="font-brand text-xs font-medium uppercase tracking-brand text-olive">
                {g.title}
              </h3>
              <p className="mt-2 max-w-xs text-base leading-relaxed text-sage">
                {g.copy}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
