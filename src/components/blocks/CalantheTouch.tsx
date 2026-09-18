import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { getDictionary } from "@/lib/i18n/server";

/**
 * The Calanthe Touch — an editorial spread, not a row of cards.
 *
 * WHAT IT WAS. A centred monogram, a centred heading, and three equal
 * columns of equal text beneath it. That is the single most template-like
 * arrangement on the internet: it appears on every agency homepage ever
 * built, it gives the eye no entry point, and because it is symmetrical it
 * carries no sense of sequence — even though these three things ARE a
 * sequence, the order in which an arrangement is made and sent.
 *
 * WHAT IT IS. An asymmetric split: the title holds a narrow rail on the
 * left and STAYS there while the three steps pass on the right as full
 * rows, each opened by a hairline and its number. The reader moves down one
 * column instead of across three, which is how the steps actually happen,
 * and the sticky title means the section never loses its own heading.
 *
 * The numbering earns its place here — this content is genuinely ordered
 * (arranged, then wrapped, then delivered). It would be decoration on a
 * section that was merely a list.
 */
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
      <div className="mx-auto grid max-w-7xl gutter lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
        {/* The rail. `self-start` + sticky keeps the title beside whichever
            step the reader is on, so the spread holds together over its
            full height instead of the heading scrolling away first. */}
        <Reveal className="lg:sticky lg:top-32 lg:self-start">
          <MonogramBloom className="w-12 text-olive" />
          <h2 className="display-2 mt-6 font-display font-light text-olive">
            {t.sections.touchTitle}
          </h2>
        </Reveal>

        <Stagger className="mt-12 flex flex-col lg:mt-0">
          {pillars.map((pillar, i) => (
            <StaggerItem
              key={pillar.title}
              className="border-t border-hairline/70 py-8 first:border-t-0 first:pt-0 lg:py-11 lg:first:pt-0"
            >
              <div className="flex gap-6 lg:gap-10">
                {/* The step's number, set small and quiet in the brand face
                    so it reads as a marginal note rather than a label. */}
                <span
                  aria-hidden
                  className="mt-1 shrink-0 font-brand text-xs font-medium tracking-brand text-burnt-orange"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-2xl font-light text-olive lg:text-3xl">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-ink-muted">
                    {pillar.copy}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
