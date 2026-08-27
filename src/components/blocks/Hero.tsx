"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitLines } from "@/components/motion/SplitLines";
import { ButtonLink } from "@/components/ui/Button";
import { FloralImage } from "@/components/ui/FloralImage";
import { PHOTOS } from "@/lib/data";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";

gsap.registerPlugin(ScrollTrigger);

type HeroProps = {
  /**
   * SWAP POINT for the client's real photography: pass any node that
   * fills its parent (an <Image fill className="object-cover" /> once
   * real imagery arrives). Defaults to the warm petal placeholder.
   */
  media?: React.ReactNode;
};

export function Hero({ media }: HeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const darkenRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPref();

  /* Scrub: imagery drifts slower than the page and the scene darkens
     softly as it scrolls away. */
  useEffect(() => {
    const section = sectionRef.current;
    const bg = bgRef.current;
    const darken = darkenRef.current;
    if (!section || !bg || !darken || reduced) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
    tl.to(bg, { yPercent: 15, ease: "none" }, 0).to(
      darken,
      { opacity: 0.45, ease: "none" },
      0,
    );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      className="relative -mt-16 flex h-svh min-h-[600px] flex-col justify-end overflow-hidden bg-olive lg:-mt-[6.75rem]"
    >
      {/* Full-bleed imagery — swappable for real photography */}
      <div ref={bgRef} className="absolute inset-[-8%] will-change-transform">
        <div className="hero-kenburns h-full w-full">
          {media ?? (
            <FloralImage
              image={{
                alt: "A hand-composed Calanthe arrangement in warm petal tones",
                src: PHOTOS.heroBouquet,
                placeholder: { seed: "calanthe-hero-bouquet", palette: "warm" },
              }}
              sizes="100vw"
              priority
            />
          )}
        </div>
      </div>

      {/* Legibility gradients: quiet olive at the top for the header,
          deep olive at the bottom where the words live. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(43,47,27,0.45) 0%, rgba(43,47,27,0.12) 32%, rgba(43,47,27,0.26) 55%, rgba(43,47,27,0.85) 100%)",
        }}
      />
      {/* Scroll-away darken layer, driven by GSAP scrub */}
      <div ref={darkenRef} className="absolute inset-0 bg-olive opacity-0" />

      {/* Content — bottom third (thumb zone on mobile), left on desktop */}
      <div className="relative z-10 mx-auto w-full max-w-7xl gutter pb-[calc(env(safe-area-inset-bottom)+4.5rem)] lg:pb-32">
        <div className="max-w-3xl">
          <p className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-cream/85 lg:mb-6">
            Flower Atelier — UAE
          </p>
          <SplitLines
            as="h1"
            immediate
            lines={["Where feelings", "take form."]}
            className="mb-8 font-display text-[clamp(2.75rem,11vw,3.6rem)] font-light leading-[1.04] text-cream lg:mb-10 lg:text-[clamp(4rem,6.2vw,6.25rem)]"
          />
          <div className="flex flex-col gap-3 sm:max-w-md sm:flex-row sm:gap-4 lg:max-w-none">
            <ButtonLink
              href="/shop"
              variant="primary"
              className="w-full sm:flex-1 lg:w-auto lg:flex-none lg:px-12"
            >
              Shop Flowers
            </ButtonLink>
            <ButtonLink
              href="/build-your-own"
              variant="secondary-cream"
              className="w-full sm:flex-1 lg:w-auto lg:flex-none lg:px-12"
            >
              Build Your Own
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* Refined scroll cue — a thin line drawing downward, looping */}
      <div
        aria-hidden
        className="absolute bottom-[max(env(safe-area-inset-bottom),0.875rem)] left-1/2 z-10 h-10 w-px -translate-x-1/2 overflow-hidden"
      >
        <span className="hero-scrollcue block h-full w-full bg-cream/70" />
      </div>
    </section>
  );
}
