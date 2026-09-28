import type { Metadata } from "next";
import Image from "next/image";
import { getDictionary } from "@/lib/i18n/server";
import { EventEnquiryForm } from "@/components/commerce/EventEnquiryForm";
import { BoothArrangements } from "@/components/events/BoothArrangements";
import { BoothShowcase } from "@/components/events/BoothShowcase";
import { BloomReveal } from "@/components/motion/BloomReveal";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { SplitLines } from "@/components/motion/SplitLines";
import { Arch } from "@/components/ui/Arch";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FloralImage } from "@/components/ui/FloralImage";
import { Icon360 } from "@/components/ui/icons";
import { Monogram } from "@/components/ui/Monogram";
import { MonogramBloom } from "@/components/motion/MonogramBloom";
import { CONTACT } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    description:
      "Floral styling for private celebrations, intimate gatherings and larger occasions — plus guest favors finished in Calanthe's signature packaging.",
    title: t.meta.events,
  };
}

export default async function EventsPage() {
  const { t } = await getDictionary();

  return (
    <main>
      {/* OPENING. The olive of the bag, printed with the orchid from the
          client's own wallpaper, as the bag is. The right half used to be
          empty olive; it now holds the booth itself, through an arch cut
          like the booth's mirror, and the arch is the way in to it. */}
      <section className="relative overflow-hidden bg-olive bg-[url(/brand/print/orchid-olive.webp)] bg-[length:32rem_auto] bg-repeat section-pad lg:bg-[length:44rem_auto]">
        {/* From a laptop up the print gives way behind the words and keeps
            its full strength behind the arch. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_right,var(--color-olive)_28%,transparent_72%)] lg:block rtl:bg-[linear-gradient(to_left,var(--color-olive)_28%,transparent_72%)]"
        />
        <div className="relative mx-auto grid max-w-7xl gap-14 gutter lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
          <div className="max-w-2xl">
            <MonogramBloom className="w-11 text-burnt-orange" />
            <Eyebrow className="mt-6 text-cream/60">{t.events.eyebrow}</Eyebrow>
            <SplitLines
              as="h1"
              lines={[t.events.line1, t.events.line2]}
              className="mt-3 font-display text-[clamp(2.5rem,7vw,4.25rem)] font-light leading-[1.04] text-cream"
            />
            <Reveal delay={0.15}>
              <p className="mt-7 max-w-lg text-base leading-relaxed text-cream/80">
                {t.events.intro}
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <ButtonLink href={CONTACT.whatsappHref} variant="primary">
                  {t.events.enquireWhatsapp}
                </ButtonLink>
                <ButtonLink href="#arrangements" variant="secondary-cream">
                  {t.events.seeWhatWeDo}
                </ButtonLink>
              </div>
            </Reveal>
          </div>

          <a
            href="#booth"
            className="group mx-auto block w-[78%] max-w-[24rem] sm:w-[56%] lg:w-full lg:max-w-[27rem] lg:justify-self-end"
          >
            <Arch ring="cream">
              <Image
                src="/brand/booth/arch.webp"
                alt={t.events.archAlt}
                fill
                priority
                sizes="(max-width: 640px) 78vw, (max-width: 1024px) 56vw, 27rem"
                className="object-cover transition-transform duration-700 ease-bloom group-hover:scale-[1.03]"
              />
            </Arch>
            <span className="mt-4 flex min-h-11 items-center justify-center gap-3 font-brand text-xs font-medium uppercase tracking-brand text-cream">
              <Icon360 className="h-4 w-4 text-burnt-orange" />
              {t.events.boothLink}
            </span>
          </a>
        </div>
      </section>

      {/* The booth: the client's 360° panorama and renders in one frame,
          then the six arrangements from the booth deliverable. */}
      <BoothShowcase />
      <BoothArrangements />

      {/* Event arrangements */}
      <section
        id="arrangements"
        className="scroll-mt-24 border-t border-hairline section-pad"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 gutter lg:grid-cols-2 lg:gap-20">
          <ClipReveal className="relative aspect-[4/5] w-full overflow-hidden rounded-media shadow-soft lg:order-2">
            <FloralImage
              image={{
                alt: t.booth.vesselsAlt,
                src: "/brand/booth/vessels.webp",
                placeholder: { seed: "events-arrangements", palette: "olive" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
            />
          </ClipReveal>

          <Reveal className="lg:order-1">
            <Eyebrow>{t.events.arrangementsEyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              {t.events.arrangementsTitle}
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
              {t.events.arrangementsBody}
            </p>
            <ul className="mt-8 flex flex-col divide-y divide-hairline border-y border-hairline">
              {t.events.arrangements.map((line) => (
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
                alt: t.booth.counterAlt,
                src: "/brand/booth/counter.webp",
                placeholder: { seed: "events-favors", palette: "warm" },
              }}
              sizes="(max-width: 1024px) 92vw, 46vw"
            />
          </ClipReveal>

          <Reveal>
            <Eyebrow>{t.events.favorsEyebrow}</Eyebrow>
            <h2 className="display-2 mt-3 font-display font-light text-olive">
              {t.events.favorsTitle}
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-muted">
              {t.events.favorsBody}
            </p>
            <ul className="mt-8 flex flex-col divide-y divide-hairline border-y border-hairline">
              {t.events.favors.map((line) => (
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
              <Eyebrow className="text-cream/60">{t.events.beginEyebrow}</Eyebrow>
            </StaggerItem>
            <StaggerItem>
              <h2 className="display-2 mt-3 font-display font-light text-cream">
                {t.events.beginTitle}
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-6 text-base leading-relaxed text-cream/80">
                {t.events.beginBody}
              </p>
            </StaggerItem>
            {/* A real form, not two links off-site. Events are the atelier's
                largest and most date-sensitive orders, and until now an
                enquiry left no trace anywhere — see EventEnquiryForm. */}
            <StaggerItem>
              <div className="mt-10 text-start">
                <EventEnquiryForm />
              </div>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-8 text-sm text-cream/60">
                {t.events.orEmail}{" "}
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="underline decoration-cream/30 underline-offset-4 transition-colors hover:decoration-burnt-orange"
                >
                  {CONTACT.email}
                </a>
              </p>
            </StaggerItem>
          </Stagger>

          {/* THE CLOSE. The client's wallpaper is this burgundy, printed
              with orchids a shade darker — so the page ends on a panel of
              it, cut as an arch. As it arrives, one orchid lights up in
              cream from its heart outward: the print, coming alive.
              Decorative, so it says nothing to a screen reader. */}
          <div aria-hidden className="mx-auto mt-16 w-[68%] max-w-[19rem] lg:mt-20 lg:w-[21rem] lg:max-w-none">
            <Arch ring="cream">
              <Image
                src="/brand/print/orchid-arch.webp"
                alt=""
                fill
                sizes="(max-width: 1024px) 68vw, 21rem"
                className="object-cover"
              />
              <BloomReveal at="50% 50%" className="absolute inset-0">
                <Image
                  src="/brand/print/orchid-arch-lit.webp"
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 68vw, 21rem"
                  className="object-cover"
                />
              </BloomReveal>
            </Arch>
          </div>
        </div>
      </section>
    </main>
  );
}
