import { getDictionary } from "@/lib/i18n/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SplitLines } from "@/components/motion/SplitLines";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FloralImage } from "@/components/ui/FloralImage";
import { LilyField } from "@/components/ui/LilyField";

/**
 * THE SEAL — the first thing after the hero.
 *
 * One photograph — the bag against green velvet, the way the identity
 * shoots it — beside the words. The turning wordmark disc and the monogram
 * that sat on its corner were removed at the client's request; the
 * photograph carries the section on its own.
 *
 * COMPOSITION. Asymmetric: the photograph holds the reading edge and runs
 * taller than the text beside it, and the lily linework is printed across
 * the ground behind both. The photograph uncovers once and then is still.
 */
export async function SealMoment() {
  const { t } = await getDictionary();

  return (
    <section className="relative isolate overflow-hidden section-pad">
      {/* The paper this is printed on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <LilyField
          opacity={0.07}
          className="absolute -top-[22%] end-[-42%] w-[145%] text-olive rtl:-scale-x-100 lg:-top-[30%] lg:end-[-14%] lg:w-[62%]"
        />
      </div>

      <div className="mx-auto grid max-w-7xl gutter gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
        <div className="relative">
          <ClipReveal className="relative aspect-[4/5] w-full overflow-hidden rounded-sm shadow-soft sm:aspect-[3/4] lg:aspect-[4/5]">
            <FloralImage
              image={{
                alt: t.alt.sealBag,
                src: "/brand/packaging-curtain.webp",
                placeholder: { seed: "seal-moment", palette: "burgundy" },
              }}
              sizes="(max-width: 1024px) 92vw, 52vw"
              priority
            />
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
