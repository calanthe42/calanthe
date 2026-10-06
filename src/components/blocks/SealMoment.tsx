import { getDictionary } from "@/lib/i18n/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SplitLines } from "@/components/motion/SplitLines";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PackagingHero } from "@/components/blocks/PackagingHero";
import { OrchidPrint } from "@/components/ui/OrchidPrint";

/**
 * THE SEAL — the first thing after the hero.
 *
 * The olive bag with its pastel bouquet and orchid tag, standing on a sheet
 * of the brand's paper (PackagingHero), beside the client's own sentence.
 * It replaced the bag-on-velvet photograph of the first deck on 6 Oct 2026,
 * when the client asked for the new packaging everywhere.
 *
 * COMPOSITION. Asymmetric: the photograph holds the reading edge and runs
 * taller than the text beside it, and the client's orchid wallpaper is
 * printed tone on tone across the ground behind both. The photograph uncovers once and then is still.
 */
export async function SealMoment() {
  const { t } = await getDictionary();

  return (
    <section className="relative isolate overflow-hidden section-pad">
      {/* The paper this is printed on. */}
      <OrchidPrint ground="canvas" />

      <div className="mx-auto grid max-w-7xl gutter gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
        <div className="relative">
          <ClipReveal className="relative w-full overflow-hidden rounded-sm shadow-soft">
            <PackagingHero alt={t.alt.sealBag} ground="cream" sizes="(max-width: 1024px) 92vw, 52vw" />
          </ClipReveal>
        </div>

        {/* The words, held to a short measure so the photograph leads. */}
        <div>
          <Reveal>
            <Eyebrow>{t.seal.eyebrow}</Eyebrow>
          </Reveal>
          <SplitLines
            as="h2"
            lines={[t.seal.line1, t.seal.line2]}
            className="display-2 mt-3 font-display font-light text-olive"
          />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted">
              {t.seal.body}
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/shop" variant="primary">
                {t.seal.shop}
              </ButtonLink>
              <ButtonLink href="/about" variant="secondary">
                {t.seal.how}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
