import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { SplitLines } from "@/components/motion/SplitLines";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FloralImage } from "@/components/ui/FloralImage";
import { Monogram } from "@/components/ui/Monogram";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import Image from "next/image";
import { OrchidPrint } from "@/components/ui/OrchidPrint";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    description:
      "Calanthe is an Abu Dhabi-based floral brand created around the art of thoughtful giving — classical elegance with a contemporary creative touch.",
    title: t.meta.about,
  };
}

/*
 * The client's six services (portfolio, p.3), in the order she gave them.
 * The words are in the dictionary; this is only the running order, which is
 * client-approved and must not change.
 */
const SERVICE_ORDER = [
  "signature",
  "bespoke",
  "events",
  "memberships",
  "gifting",
  "corporate",
] as const;

export default async function AboutPage() {
  const { t } = await getDictionary();

  return (
    <main>
      {/* Opening — burgundy, the brand's intimate register (SKILL.md). */}
      <section className="relative overflow-hidden bg-burgundy section-pad">
        <Monogram className="pointer-events-none absolute -right-[18%] -top-[26%] w-[68%] text-cream/[0.035] lg:-right-[8%] lg:w-[34%]" />
        <div className="relative mx-auto max-w-7xl gutter">
          <div className="mx-auto max-w-3xl text-center">
            <MonogramBloom className="mx-auto w-12 text-burnt-orange" />
            <Eyebrow className="mt-6 text-cream/60">{t.about.eyebrow}</Eyebrow>
            <SplitLines
              as="h1"
              lines={[t.about.title]}
              className="mt-3 font-display text-[clamp(2.5rem,7vw,4rem)] font-light leading-[1.05] text-cream"
            />
            <Reveal delay={0.15}>
              <p className="mt-8 text-lg leading-relaxed text-cream/85">
                {t.about.intro}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* The belief — words on the left, the flowers answering on the right. */}
      <section className="section-pad">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 gutter lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <Eyebrow>{t.about.beliefEyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              {t.about.beliefTitle}
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
              {t.about.beliefBody1}
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">
              {t.about.beliefBody2}
            </p>
          </Reveal>

          <ClipReveal className="relative aspect-[4/5] w-full overflow-hidden rounded-media shadow-soft">
            <FloralImage
              image={{
                alt: t.alt.aboutBag,
                src: "/brand/packaging-curtain.webp",
                placeholder: { seed: "about-atelier", palette: "burgundy" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
            />
          </ClipReveal>
        </div>
      </section>

      {/* Services — the client's six, as an editorial index, not cards. */}
      <section className="bg-cream section-pad">
        <div className="mx-auto max-w-7xl gutter">
          <Reveal className="text-center">
            <Eyebrow>{t.about.servicesEyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              {t.about.servicesTitle}
            </h2>
          </Reveal>

          <Stagger className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
            {SERVICE_ORDER.map((id) => (
              <StaggerItem key={id}>
                <div className="border-t border-hairline pt-5">
                  <h3 className="font-display text-2xl font-light text-olive">
                    {t.about.services[id].name}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-ink-muted">
                    {t.about.services[id].copy}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/*
        THE NAME — the one thing about this brand nobody can look up.

        It is in the identity book and it was nowhere on the website:
        Calanthe is an orchid, and the word is Greek — kalos, beautiful, and
        anthos, flower. That is the whole brand in two words, and it is the
        rare piece of copy a reader actually wants to finish. It earns an
        asymmetric spread of its own: the etymology set large as editorial
        type, the orchid the name belongs to beside it, and the monogram
        explained underneath, because the mark IS those petals arranged
        until they make a "C".
      */}
      <section className="relative isolate overflow-hidden section-pad">
        <OrchidPrint ground="canvas" />

        <div className="mx-auto grid max-w-7xl gutter gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-20">
          <ClipReveal className="relative aspect-[3/4] w-full overflow-hidden rounded-media shadow-soft lg:order-2">
            <FloralImage
              image={{
                alt: t.alt.aboutOrchid,
                src: "/brand/orchid-buds.webp",
                placeholder: { seed: "about-name", palette: "olive" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
            />
          </ClipReveal>

          <div className="lg:order-1">
            <Reveal>
              <Eyebrow>{t.about.nameEyebrow}</Eyebrow>
            </Reveal>
            <SplitLines
              as="h2"
              lines={[t.about.nameLine1, t.about.nameLine2]}
              className="display-2 mt-4 font-display font-light italic text-olive"
            />
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
                {t.about.nameBody}
              </p>
            </Reveal>

            <Reveal delay={0.25}>
              <div className="mt-10 flex items-start gap-5 border-t border-hairline pt-8">
                <Monogram className="mt-1 w-12 shrink-0 text-burnt-orange" />
                <p className="max-w-sm text-base leading-relaxed text-ink-muted">
                  {/*
                    The "C" is one glyph in the brand face, set inside the
                    sentence — so the sentence owns the slot and the glyph is
                    dropped into it, rather than the sentence being split in
                    two around it (which is what left this in English).
                  */}
                  {t.about.monogramNote.split("{letter}").map((part, i) => (
                    <span key={i}>
                      {i > 0 && (
                        <span lang="en" className="font-brand text-olive">
                          C
                        </span>
                      )}
                      {part}
                    </span>
                  ))}
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/*
        THE DETAILS — "every touchpoint, down to the smallest."

        The brand's own words, and the proof of them is physical: printed
        ribbon, a lily hang tag, tissue that repeats the monogram, an
        embossed card. Four objects, no frames, no captions competing with
        them — the pieces a customer actually holds, laid out the way the
        identity book lays them out.
      */}
      <section className="bg-cream section-pad">
        <div className="mx-auto max-w-7xl gutter">
          <Reveal className="max-w-xl">
            <Eyebrow>{t.about.detailsEyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              {t.about.detailsTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              {t.about.detailsBody}
            </p>
          </Reveal>

          <Stagger className="mt-12 grid grid-cols-2 gap-4 lg:mt-16 lg:grid-cols-4 lg:gap-6">
            {/* The bag and the sleeve replaced the printed ribbon and the
                tissue paper (2026-10-06): the atelier will not offer either
                in its first months, so the page shows only what a customer
                receives. The pictures are the identity book's own, at full
                resolution and a higher encoding quality than the default. */}
            {[
              {
                src: "/brand/about-bag.webp",
                alt: t.alt.aboutBagTile,
                label: t.alt.labelBag,
              },
              {
                src: "/brand/about-sleeve.webp",
                alt: t.alt.aboutSleeve,
                label: t.alt.labelSleeve,
              },
              {
                src: "/brand/lilies-tag.webp",
                alt: t.alt.aboutTag,
                label: t.alt.labelTag,
              },
              {
                src: "/brand/cards-debossed.webp",
                alt: t.alt.aboutCard,
                label: t.alt.labelCard,
              },
            ].map((item) => (
              <StaggerItem key={item.src}>
                <figure>
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-media">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 1024px) 46vw, 23vw"
                      quality={90}
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="mt-3 font-brand text-[0.625rem] uppercase tracking-brand text-ink-muted">
                    {item.label}
                  </figcaption>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Close — the line the whole brand rests on. */}
      <section className="relative overflow-hidden bg-olive section-pad">
        <div className="relative mx-auto max-w-7xl gutter text-center">
          {/* The key visual is a portrait photograph. It was cropped to a
              16:7 strip, which showed a band of petals and no flower; it is
              now shown whole. */}
          <ClipReveal className="mx-auto mb-12 aspect-[4/5] w-full max-w-sm overflow-hidden rounded-media">
            <FloralImage
              image={{
                alt: t.alt.aboutBloom,
                src: "/brand/keyvisual-bloom.webp",
                placeholder: { seed: "about-close", palette: "burgundy" },
              }}
              sizes="(max-width: 640px) 92vw, 24rem"
            />
          </ClipReveal>
          <SplitLines
            as="p"
            lines={[t.about.closingLine]}
            className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-light italic text-cream"
          />
          <Reveal delay={0.15}>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/shop" variant="primary">
                {t.cart.shopFlowers}
              </ButtonLink>
              <ButtonLink href="/build-your-own" variant="secondary-cream">
                {t.cart.buildYourOwn}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
