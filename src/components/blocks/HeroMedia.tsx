"use client";

import { useEffect, useRef, useState } from "react";
import {
  HERO_POSTER,
  HERO_VIDEO_SRC,
  HERO_VIDEO_SRC_MOBILE,
} from "@/lib/hero-media";

/**
 * The hero's visual layer: the photograph always, the film only when it
 * has earned the right to load.
 *
 * THE PHOTOGRAPH IS THE DESIGN. It is server-rendered, `fetchPriority
 * high`, and is the LCP element. Nothing below is allowed to delay it —
 * the video element carries no `src` in the markup at all, so the
 * browser's preload scanner never even sees a video to fetch. The src
 * is attached in JavaScript, after `load`, during idle time.
 *
 * The film then fades in over the poster once it can actually play, and
 * the poster stays underneath forever — so a video that stalls, fails
 * to decode, or is blocked by an autoplay policy degrades to exactly
 * the design that shipped without it. There is no failure state.
 *
 * It refuses to load at all on: reduced motion, Save-Data, 2G, a
 * data-saving connection, or a phone with no portrait encode available
 * (a landscape film letterboxed into a 9:16 hero is worse than the
 * photograph, and costs a phone's data to be worse).
 *
 * It pauses when scrolled away or when the tab is hidden — decoding
 * frames nobody is looking at is pure battery.
 */
export function HeroMedia() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Phones get the film only if a portrait encode exists for them. */
    const isNarrow = window.matchMedia("(max-width: 1023px)").matches;
    const src = isNarrow ? HERO_VIDEO_SRC_MOBILE : HERO_VIDEO_SRC;
    if (!src) return;

    /* Respect the visitor's own bandwidth signals. `connection` is
       Chromium-only; its absence is not a reason to refuse. */
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /^(slow-)?2g$/.test(connection.effectiveType)) {
      return;
    }

    let cancelled = false;
    let io: IntersectionObserver | undefined;

    const onVisibility = () => {
      if (document.hidden) video.pause();
      else void video.play().catch(() => {});
    };

    const attach = () => {
      if (cancelled) return;

      video.src = src;
      video.load();

      /* Only reveal once the browser confirms it can play — never on a
         timer, and never before the first frame is decodable, or the
         hero flashes black over the photograph. */
      const reveal = () => {
        if (!cancelled) setActive(true);
      };
      video.addEventListener("playing", reveal, { once: true });

      void video.play().catch(() => {
        /* Autoplay refused: the poster is already correct. Do nothing. */
      });

      /* Stop decoding once the hero has left the screen. */
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          if (entry.isIntersecting) void video.play().catch(() => {});
          else video.pause();
        },
        { threshold: 0.05 },
      );
      io.observe(video);
      document.addEventListener("visibilitychange", onVisibility);
    };

    /* Wait for the page to finish loading, then for the main thread to
       be genuinely idle. The film must never compete with LCP. */
    const schedule = () => {
      const idle = (
        window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (idle) idle(attach, { timeout: 2500 });
      else setTimeout(attach, 1200);
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("load", schedule);
      /* Release the buffer on navigation away. */
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* The photograph. Always present, always underneath, never
          conditional — this is the hero whether or not a film exists. */}
      <picture className="block h-full w-full">
        <source media="(min-aspect-ratio: 1/1)" srcSet={HERO_POSTER.desktop} />
        <img
          src={HERO_POSTER.mobile}
          alt={HERO_POSTER.alt}
          width={HERO_POSTER.width}
          height={HERO_POSTER.height}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </picture>

      {/* The film. No `src` until JavaScript decides it may have one, so
          the preload scanner never fetches it. `aria-hidden` because it
          is decorative: the photograph above carries the alt text, and
          a silent looping atmosphere shot has nothing to announce. */}
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden
        tabIndex={-1}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-bloom ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
