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
import { CONTACT, PHOTOS, PRODUCT_PHOTOS } from "@/lib/data";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Floral styling for private celebrations, intimate gatherings and larger occasions — plus guest favors finished in Calanthe's signature packaging.",
};

const FAVORS = [
  "Single-stem favors, wrapped and tied by hand",
  "Miniature vase arrangements for each place setting",
  "Personalised cards, written out rather than printed",
  "Signature Calanthe packaging in your event's palette",
] as const;

const ARRANGEMENTS = [
  "Table centrepieces, low or statement height",
  "Entrance and welcome arrangements",
  "Ceremony and backdrop florals",
  "Installations for larger venues",
] as const;

export default function EventsPage() {
  return (
    <main>
      {/* Opening */}
      <section className="relative overflow-hidden bg-olive section-pad">
        <Monogram className="pointer-events-none absolute -left-[16%] -bottom-[30%] w-[62%] text-cream/[0.04] lg:-left-[6%] lg:w-[30%]" />
        <div className="relative mx-auto max-w-7xl gutter">
          <div className="max-w-2xl">
            <MonogramBloom className="w-11 text-burnt-orange" />
            <Eyebrow className="mt-6 text-cream/60">Events</Eyebrow>
            <SplitLines
              as="h1"
              lines={["Flowers for", "the whole room."]}
              className="mt-3 font-display text-[clamp(2.5rem,7vw,4.25rem)] font-light leading-[1.04] text-cream"
            />
            <Reveal delay={0.15}>
              <p className="mt-7 max-w-lg text-base leading-relaxed text-cream/80">
                Floral styling and arrangements for private celebrations, intimate
                gatherings and larger occasions — planned with you, composed by the
                atelier, delivered and set on the day.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <ButtonLink href={CONTACT.whatsappHref} variant="primary">
                  Enquire on WhatsApp
                </ButtonLink>
                <ButtonLink href="#arrangements" variant="secondary-cream">
                  See what we do
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Event arrangements */}
      <section id="arrangements" className="scroll-mt-24 section-pad">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 gutter lg:grid-cols-2 lg:gap-20">
          <ClipReveal className="relative aspect-[4/5] w-full overflow-hidden rounded-media shadow-soft lg:order-2">
            <FloralImage
              image={{
                alt: "A Calanthe event arrangement",
                src: PRODUCT_PHOTOS.longStemVase,
                placeholder: { seed: "events-arrangements", palette: "olive" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
            />
          </ClipReveal>

          <Reveal className="lg:order-1">
            <Eyebrow>Event arrangements</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              Composed for the space, not the catalogue.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-sage">
              We work from your venue, your palette and the feeling you want the
              room to have — then build to it.
            </p>
            <ul className="mt-8 flex flex-col divide-y divide-hairline border-y border-hairline">
              {ARRANGEMENTS.map((line) => (
                <li key={line} className="flex items-start gap-3 py-3.5">
                  <Monogram className="mt-1 w-3.5 shrink-0 text-burnt-orange" />
                  <span className="text-base leading-relaxed text-olive">{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Guest favors */}
      <section id="guest-favors" className="scroll-mt-24 bg-cream section-pad">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 gutter lg:grid-cols-2 lg:gap-20">
          <ClipReveal className="relative aspect-[4/5] w-full overflow-hidden rounded-media shadow-soft">
            <FloralImage
              image={{
                alt: "Calanthe guest favors, wrapped by hand",
                src: PRODUCT_PHOTOS.softGypsophila,
                placeholder: { seed: "events-favors", palette: "warm" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
            />
          </ClipReveal>

          <Reveal>
            <Eyebrow>Guest favors</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              Something for everyone to take home.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-sage">
              Thoughtfully presented floral gifts finished with Calanthe&rsquo;s
              signature packaging and personal touches — made in the quantities
              your day needs.
            </p>
            <ul className="mt-8 flex flex-col divide-y divide-hairline border-y border-hairline">
              {FAVORS.map((line) => (
                <li key={line} className="flex items-start gap-3 py-3.5">
                  <Monogram className="mt-1 w-3.5 shrink-0 text-burnt-orange" />
                  <span className="text-base leading-relaxed text-olive">{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Enquiry close */}
      <section className="relative overflow-hidden bg-burgundy section-pad">
        <div className="relative mx-auto max-w-7xl gutter text-center">
          <Stagger className="mx-auto max-w-2xl">
            <StaggerItem>
              <Eyebrow className="text-cream/60">Begin</Eyebrow>
            </StaggerItem>
            <StaggerItem>
              <h2 className="display-2 mt-3 font-display font-light text-cream">
                Tell us about the day.
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-6 text-base leading-relaxed text-cream/80">
                Send the date, the venue and roughly how many guests. We will come
                back with a proposal and a quote.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="mt-9 flex flex-wrap justify-center gap-4">
                <ButtonLink href={CONTACT.whatsappHref} variant="primary">
                  WhatsApp {CONTACT.whatsapp}
                </ButtonLink>
                <ButtonLink href={`mailto:${CONTACT.email}`} variant="secondary-cream">
                  Email the atelier
                </ButtonLink>
              </div>
            </StaggerItem>
          </Stagger>

          <ClipReveal className="mx-auto mt-14 aspect-[16/6] w-full max-w-3xl overflow-hidden rounded-media">
            <FloralImage
              image={{
                alt: "Calanthe florals for an occasion",
                src: PHOTOS.poppyMeadow,
                placeholder: { seed: "events-close", palette: "burgundy" },
              }}
              sizes="(max-width: 1024px) 92vw, 60vw"
            />
          </ClipReveal>
        </div>
      </section>
    </main>
  );
}
