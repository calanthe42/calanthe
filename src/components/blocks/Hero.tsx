import { Parallax } from "@/components/motion/Parallax";
import { PetalDrift } from "@/components/motion/PetalDrift";
import { SplitLines } from "@/components/motion/SplitLines";
import { ButtonLink } from "@/components/ui/Button";
import { StackedLogo } from "@/components/ui/StackedLogo";
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
 * TWO CENTRES, RESOLVED IN TIME RATHER THAN SPACE. The frame used to carry a
 * 560px wordmark dead-centre AND an eyebrow/headline/CTA stack ranged left
 * beneath it, with nothing to say which to read first. It still opens on the
 * centred mark, because that is the brand moment — but the mark is no longer
 * a second object competing with the words. It is the HEADER's own mark,
 * transformed down into this frame (see HeroMarkTravel.tsx), and it withdraws
 * into the bar the moment the visitor scrolls. The mark is read first, then
 * the words, because the mark leaves.
 *
 * Everything written hangs off a single left margin, bottom-start, where a
 * magazine would set a caption to a full-bleed photograph.
 */
export async function Hero({ media }: HeroProps) {
  const { t } = await getDictionary();

  return (
    <section
      data-hero-root
      /*
       * THE OFFSET IS MEASURED, NOT GUESSED.
       *
       * This used to be `-mt-[6.25rem]` / `lg:-mt-[7.5rem]` — a hardcoded
       * 100px and 120px standing in for the header's real height so the
       * photograph runs full-bleed behind it. On a real iPhone the header is
       * taller than the guess: the safe-area inset adds to it on a notched
       * device, and the service strip wraps to two lines at narrow widths.
       * The hero was then pulled up too little and its top — headline
       * included — sat exposed above the bar. That is the reported Safari
       * fault, and no negative constant can be right for every device.
       *
       * Header.tsx measures itself into `--header-h` (ResizeObserver, so it
       * survives rotation and toolbar collapse). The fallbacks keep the old
       * values for the first paint before hydration, so nothing shifts.
       *
       * HEIGHT STAYS `100svh`. Adding the header height to it was wrong and
       * measurably so: the hero is `justify-end`, so a box taller than the
       * viewport pushes its own content — eyebrow, headline, both CTAs —
       * below the fold by exactly the offset. The hero begins at the top of
       * the viewport and ends at the bottom of it; the header simply sits
       * over its first 102px. `svh` is the small viewport (toolbar
       * expanded), so the composition is correct at its tightest and only
       * gains room as the chrome retracts, never loses it.
       */
      style={{ marginTop: "calc(-1 * var(--header-h, 6.25rem))" }}
      className="relative flex h-svh min-h-[600px] flex-col justify-end overflow-hidden bg-olive"
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
            /* A breath of shade behind the travelling mark while it is
               out over the bouquet — enough for cream letterforms to
               hold on the daisies, far short of grey-ing the middle of
               the photograph the way the old full-frame scrim did. */
            "radial-gradient(44% 32% at 50% 46%, rgba(28,30,18,0.46) 0%, rgba(28,30,18,0.20) 52%, rgba(28,30,18,0) 78%)",
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

      {/*
        THE MARK'S PLACE IN THE HERO IS LAID OUT BY CSS, NOT COMPUTED BY JS.

        This slot is a flex child that fills whatever is left between the
        header (the margin-top) and the copy block below. The lockup inside
        is centred in it and sized to fit it, all in CSS — see
        `.hero-mark-slot` in globals.css. Nothing here is measured, summed or
        clamped in a script, so nothing can be stale: when a webfont swaps,
        Arabic rewraps, or the phone rotates, the browser re-lays this out
        along with everything else.

        WHY A REAL COPY OF THE MARK AND NOT AN EMPTY BOX. On Safari the page
        can sit un-hydrated for several seconds, and in that time the only
        thing on screen is what the server sent. The previous version sent
        the header's mark with the travelling attribute already set and let
        CSS default it to hero size at the navbar's position — which is a
        330px lockup cropped behind the header, the fault reported from a
        real iPhone. Now the first paint IS the finished composition: this
        copy stands in the hero and the header's mark is hidden. When the
        driver takes over (HeroMarkTravel.tsx) it reads this box, places the
        header's mark exactly on it, and hides this one, in the same frame.
        Under reduced motion this copy simply stays.
      */}
      <div
        data-hero-mark-slot
        aria-hidden
        className="hero-mark-slot relative z-10 flex min-h-0 flex-1 items-center justify-center"
        style={{ marginTop: "var(--header-h, 6.25rem)" }}
      >
        <div data-hero-mark-art className="hero-mark-art">
          <StackedLogo tone="cream" defineSymbol={false} className="h-full w-full" />
        </div>
      </div>

      {/* Content — bottom-start: thumb zone on a phone, the classic
          editorial caption position on a laptop.
          The bottom padding on a phone clears the floating WhatsApp button
          (48px inset 20px from the corner): the actions are full-width, so
          anything parked in that corner sits on top of the second one. */}
      {/* `data-hero-copy` is what the travelling mark measures against: it
          centres itself in the clear band ABOVE this block rather than at a
          fixed fraction of the hero, so the two can never converge on a
          short screen. See HeroMarkTravel.tsx. */}
      <div
        data-hero-copy
        className="relative z-10 mx-auto w-full max-w-7xl gutter pb-[calc(env(safe-area-inset-bottom)+5.75rem)] lg:pb-24"
      >
        <div className="max-w-xl">
          {/* No mark here: the brand lockup is the large one at the centre
              of the frame, which is the header's own mark transformed down
              into the hero (HeroMarkTravel.tsx). A second monogram beside
              the eyebrow would be the same mark twice in one screen. */}
          <p className="mb-4 font-brand text-[0.6875rem] font-medium uppercase tracking-brand text-cream lg:mb-5 lg:text-xs">
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
              EDITORIAL CTAs, NOT APP BUTTONS.

              These were full-bleed slabs on a phone, then a pair of equal
              192px blocks — which at 390px could not share a row, so they
              stacked: two 48px bars, one under the other, filling the
              bottom of the cover. The owner's word for it was "so big".

              ON A PHONE THEY SHARE ONE ROW, ALWAYS. Each takes half the
              measure (`flex-1 basis-0`), so they are the same width in
              both languages at every phone width without a `min-w` to
              trip over, and the row never wraps. A step down in size —
              44px tall, not 48; 11–12px type, not 13; tighter tracking —
              is what makes two labels fit side by side down to 360px.
              44px is the tap-target floor and stays.

              From `sm:` there is room for them to size to their own text
              again, as the two quiet invitations under a magazine cover
              line that they are on a wide screen.
            */}
            <div className="flex items-center gap-3 min-[400px]:gap-3.5">
              <ButtonLink
                href="/shop"
                variant="glass-primary"
                className="min-h-11 flex-1 basis-0 whitespace-nowrap px-3 py-2 text-[0.7rem] tracking-[0.12em] min-[400px]:text-[0.75rem] min-[400px]:tracking-[0.14em] sm:min-h-12 sm:flex-none sm:basis-auto sm:px-7 sm:py-3 lg:px-12 lg:text-[0.8125rem] lg:tracking-brand"
              >
                {t.hero.shopFlowers}
              </ButtonLink>
              <ButtonLink
                href="/build-your-own"
                variant="glass"
                className="min-h-11 flex-1 basis-0 whitespace-nowrap px-3 py-2 text-[0.7rem] tracking-[0.12em] min-[400px]:text-[0.75rem] min-[400px]:tracking-[0.14em] sm:min-h-12 sm:flex-none sm:basis-auto sm:px-7 sm:py-3 lg:px-12 lg:text-[0.8125rem] lg:tracking-brand"
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
