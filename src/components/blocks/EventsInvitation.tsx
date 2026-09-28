import Image from "next/image";
import { getDictionary } from "@/lib/i18n/server";
import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SplitLines } from "@/components/motion/SplitLines";
import { Arch } from "@/components/ui/Arch";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * THE WAY INTO EVENTS — added to the homepage at the client's instruction,
 * straight after "shop by occasion": the occasions a bouquet answers, then
 * the ones a room full of people does.
 *
 * It borrows the Events page's own opening — the arch cut like the booth's
 * mirror, the orchid print from the client's wallpaper — so following the
 * link feels like walking through a door rather than landing somewhere
 * new. Here the print is olive on cream, the terracotta sleeve's treatment
 * in reverse. Two ways in: the booth, or straight to the guest favors.
 */
export async function EventsInvitation() {
  const { t } = await getDictionary();
  const v = t.eventsInvite;

  return (
    <section className="relative overflow-hidden bg-cream bg-[url(/brand/print/orchid-cream.webp)] bg-[length:30rem_auto] bg-repeat section-pad lg:bg-[length:42rem_auto]">
      <div className="mx-auto grid max-w-7xl items-center gap-12 gutter lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <Arch ring="olive" className="mx-auto w-[78%] max-w-[24rem] sm:w-[56%] lg:w-full lg:max-w-[26rem]">
          <ClipReveal className="absolute inset-0">
            <Image
              src="/brand/booth/arch.webp"
              alt={t.events.archAlt}
              fill
              sizes="(max-width: 640px) 78vw, (max-width: 1024px) 56vw, 26rem"
              className="object-cover"
            />
          </ClipReveal>
        </Arch>

        <div>
          <Reveal>
            <Eyebrow>{v.eyebrow}</Eyebrow>
          </Reveal>
          <SplitLines
            as="h2"
            lines={[v.title]}
            className="display-2 mt-3 max-w-md font-display font-light text-olive"
          />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted">
              {v.body}
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/events#booth" variant="primary">
                {t.events.boothLink}
              </ButtonLink>
              <ButtonLink href="/events#guest-favors" variant="secondary">
                {v.favors}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
