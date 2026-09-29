"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ButtonLink } from "@/components/ui/Button";
import { useT } from "@/lib/locale";
import { FloralImage } from "@/components/ui/FloralImage";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";
import { cn } from "@/lib/cn";

gsap.registerPlugin(ScrollTrigger);

const GHOST_WORDS = ["Budget", "Colours", "Details"] as const;

/*
 * THE WALLPAPER, IN PARTS. Three orchids cut from the client's own wallpaper
 * (the print on the bags and the booth), drawn in cream and fading to
 * nothing at their edges, so each one sits in the burgundy like a flower
 * lit in a dark room. Positions are within the text's half of the section,
 * clear of the words; in Arabic that half mirrors, and so do they.
 */
/* In the order they open: top of the photo's edge, then low at the reading
   edge, then low by the photograph — never under the words or the header. */
const ORCHIDS_DESKTOP = [
  { src: "/brand/print/orchid-b.webp", place: "left-[82%] top-[31%] w-[15rem]" },
  { src: "/brand/print/orchid-c.webp", place: "left-[20%] top-[85%] w-[21rem]" },
  { src: "/brand/print/orchid-a.webp", place: "left-[76%] top-[80%] w-[18rem]" },
] as const;
const ORCHIDS_MOBILE = [
  { src: "/brand/print/orchid-b.webp", place: "left-[80%] top-[11%] w-[15rem]" },
  { src: "/brand/print/orchid-a.webp", place: "left-[20%] top-[90%] w-[16rem]" },
] as const;

/**
 * Desktop: THE one pinned scrub scene (see brand/motion-spec.md) —
 * photo clip-reveals, headline rises, ghost words fade through, CTA
 * blooms. Mobile: unpinned, the same elements bloom sequentially via
 * the shared io reveals (pins feel broken on phones). Reduced motion:
 * static.
 *
 * THE ORCHIDS answer the words. On desktop each one opens — fading up,
 * turning a few degrees, settling from 90% — as its word appears over the
 * photograph, and closes as the word leaves; with the invitation, all three
 * come back at half strength and stay. On a phone, where nothing pins, two
 * of them open and close as the section passes through the screen. Both
 * are scrubbed: scroll back and they close again. Transform and opacity
 * only. Reduced motion: they rest, visible, and never move.
 */
export function BuildYourOwnBanner() {
  const t = useT();
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

      /* Each orchid opens with its word and closes as the word goes… */
      q(".byo-orchid-d").forEach((el, i) => {
        const at = 0.49 + i * 0.11;
        tl.fromTo(
          el,
          { opacity: 0, scale: 0.9, rotate: -5 },
          { opacity: 0.9, scale: 1, rotate: 0, duration: 0.07 },
          at,
        ).to(el, { opacity: 0, scale: 1.06, rotate: 4, duration: 0.07 }, at + 0.1);
      });
      /* …and all three return, quieter, with the invitation. */
      tl.to(
        q(".byo-orchid-d"),
        { opacity: 0.5, scale: 1, rotate: 0, duration: 0.1, stagger: 0.02 },
        0.86,
      );
    });

    /* Phone: no pin. The orchids open as the section rises into view and
       close as it leaves — in and out with the scroll, both directions. */
    mm.add("(max-width: 1023px)", () => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
      q(".byo-orchid-m").forEach((el, i) => {
        const at = 0.1 + i * 0.16;
        tl.fromTo(
          el,
          { opacity: 0, scale: 0.9, rotate: -5 },
          { opacity: 0.7, scale: 1, rotate: 0, duration: 0.22 },
          at,
        ).to(el, { opacity: 0, scale: 1.06, rotate: 4, duration: 0.22 }, at + 0.42);
      });
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
        className="byo-photo io-reveal absolute inset-0 opacity-45 lg:start-auto lg:end-0 lg:w-1/2 lg:opacity-100"
      >
        <div className="byo-photo-inner h-full w-full">
          <FloralImage
            image={{
              alt: t.alt.byoPetal,
              src: "/brand/petal-blush.webp",
              placeholder: { seed: "byo-editorial", palette: "burgundy" },
            }}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        <div className="absolute inset-0 bg-burgundy/40 lg:bg-burgundy/20" />
      </div>

      {/* The orchids. Desktop: the text's half (start), mirrored in Arabic.
          Phone: the whole section, over the photograph, clear of the words. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 hidden w-1/2 rtl:-scale-x-100 lg:block"
      >
        {ORCHIDS_DESKTOP.map((o) => (
          <div key={o.src} className={cn("absolute -translate-x-1/2 -translate-y-1/2", o.place)}>
            <div className={cn("byo-orchid-d", reduced ? "opacity-50" : "opacity-0")}>
              <Image src={o.src} alt="" width={640} height={640} sizes="22rem" className="h-auto w-full" />
            </div>
          </div>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
        {ORCHIDS_MOBILE.map((o) => (
          <div key={o.src} className={cn("absolute -translate-x-1/2 -translate-y-1/2", o.place)}>
            <div className={cn("byo-orchid-m", reduced ? "opacity-50" : "opacity-0")}>
              <Image src={o.src} alt="" width={640} height={640} sizes="16rem" className="h-auto w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Ghost words — desktop scrub only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden items-center justify-center lg:start-1/2 lg:flex"
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
            {t.byo.eyebrow}
          </p>
          <h2
            data-io
            className="io-lines mb-6 font-display text-4xl font-light leading-[1.08] text-cream lg:text-6xl"
          >
            <span className="sr-only">{t.byo.title}</span>
            <span aria-hidden className="block overflow-hidden">
              <span className="byo-line io-line block">{t.byo.titleLine1}</span>
            </span>
            <span aria-hidden className="block overflow-hidden">
              <span className="byo-line io-line block">{t.byo.titleLine2}</span>
            </span>
          </h2>
          <p
            data-io
            className="byo-copy io-reveal mb-8 max-w-sm text-base leading-relaxed text-cream/80"
            style={{ transitionDelay: "0.25s" }}
          >
            {t.byo.intro}
          </p>
          <div
            data-io
            className="byo-cta io-reveal inline-block"
            style={{ transitionDelay: "0.45s" }}
          >
            <ButtonLink href="/build-your-own" variant="primary">
              {t.byo.createYours}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
