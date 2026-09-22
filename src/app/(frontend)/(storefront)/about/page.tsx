import type { Metadata } from "next";
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
import { LilyField } from "@/components/ui/LilyField";

export const metadata: Metadata = {
  title: "About",
  description:
    "Calanthe is an Abu Dhabi-based floral brand created around the art of thoughtful giving — classical elegance with a contemporary creative touch.",
};

/* The client's six services, in their own words (portfolio, p.3). */
const SERVICES = [
  {
    name: "Signature Florals",
    copy: "Handcrafted bouquets and vase arrangements for everyday gestures and special occasions.",
  },
  {
    name: "Bespoke Florals",
    copy: "Personalised arrangements created around a preferred budget, colour palette, message or occasion.",
  },
  {
    name: "Events",
    copy: "Floral styling and arrangements for private celebrations, intimate gatherings and larger occasions.",
  },
  {
    name: "Memberships",
    copy: "Recurring floral deliveries designed to bring fresh flowers into homes or businesses throughout the month.",
  },
  {
    name: "Gifting",
    copy: "Thoughtfully presented floral gifts finished with Calanthe's signature packaging and personal touches.",
  },
  {
    name: "Corporate",
    copy: "Florals and gifting solutions for offices, businesses, clients and corporate occasions.",
  },
] as const;

export default function AboutPage() {
  return (
    <main>
      {/* Opening — burgundy, the brand's intimate register (SKILL.md). */}
      <section className="relative overflow-hidden bg-burgundy section-pad">
        <Monogram className="pointer-events-none absolute -right-[18%] -top-[26%] w-[68%] text-cream/[0.035] lg:-right-[8%] lg:w-[34%]" />
        <div className="relative mx-auto max-w-7xl gutter">
          <div className="mx-auto max-w-3xl text-center">
            <MonogramBloom className="mx-auto w-12 text-burnt-orange" />
            <Eyebrow className="mt-6 text-cream/60">Abu Dhabi</Eyebrow>
            <SplitLines
              as="h1"
              lines={["About Calanthe"]}
              className="mt-3 font-display text-[clamp(2.5rem,7vw,4rem)] font-light leading-[1.05] text-cream"
            />
            <Reveal delay={0.15}>
              <p className="mt-8 text-lg leading-relaxed text-cream/85">
                Calanthe is an Abu Dhabi-based floral brand created around the art
                of thoughtful giving.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* The belief — words on the left, the flowers answering on the right. */}
      <section className="section-pad">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 gutter lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <Eyebrow>Our belief</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              More than a beautiful gesture.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
              We believe flowers carry emotion, mark meaningful moments and express
              what words sometimes cannot.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted">
              Our arrangements combine classical elegance with a contemporary
              creative touch, bringing together carefully selected flowers, refined
              compositions and distinctive details. From intimate gestures to
              important celebrations, each Calanthe creation is designed with
              intention.
            </p>
          </Reveal>

          <ClipReveal className="relative aspect-[4/5] w-full overflow-hidden rounded-media shadow-soft">
            <FloralImage
              image={{
                alt: "A Calanthe arrangement in its burgundy bag, against deep green velvet",
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
            <Eyebrow>What we do</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              Our services
            </h2>
          </Reveal>

          <Stagger className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <StaggerItem key={s.name}>
                <div className="border-t border-hairline pt-5">
                  <h3 className="font-display text-2xl font-light text-olive">
                    {s.name}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-ink-muted">{s.copy}</p>
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
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <LilyField
            opacity={0.05}
            className="absolute -top-[30%] start-[-40%] w-[130%] text-olive rtl:-scale-x-100 lg:w-[70%]"
          />
        </div>

        <div className="mx-auto grid max-w-7xl gutter gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-20">
          <ClipReveal className="relative aspect-[3/4] w-full overflow-hidden rounded-media shadow-soft lg:order-2">
            <FloralImage
              image={{
                alt: "Calanthe orchid buds, the flower the brand is named after",
                src: "/brand/orchid-buds.webp",
                placeholder: { seed: "about-name", palette: "olive" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
            />
          </ClipReveal>

          <div className="lg:order-1">
            <Reveal>
              <Eyebrow>The name</Eyebrow>
            </Reveal>
            <SplitLines
              as="h2"
              lines={["kalos — beautiful.", "anthos — flower."]}
              className="display-2 mt-4 font-display font-light italic text-olive"
            />
            <Reveal delay={0.15}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
                Calanthe is an orchid, and its name is Greek. More than a
                flower, it reflects a philosophy of beauty that is quiet,
                timeless and deeply meaningful — which is the standard every
                arrangement that leaves this atelier is held to.
              </p>
            </Reveal>

            <Reveal delay={0.25}>
              <div className="mt-10 flex items-start gap-5 border-t border-hairline pt-8">
                <Monogram className="mt-1 w-12 shrink-0 text-burnt-orange" />
                <p className="max-w-sm text-base leading-relaxed text-ink-muted">
                  The mark is built from the same flower: petals and leaves
                  simplified, arranged symmetrically, and resolved until the
                  outline reads as a{" "}
                  {/* One glyph: tracking would only add a gap before the full stop. */}
                  <span lang="en" className="font-brand text-olive">C</span>.
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
            <Eyebrow>The details</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              Down to the ribbon.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              Everything that reaches you is part of the gift — the tag, the
              tissue, the card, the ribbon that ties it.
            </p>
          </Reveal>

          <Stagger className="mt-12 grid grid-cols-2 gap-4 lg:mt-16 lg:grid-cols-4 lg:gap-6">
            {[
              { src: "/brand/ribbon.webp", alt: "Terracotta ribbon printed with the Calanthe wordmark and monogram", label: "Printed ribbon" },
              { src: "/brand/lilies-tag.webp", alt: "A die-cut lily hang tag resting among white lilies", label: "Lily hang tag" },
              { src: "/brand/wrap-sticker.webp", alt: "Monogrammed tissue paper closed with a Calanthe sticker", label: "Tissue and seal" },
              { src: "/brand/cards-debossed.webp", alt: "A burgundy Calanthe greeting card, debossed with lilies, its gold tab pressed with the monogram", label: "Debossed card" },
            ].map((item) => (
              <StaggerItem key={item.src}>
                <figure>
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-media">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 1024px) 46vw, 23vw"
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
          <ClipReveal className="mx-auto mb-12 aspect-[16/7] w-full max-w-3xl overflow-hidden rounded-media">
            <FloralImage
              image={{
                alt: "A bloom opening, lit from within — Calanthe's key visual",
                src: "/brand/keyvisual-bloom.webp",
                placeholder: { seed: "about-close", palette: "burgundy" },
              }}
              sizes="(max-width: 1024px) 92vw, 60vw"
            />
          </ClipReveal>
          <SplitLines
            as="p"
            lines={["Where feelings take form."]}
            className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-light italic text-cream"
          />
          <Reveal delay={0.15}>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/shop" variant="primary">
                Shop Flowers
              </ButtonLink>
              <ButtonLink href="/build-your-own" variant="secondary-cream">
                Build Your Own
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
