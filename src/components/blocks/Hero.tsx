import { Parallax } from "@/components/motion/Parallax";
import { PetalDrift } from "@/components/motion/PetalDrift";
import { SplitLines } from "@/components/motion/SplitLines";
import { ButtonLink } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { HeroMedia } from "@/components/blocks/HeroMedia";
import { getDictionary } from "@/lib/i18n/server";

type HeroProps = {
  /**
   * SWAP POINT: pass any node that fills its parent. Left unset, the
   * hero renders <HeroMedia />, which is the poster photograph plus the
   * optional hero film (see lib/hero-media.ts) — the section itself
   * doesn't care what fills it.
   */
  media?: React.ReactNode;
};

/**
 * Hero — full-viewport, photography-led, and composed on ONE axis.
 *
 * WHAT WAS WRONG. The frame carried two centres: a 560px cream wordmark
 * dead-centre, and the eyebrow/headline/CTA stack ranged left underneath it.
 * Nothing told the eye which to read first, and the wordmark landed on the
 * brightest, busiest part of the bouquet, where half its letters were eaten
 * by daisies. Two focal points is not art direction; it is an unresolved
 * layout.
 *
 * WHAT IT IS NOW. Identity lives in the header, permanently and centred
 * (see Header.tsx). The hero therefore has one job — say the thing — and
 * everything in it hangs off a single left margin: a small monogram, then
 * the eyebrow, then the headline, then the two actions. The photograph is
 * the hero; the words are a caption to it, bottom-start, where a magazine
 * would set them.
 *
 * ONE ORDER, TOP TO BOTTOM: mark → eyebrow → headline → actions.
 */
export async function Hero({ media }: HeroProps) {
  const { t } = await getDictionary();

  return (
    <section
      data-hero-root
      className="relative -mt-[6.25rem] flex h-svh min-h-[600px] flex-col justify-end overflow-hidden bg-olive lg:-mt-[7.5rem]"
    >
      {/* Full-bleed photography — the visual centerpiece. Parallax is
          desktop-only: on a phone the travelling logo is the one
          scroll-linked animation on this screen, and it keeps every
          frame it can get. */}
      <Parallax speed={0.93} desktopOnly className="absolute inset-0">
        <div className="hero-kenburns h-full w-full">{media ?? <HeroMedia />}</div>
      </Parallax>

      {/* Petals crossing the frame — the one piece of ambient motion on the
          page. Above the photograph so they catch its light, below the
          scrims and the words so nothing they pass behind becomes harder to
          read. CSS only; removed entirely under reduced motion. */}
      <PetalDrift />

      {/* Two soft scrims, both fading to nothing so the photograph keeps
          its own colour: one behind the centred mark (the bouquet's
          daisies are bright, and the mark is cream), one where the words
          sit at the bottom-left. */}
      {/*
        ONE scrim, anchored where the words are, plus a light touch across
        the very top so the header's type has something to sit on. The old
        centre scrim existed only to rescue the centred wordmark from the
        daisies behind it; with the wordmark gone, so is the reason to grey
        out the middle of the photograph — which is most of what made the
        image look flat and washed.
      */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: [
            "linear-gradient(to bottom, rgba(43,47,27,0.46) 0%, rgba(43,47,27,0.12) 18%, rgba(43,47,27,0) 32%)",
            "radial-gradient(115% 95% at 4% 100%, rgba(43,47,27,0.86) 0%, rgba(43,47,27,0.52) 32%, rgba(43,47,27,0.14) 58%, rgba(43,47,27,0) 78%)",
          ].join(", "),
        }}
      />
      {/* Phones only: the tall crop puts the brightest part of the
          bouquet directly behind the words, so they need a firmer
          floor than the desktop crop does. */}
      {/* The phone crop puts the bouquet's brightest daisies directly behind
          the eyebrow and the first headline line, so the floor has to reach
          further up and hold longer than the desktop one — measured against
          the actual crop, not guessed. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-olive/95 via-olive/62 to-transparent lg:hidden"
      />

      {/* Content — bottom-start: thumb zone on a phone, the classic
          editorial caption position on a laptop.
          The bottom padding on a phone clears the floating WhatsApp button
          (48px inset 20px from the corner): the actions are full-width, so
          anything parked in that corner sits on top of the second one. */}
      <div className="relative z-10 mx-auto w-full max-w-7xl gutter pb-[calc(env(safe-area-inset-bottom)+5.75rem)] lg:pb-24">
        <div className="max-w-xl">
          {/* The mark sits ON the eyebrow's line rather than floating above
              it: alone it landed on a white daisy and read as a smudge, and
              a lone symbol with nothing beside it is not a lockup. Together
              they are one object, and they share the same band of the
              photograph — so if one is legible, both are. */}
          <p className="mb-4 flex items-center gap-2.5 font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-cream lg:mb-5 lg:text-xs">
            <Monogram className="w-5 shrink-0 text-cream/90 lg:w-[1.375rem]" />
            {t.hero.eyebrow}
          </p>

          <SplitLines
            as="h1"
            immediate
            delay={0.25}
            lines={[t.hero.headlineOne, t.hero.headlineTwo]}
            className="mb-9 font-display text-[clamp(2.9rem,11vw,3.9rem)] font-light leading-[1.02] text-cream lg:mb-11 lg:text-[clamp(3.6rem,5vw,5.25rem)]"
          />

          <div className="hero-cta-in">
            {/*
              STACKED ON A PHONE, SIDE BY SIDE FROM 400px.

              Two `flex-1` buttons with `whitespace-nowrap` could not fit
              "BUILD YOUR OWN" in 170px at 390px wide, so it rendered as
              "BUILD YOUR O" — text clipped by a container that had been
              told never to wrap it. Full-width rows cannot clip, give a
              48px target instead of 43px, and put both actions squarely in
              the thumb zone. The near-square corner is the brand's
              (radius-sm, 2px); the fully-rounded pill was neither in the
              system nor in character.
            */}
            <div className="flex flex-col gap-3 min-[400px]:flex-row min-[400px]:gap-3.5 sm:max-w-lg">
              <ButtonLink
                href="/shop"
                variant="glass-primary"
                className="w-full min-[400px]:flex-1 lg:w-auto lg:flex-none lg:px-12"
              >
                {t.hero.shopFlowers}
              </ButtonLink>
              <ButtonLink
                href="/build-your-own"
                variant="glass"
                className="w-full min-[400px]:flex-1 lg:w-auto lg:flex-none lg:px-12"
              >
                {t.hero.buildYourOwn}
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
