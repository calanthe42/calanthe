"use client";

import { useEffect, useRef } from "react";
import { useReducedMotionPref } from "@/lib/useReducedMotionPref";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";

gsap.registerPlugin(ScrollTrigger);

/**
 * The background morphs cream → olive as the section enters and back
 * as it leaves (opacity-scrubbed olive layer — client-approved morph,
 * implemented with opacity only).
 */
export function WeeklyRitual() {
  const sectionRef = useRef<HTMLElement>(null);
  const oliveRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPref();

  useEffect(() => {
    const section = sectionRef.current;
    const olive = oliveRef.current;
    if (!section || !olive) return;

    if (reduced) {
      gsap.set(olive, { opacity: 1 });
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "top 85%",
        end: "bottom 5%",
        scrub: true,
      },
    });
    tl.fromTo(olive, { opacity: 0 }, { opacity: 1, duration: 0.28 })
      .to(olive, { opacity: 1, duration: 0.44 })
      .to(olive, { opacity: 0, duration: 0.28 });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [reduced]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <div ref={oliveRef} className="absolute inset-0 bg-olive opacity-0" />

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gutter section-pad text-center">
        <Reveal delay={0.15} className="flex flex-col items-center">
          <p className="font-brand text-xs font-medium uppercase tracking-brand text-cream/70">
            A Weekly Ritual
          </p>
          <h2 className="display-2 mt-4 font-display font-light text-cream">
            The Calanthe Membership
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-cream/80">
            Fresh flowers, thoughtfully arranged and delivered to your door every week.
          </p>
          <div className="mt-9">
            <ButtonLink href="/membership" variant="secondary-cream">
              Discover Membership
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
