"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { ButtonLink } from "@/components/ui/Button";

gsap.registerPlugin(ScrollTrigger);

const GHOST_WORDS = ["Budget", "Colours", "Details"] as const;

/**
 * THE one pinned scrub scene (see brand/motion-spec.md): photo
 * clip-reveals, headline rises line by line, ghost words fade through,
 * the CTA blooms. Pin is short on mobile (~1.2 viewports).
 * Reduced motion: no pin, everything rendered static.
 */
export function BuildYourOwnBanner() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduced) return;

    const q = gsap.utils.selector(section);
    const mm = gsap.matchMedia();

    mm.add(
      { isMobile: "(max-width: 1023px)", isDesktop: "(min-width: 1024px)" },
      (ctx) => {
        const { isMobile } = ctx.conditions as { isMobile: boolean };

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: isMobile ? "+=120%" : "+=170%",
            pin: true,
            scrub: true,
            anticipatePin: 1,
          },
        });

        tl.fromTo(
          q(".byo-photo"),
          { clipPath: "inset(100% 0 0 0)" },
          { clipPath: "inset(0% 0 0 0)", duration: 0.22 },
          0,
        )
          .fromTo(q(".byo-photo-inner"), { scale: 1.12 }, { scale: 1, duration: 0.3 }, 0)
          .fromTo(
            q(".byo-eyebrow"),
            { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: 0.08 },
            0.18,
          )
          .fromTo(
            q(".byo-line"),
            { yPercent: 110 },
            { yPercent: 0, duration: 0.14, stagger: 0.05 },
            0.24,
          )
          .fromTo(
            q(".byo-copy"),
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.1 },
            0.42,
          );

        GHOST_WORDS.forEach((_, i) => {
          const at = 0.52 + i * 0.11;
          tl.fromTo(
            q(`.byo-ghost-${i}`),
            { opacity: 0 },
            { opacity: 1, duration: 0.05 },
            at,
          ).to(q(`.byo-ghost-${i}`), { opacity: 0, duration: 0.05 }, at + 0.06);
        });

        tl.fromTo(
          q(".byo-cta"),
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1, duration: 0.12 },
          0.86,
        );
      },
    );

    return () => mm.revert();
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      className="relative flex h-svh flex-col justify-center overflow-hidden bg-burgundy"
    >
      {/* Editorial photo — right half on desktop, atmospheric behind on mobile */}
      <div
        className="byo-photo absolute inset-0 opacity-45 lg:left-auto lg:right-0 lg:w-1/2 lg:opacity-100"
        style={reduced ? undefined : { clipPath: "inset(100% 0 0 0)" }}
      >
        <div className="byo-photo-inner h-full w-full">
          <BotanicalPlaceholder seed="byo-editorial" palette="burgundy" />
        </div>
        <div className="absolute inset-0 bg-burgundy/40 lg:bg-burgundy/20" />
      </div>

      {/* Ghost words — fade through over the imagery */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-end justify-center pb-36 lg:left-1/2 lg:items-center lg:pb-0"
      >
        {GHOST_WORDS.map((word, i) => (
          <span
            key={word}
            className={`byo-ghost-${i} absolute font-display text-6xl font-light italic text-cream/25 lg:text-8xl`}
            style={reduced ? { opacity: 0 } : { opacity: 0 }}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Content — left column */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-8">
        <div className="max-w-md lg:max-w-lg">
          <p className="byo-eyebrow mb-4 font-brand text-xs font-medium uppercase tracking-brand text-cream/70">
            Bespoke
          </p>
          <h2 className="mb-6 font-display text-4xl font-light leading-[1.08] text-cream lg:text-6xl">
            <span className="block overflow-hidden">
              <span className="byo-line block">Made for them,</span>
            </span>
            <span className="block overflow-hidden">
              <span className="byo-line block">by you.</span>
            </span>
          </h2>
          <p className="byo-copy mb-8 max-w-sm text-base leading-relaxed text-cream/80">
            Choose your budget, colours and preferences. We&apos;ll take care of the
            flowers.
          </p>
          <div className="byo-cta inline-block">
            <ButtonLink href="/build-your-own" variant="primary">
              Create Yours
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
