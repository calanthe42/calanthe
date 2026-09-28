import Image from "next/image";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getDictionary } from "@/lib/i18n/server";

/**
 * One booth, six arrangements.
 *
 * The client's booth deliverable shows the same five panels, vessels, lamps
 * and counter composed six ways (its Sets 1–6). They are shown here as the
 * document numbers them — they genuinely are a numbered set — but named by
 * what can be seen in each, not by panel codes a visitor has no key for.
 *
 * Each render sits on the page's own cream, pre-cropped to the same 4:3 in
 * public/brand/booth, so the row reads as one lookbook rather than six
 * images of different sizes. A swipe row with the next card showing on a
 * phone; a grid of three from a laptop up.
 */
export async function BoothArrangements() {
  const { t } = await getDictionary();
  const b = t.booth;

  return (
    <section className="section-pad">
      <div className="mx-auto max-w-7xl gutter">
        <Reveal className="max-w-2xl">
          <Eyebrow>{b.arrangementsEyebrow}</Eyebrow>
          <h2 className="display-2 mt-3 font-display font-light text-olive">
            {b.arrangementsTitle}
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted">
            {b.arrangementsBody}
          </p>
        </Reveal>
      </div>

      <ol className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-2 lg:mx-auto lg:mt-14 lg:grid lg:max-w-7xl lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12 lg:overflow-visible lg:px-8 lg:pb-0">
        {b.sets.map((set, i) => (
          <li
            key={set.label}
            className="w-[84%] shrink-0 snap-start sm:w-[46%] lg:w-auto"
          >
            <figure>
              <div className="relative aspect-[4/3] overflow-hidden rounded-media-sm bg-canvas ring-1 ring-inset ring-hairline/70">
                <Image
                  src={`/brand/booth/set-${i + 1}.webp`}
                  alt={set.name}
                  fill
                  sizes="(max-width: 640px) 84vw, (max-width: 1024px) 46vw, 30vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-4">
                <p className="font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-ink-muted">
                  {set.label}
                </p>
                <p className="mt-1.5 font-display text-xl leading-snug text-olive">
                  {set.name}
                </p>
                <p className="mt-1 text-base leading-relaxed text-ink-muted lg:text-sm">
                  {set.pieces}
                </p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </section>
  );
}
