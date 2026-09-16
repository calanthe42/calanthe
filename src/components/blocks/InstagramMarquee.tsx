import { Reveal } from "@/components/motion/Reveal";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { CONTACT } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

/**
 * The invitation to follow the atelier — one quiet line, no movement.
 *
 * This section has been through two wrong answers. It began as rows of stock
 * photography captioned "Calanthe on Instagram", which were not Calanthe's
 * pictures. It was then replaced with a scrolling wall of the handle repeated
 * across the screen, which is the loudest thing a page can do and belongs to
 * a different kind of brand entirely.
 *
 * What a flower atelier does here is simply say where it is, once, and stop:
 * the house mark, the handle set in the display face, and a single line.
 * When the client's own photography exists this becomes a small editorial
 * grid of real posts; until then, silence is the honest treatment and the
 * quieter one.
 */
export async function InstagramMarquee() {
  const { t } = await getDictionary();

  return (
    <section className="section-pad">
      <Reveal className="mx-auto flex max-w-xl flex-col items-center gutter text-center">
        <MonogramBloom className="w-10 text-burnt-orange/70" />

        <a
          href={CONTACT.instagramHref}
          target="_blank"
          rel="noreferrer"
          className="group mt-6 inline-flex min-h-11 items-center font-display text-3xl font-light text-olive transition-colors duration-300 ease-bloom hover:text-burnt-orange lg:text-4xl"
        >
          {CONTACT.instagramHandle}
        </a>

        <p className="mt-3 text-base leading-relaxed text-sage">
          {t.sections.instagramLine}
        </p>

        <span aria-hidden className="mt-8 block h-px w-16 bg-hairline" />
      </Reveal>
    </section>
  );
}
