import { HairlineDraw } from "@/components/motion/HairlineDraw";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { LilyField } from "@/components/ui/LilyField";
import { CONTACT } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

/**
 * The service promise, stated once and plainly.
 *
 * Only things the atelier does on every order appear here (see TRUST in
 * lib/data.ts for why there is no rating, count or press strip). The
 * heading sits beside the promises on desktop rather than centred above
 * them, so the band reads as a statement with its evidence, and the one
 * line under it is a real way to ask a question before ordering.
 */
export async function TrustBand() {
  const { t } = await getDictionary();
  const guarantees = [
    { title: t.trust.sameDayTitle, copy: t.trust.sameDayCopy },
    { title: t.trust.videoTitle, copy: t.trust.videoCopy },
    { title: t.trust.freshTitle, copy: t.trust.freshCopy },
    { title: t.trust.emiratesTitle, copy: t.trust.emiratesCopy },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-cream section-pad">
      {/* The same pressed lily that runs through the top of the page, turned
          the other way and cropped by the opposite edge — the promise band
          is printed on the brand's paper too, not on a plain field. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <LilyField
          opacity={0.055}
          className="absolute -bottom-[45%] end-[-35%] w-[135%] text-olive rtl:-scale-x-100 lg:-bottom-[60%] lg:end-[-10%] lg:w-[55%]"
        />
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 gutter lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Reveal>
          <h2 className="display-2 font-display font-light text-olive">
            {t.sections.promiseTitle}
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-muted">
            {t.sections.promiseAsk}{" "}
            <a
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="text-olive underline decoration-hairline underline-offset-4 transition-colors duration-200 ease-bloom hover:decoration-burnt-orange"
            >
              WhatsApp
            </a>
            .
          </p>
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-x-8 gap-y-9 sm:grid-cols-2">
          {guarantees.map((g, i) => (
            <StaggerItem key={g.title}>
              <HairlineDraw delay={i * 0.1} className="mb-4" />
              <h3 className="font-brand text-xs font-medium uppercase tracking-brand text-olive">
                {g.title}
              </h3>
              <p className="mt-2 max-w-xs text-base leading-relaxed text-ink-muted">
                {g.copy}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
