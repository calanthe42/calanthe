import { HairlineDraw } from "@/components/motion/HairlineDraw";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { getDictionary } from "@/lib/i18n/server";

/** Quiet cream section — quality, presentation, attention to detail. */
export async function CalantheTouch() {
  const { t } = await getDictionary();
  const pillars = [
    { title: t.touch.handTitle, copy: t.touch.handCopy },
    { title: t.touch.wrapTitle, copy: t.touch.wrapCopy },
    { title: t.touch.deliverTitle, copy: t.touch.deliverCopy },
  ];

  return (
    /* The hairline matters when Best Sellers has nothing to show: this
       section then follows the equally cream video-approval section, and
       without it the two read as one long block. */
    <section className="border-t border-hairline/70 bg-cream section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal className="flex flex-col items-center text-center">
          <MonogramBloom className="w-14 text-olive" />
          <h2 className="display-2 mt-6 font-display font-light text-olive">
            {t.sections.touchTitle}
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
