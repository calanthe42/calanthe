import { ClipReveal } from "@/components/motion/ClipReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SplitLines } from "@/components/motion/SplitLines";
import { TextLoop } from "@/components/motion/TextLoop";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FloralImage } from "@/components/ui/FloralImage";
import { LilyField } from "@/components/ui/LilyField";
import { Monogram } from "@/components/ui/Monogram";

/**
 * THE SEAL — the first thing after the hero.
 *
 * The brand closes every parcel the same way: embossed paper, the printed
 * ribbon, and the monogram pressed into a disc of wax. A disc with the
 * wordmark running round its rim IS that object, so the type does not need
 * a band to travel along — it turns, slowly, the way a seal is set down.
 *
 * WHY NOT A ROW OF PHOTOGRAPHS. The first version put a marquee of packshots
 * under the type: two things moving in opposite directions, neither of them
 * the subject. The subject is one photograph — the bag against green velvet,
 * the way the identity shoots it — with the seal pressed onto its corner,
 * exactly where a seal goes.
 *
 * COMPOSITION. Asymmetric: the photograph holds the reading edge and runs
 * taller than the text beside it, the seal straddles the two so nothing sits
 * in its own box, and the lily linework is printed across the ground behind
 * both. Motion is one idea — the rim turns; the photograph uncovers once and
 * then is still.
 */
export function SealMoment() {
  return (
    <section className="relative isolate overflow-hidden section-pad">
      {/* The paper this is printed on. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <LilyField
          opacity={0.07}
          className="absolute -top-[22%] end-[-42%] w-[145%] text-olive rtl:-scale-x-100 lg:-top-[30%] lg:end-[-14%] lg:w-[62%]"
        />
      </div>

      <div className="mx-auto grid max-w-7xl gutter gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-16">
        {/* The photograph, and the seal pressed on its corner. */}
        <div className="relative">
          <ClipReveal className="relative aspect-[4/5] w-full overflow-hidden rounded-sm shadow-soft sm:aspect-[3/4] lg:aspect-[4/5]">
            <FloralImage
              image={{
                alt: "A Calanthe arrangement in its burgundy bag against deep green velvet",
                src: "/brand/packaging-curtain.webp",
                placeholder: { seed: "seal-moment", palette: "burgundy" },
              }}
              sizes="(max-width: 1024px) 92vw, 52vw"
              priority
            />
          </ClipReveal>

          {/*
            THE SEAL ITSELF. Half on the photograph, half off it — a seal is
            pressed across a join, never centred in a space of its own. The
            disc is cream so it reads on both the dark velvet and the page.
          */}
          <div className="absolute -bottom-10 end-[-1.25rem] w-36 sm:w-44 lg:-bottom-14 lg:end-[-3.5rem] lg:w-56">
            <div className="relative aspect-square">
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-cream shadow-soft ring-1 ring-hairline/70"
              />
              <TextLoop
                text="Calanthe"
                separator="✦"
                shape="circle"
                viewW={520}
                viewH={520}
                curviness={132}
                ribbonWidth={0}
                speed={26}
                fontSize={38}
                letterSpacing={7}
                color="var(--color-olive)"
                className="absolute inset-0 font-brand"
              />
              <Monogram
                aria-hidden
                className="absolute left-1/2 top-1/2 w-[38%] -translate-x-1/2 -translate-y-1/2 text-burnt-orange"
              />
            </div>
          </div>
        </div>

        {/* The words, held to a short measure so the photograph leads. */}
        <div className="mt-14 lg:mt-0">
          <Reveal>
            <Eyebrow>Sealed by hand</Eyebrow>
          </Reveal>
          <SplitLines
            as="h2"
            lines={["Nothing leaves", "this atelier open."]}
            className="display-2 mt-3 font-display font-light text-olive"
          />
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted">
              Wrapped in embossed paper, tied with our printed ribbon, and
              closed with the monogram — pressed while the flowers are still
              cool from the studio.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="mt-8 flex flex-wrap gap-4">
              <ButtonLink href="/shop" variant="primary">
                Shop the collection
              </ButtonLink>
              <ButtonLink href="/about" variant="secondary">
                How we wrap
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
