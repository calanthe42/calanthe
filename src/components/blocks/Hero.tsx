"use client";

import { useEffect, useRef } from "react";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitLines } from "@/components/motion/SplitLines";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { ButtonLink } from "@/components/ui/Button";

gsap.registerPlugin(ScrollTrigger);

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const darkenRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPref();

  /* Scrub: background drifts slower than the page (0.85) and the scene
     darkens slightly as it scrolls away. */
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
      className="relative -mt-16 flex h-svh min-h-[560px] flex-col justify-end overflow-hidden bg-olive"
    >
      {/* Full-bleed imagery — warm muted botanical placeholder */}
      <div ref={bgRef} className="absolute inset-0 will-change-transform">
        <div className="hero-kenburns h-full w-full">
          <BotanicalPlaceholder seed="calanthe-hero" palette="olive" />
        </div>
      </div>

      {/* Olive gradient overlay — legibility for header, headline, CTAs */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(43,47,27,0.5), rgba(43,47,27,0.18) 42%, rgba(43,47,27,0.78))",
        }}
      />
      {/* Scroll-away darken layer, driven by GSAP scrub */}
      <div ref={darkenRef} className="absolute inset-0 bg-olive opacity-0" />

      {/* Content — bottom third, thumb zone */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] lg:px-8 lg:pb-28">
        <p className="mb-4 font-brand text-xs font-medium uppercase tracking-brand text-cream/80">
          Flower Atelier — UAE
        </p>
        <SplitLines
          as="h1"
          immediate
          lines={["Where feelings", "take form."]}
          className="mb-8 max-w-xl font-display text-[2.75rem] font-light leading-[1.05] text-cream lg:text-7xl"
        />
        <div className="flex flex-col gap-3 sm:max-w-md sm:flex-row sm:gap-4">
          <ButtonLink href="/shop" variant="primary" className="w-full sm:flex-1">
            Shop Flowers
          </ButtonLink>
          <ButtonLink
            href="/build-your-own"
            variant="secondary-cream"
            className="w-full sm:flex-1"
          >
            Build Your Own
          </ButtonLink>
        </div>
      </div>

      {/* Scroll cue — thin line drawing downward, looping */}
      <div
        aria-hidden
        className="absolute bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-1/2 z-10 h-9 w-px -translate-x-1/2 overflow-hidden"
      >
        <span className="hero-scrollcue block h-full w-full bg-cream/70" />
      </div>
    </section>
  );
}
