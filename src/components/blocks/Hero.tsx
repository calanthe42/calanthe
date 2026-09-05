import Link from "next/link";
import { HeroLogoDock } from "@/components/motion/HeroLogoDock";
import { Parallax } from "@/components/motion/Parallax";
import { SplitLines } from "@/components/motion/SplitLines";
import { ButtonLink } from "@/components/ui/Button";
import { StackedLogo } from "@/components/ui/StackedLogo";
import { HeroRibbon } from "@/components/blocks/HeroRibbon";

type HeroProps = {
  /**
   * SWAP POINT for the client's real photography: pass any node that
   * fills its parent (an <Image fill className="object-cover" /> once
   * real imagery arrives, or a video element — the section itself
   * doesn't care what fills it).
   */
  media?: React.ReactNode;
};

/**
 * Hero — full-viewport, photography-led. The flower is the whole
 * background; the brand mark, the locked words and the two actions
 * sit quietly on top of it. One idea at a time: mark -> ribbon ->
 * headline -> CTAs. No scroll cue.
 */
export function Hero({ media }: HeroProps) {
  return (
    <section
      data-hero-root
      className="relative -mt-16 flex h-svh min-h-[600px] flex-col justify-end overflow-hidden bg-olive lg:-mt-20"
    >
      {/* Full-bleed photography — the visual centerpiece. Parallax is
          desktop-only: on a phone the travelling logo is the one
          scroll-linked animation on this screen, and it keeps every
          frame it can get. */}
      <Parallax speed={0.93} desktopOnly className="absolute inset-0">
        <div className="hero-kenburns h-full w-full">
          {media ?? (
            /* Art-directed, not just resized: landscape screens get the
               wide crop, portrait screens get the tall one. The browser
               downloads only the one it needs. */
            <picture className="block h-full w-full">
              <source
                media="(min-aspect-ratio: 1/1)"
                srcSet="/brand/hero-desktop.jpg"
              />
              <img
                src="/brand/hero-mobile.jpg"
                alt="A Calanthe arrangement of garden roses, daisies and coral blossom in a white vase"
                width={1600}
                height={2000}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </picture>
          )}
        </div>
      </Parallax>

      {/* Two soft scrims, both fading to nothing so the photograph keeps
          its own colour: one behind the centred mark (the bouquet's
          daisies are bright, and the mark is cream), one where the words
          sit at the bottom-left. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(58% 44% at 50% 48%, rgba(28,30,18,0.5) 0%, rgba(28,30,18,0.22) 50%, rgba(28,30,18,0) 78%)",
            "radial-gradient(130% 100% at 12% 100%, rgba(43,47,27,0.64) 0%, rgba(43,47,27,0.32) 32%, rgba(43,47,27,0.08) 58%, rgba(43,47,27,0) 78%)",
          ].join(", "),
        }}
      />
      {/* Phones only: the tall crop puts the brightest part of the
          bouquet directly behind the words, so they need a firmer
          floor than the desktop crop does. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-olive/90 via-olive/45 to-transparent lg:hidden"
      />

      {/* The mark, at rest: large and dead-centre in the VIEWPORT on
          load (fixed, not relative to the hero's own box — the two
          coincide almost exactly, but "almost" was visibly off).
          `HeroLogoDock` (mounted below) takes over as this same mark
          once JS confirms motion is allowed, traveling into the navbar
          as the page scrolls. This inline mark is the no-JS /
          reduced-motion version — same size, same spot, never moves. */}
      <Link
        href="/"
        aria-label="Calanthe — home"
        className="hero-mark-inline fixed left-1/2 top-[var(--logo-hero-top)] z-[45] block w-[var(--logo-hero-w)] -translate-x-1/2 -translate-y-1/2"
      >
        <StackedLogo tone="cream" priority sizes="(min-width: 1024px) 560px, 330px" />
      </Link>
      <HeroLogoDock />

      {/* Content — bottom third (thumb zone on mobile), left on desktop */}
      <div className="relative z-10 mx-auto w-full max-w-7xl gutter pb-[calc(env(safe-area-inset-bottom)+4.5rem)] lg:pb-28">
        <div className="max-w-2xl">
          <HeroRibbon className="mb-5 h-5 w-20 lg:mb-6 lg:h-6 lg:w-24" />

          <p className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-cream/80 lg:mb-5">
            Flower Atelier — UAE
          </p>

          <SplitLines
            as="h1"
            immediate
            delay={0.4}
            lines={["Where feelings", "take form."]}
            className="mb-8 font-display text-[clamp(2.75rem,10vw,3.6rem)] font-light leading-[1.04] text-cream lg:mb-10 lg:text-[clamp(3.4rem,4.6vw,4.75rem)]"
          />

          <div className="hero-cta-in">
            <div className="flex flex-col gap-3 sm:max-w-md sm:flex-row sm:gap-4">
              <ButtonLink
                href="/shop"
                variant="glass-primary"
                className="w-full whitespace-nowrap sm:flex-1 lg:w-auto lg:flex-none lg:px-12"
              >
                Shop Flowers
              </ButtonLink>
              <ButtonLink
                href="/build-your-own"
                variant="glass"
                className="w-full whitespace-nowrap sm:flex-1 lg:w-auto lg:flex-none lg:px-12"
              >
                Build Your Own
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
