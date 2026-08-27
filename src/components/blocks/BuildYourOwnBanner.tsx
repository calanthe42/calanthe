"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BotanicalPlaceholder } from "@/components/ui/BotanicalPlaceholder";
import { ButtonLink } from "@/components/ui/Button";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";

gsap.registerPlugin(ScrollTrigger);

const GHOST_WORDS = ["Budget", "Colours", "Details"] as const;

/**
 * Desktop: THE one pinned scrub scene (see brand/motion-spec.md) —
 * photo clip-reveals, headline rises, ghost words fade through, CTA
 * blooms. Mobile: unpinned, the same elements bloom sequentially via
 * the shared io reveals (pins feel broken on phones). Reduced motion:
 * static.
 */
export function BuildYourOwnBanner() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotionPref();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduced) return;

    const q = gsap.utils.selector(section);
    const mm = gsap.matchMedia();

    /* Desktop only — mobile uses the CSS io reveals instead of a pin. */
    mm.add("(min-width: 1024px)", () => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "+=170%",
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
    });

    return () => mm.revert();
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-svh flex-col justify-center overflow-hidden bg-burgundy"
    >
      {/* Editorial photo — right half on desktop, atmospheric behind on
          mobile (io fade; GSAP clips it on desktop) */}
      <div
        data-io
        className="byo-photo io-reveal absolute inset-0 opacity-45 lg:left-auto lg:right-0 lg:w-1/2 lg:opacity-100"
      >
        <div className="byo-photo-inner h-full w-full">
          <BotanicalPlaceholder seed="byo-editorial" palette="burgundy" />
        </div>
        <div className="absolute inset-0 bg-burgundy/40 lg:bg-burgundy/20" />
      </div>

      {/* Ghost words — desktop scrub only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:left-1/2 lg:flex"
      >
        {GHOST_WORDS.map((word, i) => (
          <span
            key={word}
            className={`byo-ghost-${i} absolute font-display text-8xl font-light italic text-cream/25`}
            style={{ opacity: 0 }}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Content — sequential io reveals on mobile, timeline on desktop */}
      <div className="relative z-10 mx-auto w-full max-w-7xl gutter section-pad">
        <div className="max-w-md lg:max-w-lg">
          <p
            data-io
            className="byo-eyebrow io-reveal mb-4 font-brand text-xs font-medium uppercase tracking-brand text-cream/70"
          >
            Bespoke
          </p>
          <h2
            data-io
            className="io-lines mb-6 font-display text-4xl font-light leading-[1.08] text-cream lg:text-6xl"
          >
            <span className="sr-only">Made for them, by you.</span>
            <span aria-hidden className="block overflow-hidden">
              <span className="byo-line io-line block">Made for them,</span>
            </span>
            <span aria-hidden className="block overflow-hidden">
              <span className="byo-line io-line block">by you.</span>
            </span>
          </h2>
          <p
            data-io
            className="byo-copy io-reveal mb-8 max-w-sm text-base leading-relaxed text-cream/80"
            style={{ transitionDelay: "0.25s" }}
          >
            Choose your budget, colours and preferences. We&apos;ll take care of
            the flowers.
          </p>
          <div
            data-io
            className="byo-cta io-reveal inline-block"
            style={{ transitionDelay: "0.45s" }}
          >
            <ButtonLink href="/build-your-own" variant="primary">
              Create Yours
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
