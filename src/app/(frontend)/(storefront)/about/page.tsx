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
import { PHOTOS, PRODUCT_PHOTOS } from "@/lib/data";

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
            <p className="mt-6 max-w-md text-base leading-relaxed text-sage">
              We believe flowers carry emotion, mark meaningful moments and express
              what words sometimes cannot.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-sage">
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
                alt: "A Calanthe arrangement, composed by hand",
                src: PRODUCT_PHOTOS.amberVase,
                placeholder: { seed: "about-atelier", palette: "warm" },
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
                  <p className="mt-3 text-base leading-relaxed text-sage">{s.copy}</p>
                </div>
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
                alt: "Calanthe flowers, close",
                src: PHOTOS.redRoses,
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
